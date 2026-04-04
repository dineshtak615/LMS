"use client";

import { CSSProperties, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API, { resolveAssetUrl } from "@/services/api";

type Tab = "courses" | "students";
const resolveTab = (value: string | null): Tab => (value === "students" ? "students" : "courses");

type TrainerPerformance = {
  averageProgress: number;
  completionRate: number;
  averageQuizScore: number;
  averageAssignmentScore: number;
  averageAttendanceMinutes: number;
  attendanceScore: number;
  overallScore: number;
  gradedAssignmentCount: number;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as {
    message?: string;
    response?: {
      status?: number;
      data?: { message?: string };
    };
  };

  const apiMessage = err.response?.data?.message;
  const status = err.response?.status;
  if (apiMessage && status) return `${apiMessage} (HTTP ${status})`;
  if (apiMessage) return apiMessage;
  if (err.message) return err.message;
  return fallback;
};

const isGoogleMeetLink = (value: string) =>
  /^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:[/?#].*)?$/i.test(String(value || "").trim());

const toDatetimeLocalInputValue = (value: unknown) => {
  if (!value) return "";

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatMeetingSchedule = (value: unknown) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

function TrainerDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [courses, setCourses] = useState<any[]>([]);
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>(() => resolveTab(searchParams.get("tab")));
  const [selectedCourse, setSelectedCourse] = useState("");
  const [searchCourse, setSearchCourse] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [trainerPerformance, setTrainerPerformance] = useState<TrainerPerformance | null>(null);
  const [meetingLinkDrafts, setMeetingLinkDrafts] = useState<Record<string, string>>({});
  const [meetingScheduleDrafts, setMeetingScheduleDrafts] = useState<Record<string, string>>({});
  const [savingMeetingCourseId, setSavingMeetingCourseId] = useState<string | null>(null);
  const [meetingMessage, setMeetingMessage] = useState<{ courseId: string; type: "success" | "error"; text: string } | null>(null);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, string>>({});
  const [savingAttendanceEnrolmentId, setSavingAttendanceEnrolmentId] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState<{ enrolmentId: string; type: "success" | "error"; text: string } | null>(null);

  const setTab = useCallback(
    (nextTab: Tab) => {
      setActiveTab(nextTab);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", nextTab);
      const queryString = nextParams.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setActiveTab(resolveTab(searchParams.get("tab")));
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    const cacheBust = Date.now();
    const [coursesResult, enrolmentsResult, trainerDashboardResult] = await Promise.allSettled([
      API.get(`/courses?limit=200&_=${cacheBust}`),
      API.get(`/enrolments?limit=1000&_=${cacheBust}`),
      API.get(`/dashboard/trainer?_=${cacheBust}`),
    ]);

    let courseList: any[] = [];
    let enrolmentList: any[] = [];
    const errors: string[] = [];

    if (coursesResult.status === "fulfilled") {
      courseList = coursesResult.value.data?.data?.courses || [];
    } else {
      errors.push(`Courses: ${getErrorMessage(coursesResult.reason, "Failed to load courses.")}`);
    }

    if (enrolmentsResult.status === "fulfilled") {
      enrolmentList = enrolmentsResult.value.data?.data?.enrolments || [];
    } else {
      errors.push(`Enrolments: ${getErrorMessage(enrolmentsResult.reason, "Failed to load enrolments.")}`);
    }

    if (trainerDashboardResult.status === "fulfilled") {
      setTrainerPerformance(trainerDashboardResult.value.data?.data?.performance || null);
    } else {
      setTrainerPerformance(null);
      errors.push(`Performance: ${getErrorMessage(trainerDashboardResult.reason, "Failed to load trainer performance.")}`);
    }

    try {

      const pendingRaw = sessionStorage.getItem("trainerDashboard:newCourse");
      let mergedCourses = courseList;
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          const pendingId = pending?._id ? String(pending._id) : "";
          if (pendingId && !courseList.some((course: any) => String(course?._id) === pendingId)) {
            mergedCourses = [pending, ...courseList];
          }
        } catch {
          // Ignore malformed cached payload.
        } finally {
          sessionStorage.removeItem("trainerDashboard:newCourse");
        }
      }

      setCourses(mergedCourses);
      setEnrolments(enrolmentList);
      setAttendanceDrafts((previous) => {
        const next: Record<string, string> = {};
        enrolmentList.forEach((item: any) => {
          const id = String(item?._id || "");
          if (!id) return;
          next[id] = previous[id] !== undefined ? previous[id] : String(item?.attendanceMinutes ?? 0);
        });
        return next;
      });
      setMeetingLinkDrafts((previous) => {
        const next: Record<string, string> = {};
        mergedCourses.forEach((course: any) => {
          const id = String(course?._id || "");
          if (!id) return;
          next[id] = previous[id] !== undefined ? previous[id] : String(course?.meetingLink || "");
        });
        return next;
      });
      setMeetingScheduleDrafts((previous) => {
        const next: Record<string, string> = {};
        mergedCourses.forEach((course: any) => {
          const id = String(course?._id || "");
          if (!id) return;
          next[id] = previous[id] !== undefined
            ? previous[id]
            : toDatetimeLocalInputValue(course?.meetingScheduledAt);
        });
        return next;
      });

      setSelectedCourse((current) => {
        if (!mergedCourses.length) return "";
        if (!current) return "";
        return mergedCourses.some((course: any) => String(course._id) === current) ? current : "";
      });
      if (errors.length > 0) {
        setError(errors.join(" "));
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load trainer dashboard data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => {
      fetchData();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  const courseIds = useMemo(() => new Set(courses.map((course) => String(course._id))), [courses]);

  const myEnrolments = useMemo(
    () => enrolments.filter((item) => courseIds.has(String(item.courseId?._id || item.courseId || ""))),
    [enrolments, courseIds]
  );

  const filteredCourses = useMemo(() => {
    const query = searchCourse.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => String(course.title || "").toLowerCase().includes(query));
  }, [courses, searchCourse]);

  const filteredStudents = useMemo(() => {
    const query = searchStudent.trim().toLowerCase();

    return myEnrolments.filter((item) => {
      const matchesCourse =
        !selectedCourse || String(item.courseId?._id || item.courseId || "") === String(selectedCourse);

      if (!matchesCourse) return false;
      if (!query) return true;

      const name = String(item.studentId?.name || "").toLowerCase();
      const email = String(item.studentId?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [myEnrolments, searchStudent, selectedCourse]);

  const activeCourses = courses.filter((course) => course.isActive !== false).length;
  const totalEnrolmentCount = myEnrolments.length;
  const completedEnrolmentCount = myEnrolments.filter((item) => item.status === "completed").length;
  const fallbackAverageProgress = totalEnrolmentCount > 0
    ? Number((myEnrolments.reduce((sum, item) => sum + Number(item.progress || 0), 0) / totalEnrolmentCount).toFixed(1))
    : 0;
  const fallbackCompletionRate = totalEnrolmentCount > 0 ? Number(((completedEnrolmentCount / totalEnrolmentCount) * 100).toFixed(1)) : 0;
  const averageProgress = Number(trainerPerformance?.averageProgress ?? fallbackAverageProgress);
  const completionRate = Number(trainerPerformance?.completionRate ?? fallbackCompletionRate);
  const averageQuizScore = Number(trainerPerformance?.averageQuizScore ?? 0);
  const averageAssignmentScore = Number(trainerPerformance?.averageAssignmentScore ?? 0);
  const averageAttendanceMinutes = Number(trainerPerformance?.averageAttendanceMinutes ?? 0);
  const overallPerformanceScore = Number(trainerPerformance?.overallScore ?? 0);
  const totalStudents = new Set(
    myEnrolments
      .map((item) => (item.studentId?._id ? String(item.studentId._id) : ""))
      .filter(Boolean)
  ).size;

  const tabStyle = (tab: Tab): CSSProperties => ({
    padding: "10px 24px",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
    background: "none",
    color: activeTab === tab ? "#3b82f6" : "#64748b",
    fontWeight: activeTab === tab ? 700 : 500,
    fontSize: 14,
    cursor: "pointer",
  });

  const handleMeetingLinkChange = (courseId: string, value: string) => {
    setMeetingLinkDrafts((current) => ({ ...current, [courseId]: value }));
    if (meetingMessage?.courseId === courseId) {
      setMeetingMessage(null);
    }
  };

  const handleMeetingScheduleChange = (courseId: string, value: string) => {
    setMeetingScheduleDrafts((current) => ({ ...current, [courseId]: value }));
    if (meetingMessage?.courseId === courseId) {
      setMeetingMessage(null);
    }
  };

  const saveMeetingLink = async (courseId: string, options?: { removeAll?: boolean }) => {
    const shouldRemoveAll = Boolean(options?.removeAll);
    const draftLink = shouldRemoveAll ? "" : String(meetingLinkDrafts[courseId] || "").trim();
    const draftSchedule = shouldRemoveAll ? "" : String(meetingScheduleDrafts[courseId] || "").trim();

    if (draftLink && !isGoogleMeetLink(draftLink)) {
      setMeetingMessage({
        courseId,
        type: "error",
        text: "Enter a valid Google Meet URL (https://meet.google.com/...).",
      });
      return;
    }

    if (!draftLink && draftSchedule) {
      setMeetingMessage({
        courseId,
        type: "error",
        text: "Set a meeting link before adding schedule time.",
      });
      return;
    }

    let normalizedScheduleIso: string | null = null;
    if (draftLink && draftSchedule) {
      const parsedSchedule = new Date(draftSchedule);
      if (Number.isNaN(parsedSchedule.getTime())) {
        setMeetingMessage({
          courseId,
          type: "error",
          text: "Enter a valid meeting schedule date and time.",
        });
        return;
      }
      normalizedScheduleIso = parsedSchedule.toISOString();
    }

    setSavingMeetingCourseId(courseId);
    setMeetingMessage(null);

    try {
      const response = await API.put(`/courses/${courseId}`, {
        meetingLink: draftLink || null,
        meetingScheduledAt: draftLink ? normalizedScheduleIso : null,
      });

      const updated = response.data?.data?.course;
      const savedLink = String(updated?.meetingLink || draftLink || "");
      const savedScheduleIso = savedLink
        ? String(updated?.meetingScheduledAt || normalizedScheduleIso || "")
        : "";
      const savedScheduleDraft = toDatetimeLocalInputValue(savedScheduleIso);

      setCourses((current) =>
        current.map((course) =>
          String(course._id) === courseId
            ? {
                ...course,
                meetingLink: savedLink || null,
                meetingScheduledAt: savedLink ? savedScheduleIso || null : null,
              }
            : course
        )
      );
      setMeetingLinkDrafts((current) => ({ ...current, [courseId]: savedLink }));
      setMeetingScheduleDrafts((current) => ({ ...current, [courseId]: savedScheduleDraft }));
      setMeetingMessage({
        courseId,
        type: "success",
        text: savedLink ? "Meeting details saved." : "Meeting link and schedule removed.",
      });
    } catch (error) {
      setMeetingMessage({
        courseId,
        type: "error",
        text: getErrorMessage(error, "Failed to save meeting link."),
      });
    } finally {
      setSavingMeetingCourseId(null);
    }
  };

  const handleAttendanceMinutesChange = (enrolmentId: string, value: string) => {
    setAttendanceDrafts((current) => ({ ...current, [enrolmentId]: value }));
    if (attendanceMessage?.enrolmentId === enrolmentId) {
      setAttendanceMessage(null);
    }
  };

  const saveAttendanceMinutes = async (enrolmentId: string) => {
    const rawValue = String(attendanceDrafts[enrolmentId] || "").trim();
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setAttendanceMessage({
        enrolmentId,
        type: "error",
        text: "Attendance minutes must be a non-negative number.",
      });
      return;
    }

    const normalized = Math.round(parsed * 10) / 10;
    setSavingAttendanceEnrolmentId(enrolmentId);
    setAttendanceMessage(null);

    try {
      await API.put(`/enrolments/${enrolmentId}`, { attendanceMinutes: normalized });
      setEnrolments((current) =>
        current.map((item) =>
          String(item._id) === enrolmentId
            ? { ...item, attendanceMinutes: normalized }
            : item
        )
      );
      setAttendanceDrafts((current) => ({ ...current, [enrolmentId]: String(normalized) }));

      try {
        const perfResponse = await API.get("/dashboard/trainer");
        setTrainerPerformance(perfResponse.data?.data?.performance || null);
      } catch {
        // Keep dashboard usable even if performance refresh fails.
      }

      setAttendanceMessage({
        enrolmentId,
        type: "success",
        text: "Attendance updated.",
      });
    } catch (error) {
      setAttendanceMessage({
        enrolmentId,
        type: "error",
        text: getErrorMessage(error, "Failed to update attendance."),
      });
    } finally {
      setSavingAttendanceEnrolmentId(null);
    }
  };

  return (
    <ProtectedRoute role="trainer">
      <DashboardLayout>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Trainer Dashboard
            </h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              {user?.name ? `Welcome, ${user.name}. Manage your courses and students.` : "Manage your courses and students."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={fetchData} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="btn btn-primary" onClick={() => router.push("/admin/courses/create")}>
              Add Course
            </button>
          </div>
        </div>

        {error && (
          <div className="error-msg" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="spinner" />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 14,
                marginBottom: 16,
              }}
            >
              {[
                { label: "My Courses", value: courses.length, color: "#2563eb" },
                { label: "Active Courses", value: activeCourses, color: "#16a34a" },
                { label: "Total Students", value: totalStudents, color: "#f59e0b" },
                { label: "Avg Progress", value: `${averageProgress}%`, color: "#7c3aed" },
                { label: "Completion Rate", value: `${completionRate}%`, color: "#0ea5e9" },
                { label: "Avg Quiz", value: `${averageQuizScore}%`, color: "#22c55e" },
                { label: "Assignment Score", value: `${averageAssignmentScore}%`, color: "#f97316" },
                { label: "Meet Minutes", value: averageAttendanceMinutes, color: "#14b8a6" },
                { label: "Overall Score", value: `${overallPerformanceScore}%`, color: "#ef4444" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#fff",
                    borderRadius: 10,
                    padding: 18,
                    borderLeft: `4px solid ${item.color}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {item.label}
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", padding: "0 8px" }}>
                <button style={tabStyle("courses")} onClick={() => setTab("courses")}>
                  My Courses ({courses.length})
                </button>
                <button style={tabStyle("students")} onClick={() => setTab("students")}>
                  My Students ({totalStudents})
                </button>
              </div>

              <div style={{ padding: 20 }}>
                {activeTab === "courses" && (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <input
                        className="input"
                        placeholder="Search courses"
                        value={searchCourse}
                        onChange={(e) => setSearchCourse(e.target.value)}
                        style={{ maxWidth: 320 }}
                      />
                    </div>

                    {filteredCourses.length === 0 ? (
                      <p style={{ color: "#64748b" }}>No courses found.</p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                          gap: 14,
                        }}
                      >
                        {filteredCourses.map((course) => {
                          const courseId = String(course._id);
                          const courseEnrolments = myEnrolments.filter(
                            (item) => String(item.courseId?._id || item.courseId || "") === courseId
                          );
                          const enrolCount = courseEnrolments.length;
                          const fillPct = course.maxEnrolments
                            ? Math.min((enrolCount / course.maxEnrolments) * 100, 100)
                            : 0;
                          const videoLink = resolveAssetUrl(course.videoUrl);
                          const pdfLink = resolveAssetUrl(course.pdfUrl);
                          const savedMeetingLink = String(course.meetingLink || "").trim();
                          const savedMeetingSchedule = course.meetingScheduledAt
                            ? String(course.meetingScheduledAt)
                            : "";
                          const draftMeetingLink = meetingLinkDrafts[courseId] ?? savedMeetingLink;
                          const draftMeetingSchedule = meetingScheduleDrafts[courseId] ?? toDatetimeLocalInputValue(savedMeetingSchedule);
                          const currentMeetingMessage =
                            meetingMessage?.courseId === courseId ? meetingMessage : null;

                          return (
                            <div
                              key={courseId}
                              style={{
                                border: "1px solid #e2e8f0",
                                borderRadius: 10,
                                padding: 16,
                                background: "#fff",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  marginBottom: 10,
                                  gap: 8,
                                }}
                              >
                                <h3 style={{ fontSize: 15, margin: 0, color: "#0f172a" }}>{course.title}</h3>
                                <span className={`badge ${course.isActive !== false ? "badge-green" : "badge-red"}`}>
                                  {course.isActive !== false ? "Active" : "Inactive"}
                                </span>
                              </div>

                              {course.description && (
                                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>{course.description}</p>
                              )}

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                                {course.category && <span className="badge badge-blue">{course.category}</span>}
                                {course.duration && <span className="badge badge-gray">{course.duration}</span>}
                                <span className="badge badge-green">Rs {(course.fee || 0).toLocaleString()}</span>
                              </div>

                              <div style={{ marginBottom: 10 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 12,
                                    color: "#64748b",
                                    marginBottom: 4,
                                  }}
                                >
                                  <span>{enrolCount} enrolled</span>
                                  {course.maxEnrolments && <span>Max: {course.maxEnrolments}</span>}
                                </div>
                                {course.maxEnrolments && (
                                  <div style={{ background: "#e2e8f0", borderRadius: 999, height: 6 }}>
                                    <div
                                      style={{
                                        background: "#3b82f6",
                                        borderRadius: 999,
                                        height: 6,
                                        width: `${fillPct}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              {(videoLink || pdfLink) && (
                                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                  {videoLink && (
                                    <a
                                      href={videoLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: 12,
                                        color: "#3b82f6",
                                        textDecoration: "none",
                                        padding: "4px 10px",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: 6,
                                        background: "#eff6ff",
                                      }}
                                    >
                                      Video
                                    </a>
                                  )}
                                  {pdfLink && (
                                    <a
                                      href={pdfLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: 12,
                                        color: "#dc2626",
                                        textDecoration: "none",
                                        padding: "4px 10px",
                                        border: "1px solid #fecaca",
                                        borderRadius: 6,
                                        background: "#fef2f2",
                                      }}
                                    >
                                      PDF
                                    </a>
                                  )}
                                </div>
                              )}

                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                                  Google Meet Link
                                </label>
                                <input
                                  className="input"
                                  placeholder="https://meet.google.com/..."
                                  value={draftMeetingLink}
                                  onChange={(e) => handleMeetingLinkChange(courseId, e.target.value)}
                                  style={{ marginBottom: 8 }}
                                />
                                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                                  Meeting Schedule
                                </label>
                                <input
                                  className="input"
                                  type="datetime-local"
                                  value={draftMeetingSchedule}
                                  onChange={(e) => handleMeetingScheduleChange(courseId, e.target.value)}
                                  style={{ marginBottom: 8 }}
                                />
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: 12, padding: "6px 10px" }}
                                    onClick={() => saveMeetingLink(courseId)}
                                    disabled={savingMeetingCourseId === courseId}
                                  >
                                    {savingMeetingCourseId === courseId ? "Saving..." : "Save Meeting"}
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: 12, padding: "6px 10px" }}
                                    onClick={() => saveMeetingLink(courseId, { removeAll: true })}
                                    disabled={savingMeetingCourseId === courseId || (!savedMeetingLink && !savedMeetingSchedule)}
                                  >
                                    Remove
                                  </button>
                                  {savedMeetingLink && (
                                    <a
                                      href={savedMeetingLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn btn-primary"
                                      style={{ fontSize: 12, padding: "6px 10px", textDecoration: "none" }}
                                    >
                                      Join Meet
                                    </a>
                                  )}
                                </div>
                                {savedMeetingSchedule && (
                                  <p style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                                    Scheduled: {formatMeetingSchedule(savedMeetingSchedule)}
                                  </p>
                                )}
                                {currentMeetingMessage && (
                                  <p style={{ marginTop: 6, fontSize: 12, color: currentMeetingMessage.type === "error" ? "#dc2626" : "#16a34a" }}>
                                    {currentMeetingMessage.text}
                                  </p>
                                )}
                              </div>

                              <button
                                className="btn btn-ghost"
                                style={{ width: "100%", fontSize: 12, padding: 8 }}
                                onClick={() => {
                                  setSelectedCourse(courseId);
                                  setTab("students");
                                }}
                              >
                                View Students
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "students" && (
                  <>
                    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      <input
                        className="input"
                        placeholder="Search student"
                        value={searchStudent}
                        onChange={(e) => setSearchStudent(e.target.value)}
                        style={{ maxWidth: 260 }}
                      />

                      <select
                        className="input"
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        style={{ maxWidth: 320 }}
                      >
                        <option value="">All Courses</option>
                        {courses.map((course) => (
                          <option key={course._id} value={String(course._id)}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <p style={{ color: "#64748b" }}>No students found.</p>
                    ) : (
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Student</th>
                              <th>Course</th>
                              <th>Progress</th>
                              <th>Status</th>
                              <th>Meet Min</th>
                              <th>Enrolled On</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((item, idx) => (
                              <tr key={item._id}>
                                <td>{idx + 1}</td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.studentId?.name || "-"}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.studentId?.email || ""}</div>
                                </td>
                                <td>{item.courseId?.title || "-"}</td>
                                <td>
                                  <div
                                    style={{
                                      background: "#e2e8f0",
                                      borderRadius: 999,
                                      height: 8,
                                      width: 110,
                                      marginBottom: 3,
                                    }}
                                  >
                                    <div
                                      style={{
                                        background: "#3b82f6",
                                        borderRadius: 999,
                                        height: 8,
                                        width: `${item.progress || 0}%`,
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: 11, color: "#64748b" }}>{item.progress || 0}%</span>
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      item.status === "active"
                                        ? "badge-green"
                                        : item.status === "completed"
                                          ? "badge-blue"
                                          : "badge-red"
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    <input
                                      className="input"
                                      type="number"
                                      min={0}
                                      step={0.5}
                                      value={attendanceDrafts[String(item._id)] ?? String(item.attendanceMinutes ?? 0)}
                                      onChange={(e) => handleAttendanceMinutesChange(String(item._id), e.target.value)}
                                      style={{ width: 90, padding: "6px 8px", fontSize: 12 }}
                                    />
                                    <button
                                      className="btn btn-ghost"
                                      style={{ padding: "6px 8px", fontSize: 11 }}
                                      onClick={() => saveAttendanceMinutes(String(item._id))}
                                      disabled={savingAttendanceEnrolmentId === String(item._id)}
                                    >
                                      {savingAttendanceEnrolmentId === String(item._id) ? "..." : "Save"}
                                    </button>
                                  </div>
                                  {attendanceMessage?.enrolmentId === String(item._id) && (
                                    <div
                                      style={{
                                        marginTop: 4,
                                        fontSize: 11,
                                        color: attendanceMessage.type === "error" ? "#dc2626" : "#16a34a",
                                      }}
                                    >
                                      {attendanceMessage.text}
                                    </div>
                                  )}
                                </td>
                                <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function TrainerDashboard() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#f8fafc",
          }}
        >
          <div className="spinner" />
        </div>
      }
    >
      <TrainerDashboardContent />
    </Suspense>
  );
}
