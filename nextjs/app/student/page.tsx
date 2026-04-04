"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import API from "@/services/api";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (eventName: string, callback: (response: unknown) => void) => void;
}

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

interface EnrolmentRow {
  _id: string;
  status: "active" | "completed" | "dropped" | "suspended";
  progress: number;
  courseId?: {
    _id: string;
    title?: string;
    duration?: string;
    category?: string;
    fee?: number;
    meetingLink?: string | null;
    meetingScheduledAt?: string | null;
  } | null;
}

interface PaymentRow {
  _id: string;
  amount: number;
  paymentDate: string;
}

interface StudentDashboardData {
  enrolments: EnrolmentRow[];
  recentPayments: PaymentRow[];
  performance?: {
    averageProgress: number;
    completionRate: number;
    averageQuizScore: number;
    averageAssignmentScore: number;
    averageAttendanceMinutes: number;
    attendanceScore: number;
    overallScore: number;
    gradedAssignmentCount: number;
  };
}

interface CourseOption {
  _id: string;
  title: string;
  duration?: string | null;
  category?: string | null;
  fee?: number;
  trainerId?: {
    name?: string;
  } | null;
}

type EnrolmentStatusFilter = EnrolmentRow["status"] | "all";

const formatMeetingSchedule = (value: unknown) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

const getMeetingScheduleStatus = (value: unknown): "upcoming" | "past" | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime() >= Date.now() ? "upcoming" : "past";
};

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [selectedCourseForPayment, setSelectedCourseForPayment] = useState<CourseOption | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [enrolledSearch, setEnrolledSearch] = useState("");
  const [enrolledStatusFilter, setEnrolledStatusFilter] = useState<EnrolmentStatusFilter>("all");
  const [enrolledCategoryFilter, setEnrolledCategoryFilter] = useState("all");
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [discoverCategoryFilter, setDiscoverCategoryFilter] = useState("all");

  const fetchDashboard = useCallback(async () => {
    const response = await API.get("/dashboard/student");
    return (response.data?.data || { enrolments: [], recentPayments: [] }) as StudentDashboardData;
  }, []);

  const fetchCourses = useCallback(async () => {
    const response = await API.get("/courses?isActive=true&limit=200");
    const list = response.data?.data?.courses;
    return Array.isArray(list) ? (list as CourseOption[]) : [];
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardData, courses] = await Promise.all([fetchDashboard(), fetchCourses()]);
      setData(dashboardData);
      setAvailableCourses(courses);
    } catch {
      setError("Failed to load your student dashboard.");
    } finally {
      setLoading(false);
    }
  }, [fetchCourses, fetchDashboard]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashboardData, courses] = await Promise.all([fetchDashboard(), fetchCourses()]);
      setData(dashboardData);
      setAvailableCourses(courses);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCourses, fetchDashboard]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const enrolledCourseIds = useMemo(() => {
    const ids = new Set<string>();
    (data?.enrolments || []).forEach((enrolment) => {
      if (enrolment.courseId?._id) ids.add(enrolment.courseId._id);
    });
    return ids;
  }, [data]);

  const discoverCourses = useMemo(
    () => availableCourses.filter((course) => !enrolledCourseIds.has(course._id)),
    [availableCourses, enrolledCourseIds]
  );

  const enrolledCategories = useMemo(() => {
    const categories = (data?.enrolments || [])
      .map((enrolment) => (enrolment.courseId?.category || "").trim())
      .filter(Boolean);
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const discoverCategories = useMemo(() => {
    const categories = discoverCourses
      .map((course) => (course.category || "").trim())
      .filter(Boolean);
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  }, [discoverCourses]);

  const filteredEnrolments = useMemo(() => {
    const searchText = enrolledSearch.trim().toLowerCase();

    return (data?.enrolments || []).filter((enrolment) => {
      const title = (enrolment.courseId?.title || "").toLowerCase();
      const category = (enrolment.courseId?.category || "").toLowerCase();
      const duration = (enrolment.courseId?.duration || "").toLowerCase();

      if (enrolledStatusFilter !== "all" && enrolment.status !== enrolledStatusFilter) return false;
      if (enrolledCategoryFilter !== "all" && (enrolment.courseId?.category || "") !== enrolledCategoryFilter) return false;
      if (!searchText) return true;

      return title.includes(searchText) || category.includes(searchText) || duration.includes(searchText);
    });
  }, [data, enrolledCategoryFilter, enrolledSearch, enrolledStatusFilter]);

  const filteredDiscoverCourses = useMemo(() => {
    const searchText = discoverSearch.trim().toLowerCase();

    return discoverCourses.filter((course) => {
      const title = (course.title || "").toLowerCase();
      const category = (course.category || "").toLowerCase();
      const duration = (course.duration || "").toLowerCase();
      const trainer = (course.trainerId?.name || "").toLowerCase();

      if (discoverCategoryFilter !== "all" && (course.category || "") !== discoverCategoryFilter) return false;
      if (!searchText) return true;

      return title.includes(searchText) || category.includes(searchText) || duration.includes(searchText) || trainer.includes(searchText);
    });
  }, [discoverCategoryFilter, discoverCourses, discoverSearch]);

  const activeCount = (data?.enrolments || []).filter((e) => e.status === "active").length;
  const completedCount = (data?.enrolments || []).filter((e) => e.status === "completed").length;
  const fallbackAvgProgress =
    (data?.enrolments || []).length > 0
      ? Number(
          (
            (data?.enrolments || []).reduce((sum, enrolment) => sum + Number(enrolment.progress || 0), 0) /
            (data?.enrolments || []).length
          ).toFixed(1)
        )
      : 0;
  const fallbackCompletionRate =
    (data?.enrolments || []).length > 0
      ? Number(((completedCount / (data?.enrolments || []).length) * 100).toFixed(1))
      : 0;
  const avgProgress = Number(data?.performance?.averageProgress ?? fallbackAvgProgress);
  const completionRate = Number(data?.performance?.completionRate ?? fallbackCompletionRate);
  const averageQuizScore = Number(data?.performance?.averageQuizScore ?? 0);
  const averageAssignmentScore = Number(data?.performance?.averageAssignmentScore ?? 0);
  const averageAttendanceMinutes = Number(data?.performance?.averageAttendanceMinutes ?? 0);
  const overallPerformanceScore = Number(data?.performance?.overallScore ?? 0);
  const totalSpent = (data?.recentPayments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const liveClassLinks = useMemo(
    () =>
      (data?.enrolments || [])
        .filter((enrolment) => enrolment.status === "active" && Boolean(enrolment.courseId?.meetingLink))
        .map((enrolment) => ({
          enrolmentId: enrolment._id,
          courseId: enrolment.courseId?._id || "",
          courseTitle: enrolment.courseId?.title || "Course",
          meetingLink: String(enrolment.courseId?.meetingLink || ""),
          meetingScheduledAt: enrolment.courseId?.meetingScheduledAt || null,
        })),
    [data]
  );

  const openEnrollPaymentModal = (course: CourseOption) => {
    setActionError("");
    setActionSuccess("");
    setSelectedCourseForPayment(course);
  };

  const closePaymentModal = () => {
    if (paymentLoading) return;
    setSelectedCourseForPayment(null);
  };

  const completeFreeEnroll = async (course: CourseOption) => {
    setEnrollingCourseId(course._id);
    try {
      await API.post("/enrolments", { courseId: course._id });
      setActionSuccess("Enrolled successfully.");
      setSelectedCourseForPayment(null);
      await refreshData();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(message || "Failed to enroll in this course.");
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const startRazorpayEnrollment = async () => {
    if (!selectedCourseForPayment) return;

    setActionError("");
    setActionSuccess("");
    setPaymentLoading(true);
    setEnrollingCourseId(selectedCourseForPayment._id);

    try {
      const amount = Number(selectedCourseForPayment.fee || 0);
      if (amount <= 0) {
        await completeFreeEnroll(selectedCourseForPayment);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout script.");
      }

      const orderResponse = await API.post("/payments/razorpay/order", {
        courseId: selectedCourseForPayment._id,
      });

      const payload = orderResponse.data?.data as
        | {
            keyId: string;
            order: { id: string; amount: number; currency: string };
            student?: { name?: string; email?: string };
            course?: { title?: string };
          }
        | undefined;

      if (!payload?.keyId || !payload?.order?.id) {
        throw new Error("Invalid Razorpay order response.");
      }

      await new Promise<void>((resolve, reject) => {
        const RazorpayCtor = window.Razorpay;
        if (!RazorpayCtor) {
          reject(new Error("Razorpay checkout is unavailable."));
          return;
        }

        const razorpay = new RazorpayCtor({
          key: payload.keyId,
          amount: payload.order.amount,
          currency: payload.order.currency || "INR",
          name: "LMS",
          description: `Enroll in ${payload.course?.title || selectedCourseForPayment.title}`,
          order_id: payload.order.id,
          prefill: {
            name: payload.student?.name || "",
            email: payload.student?.email || "",
          },
          notes: {
            courseId: selectedCourseForPayment._id,
          },
          theme: {
            color: "#3b82f6",
          },
          handler: async (response: RazorpayHandlerResponse) => {
            try {
              await API.post("/payments/razorpay/verify-and-enroll", {
                courseId: selectedCourseForPayment._id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve();
            } catch (verificationError) {
              reject(verificationError);
            }
          },
        });

        razorpay.on("payment.failed", (failure) => {
          reject(failure);
        });

        razorpay.open();
      });

      setActionSuccess("Payment successful. Enrollment completed.");
      setSelectedCourseForPayment(null);
      await refreshData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { error?: { description?: string } })?.error?.description ||
        (err as { message?: string })?.message;
      setActionError(message || "Payment failed. Enrollment not completed.");
    } finally {
      setPaymentLoading(false);
      setEnrollingCourseId(null);
    }
  };

  const clearEnrolledFilters = () => {
    setEnrolledSearch("");
    setEnrolledStatusFilter("all");
    setEnrolledCategoryFilter("all");
  };

  const clearDiscoverFilters = () => {
    setDiscoverSearch("");
    setDiscoverCategoryFilter("all");
  };

  return (
    <ProtectedRoute role="student">
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Student Dashboard
          </h1>
          <button className="btn btn-ghost" onClick={refreshData} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading && <div className="spinner" />}
        {error && <div className="error-msg">{error}</div>}

        {!loading && data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
              <StatCard title="Enrolled" value={data.enrolments?.length || 0} icon="C" color="#3b82f6" />
              <StatCard title="Active" value={activeCount} icon="A" color="#16a34a" />
              <StatCard title="Completed" value={completedCount} icon="D" color="#6366f1" />
              <StatCard title="Avg Progress" value={`${avgProgress}%`} icon="G" color="#8b5cf6" />
              <StatCard title="Completion Rate" value={`${completionRate}%`} icon="R" color="#0ea5e9" />
              <StatCard title="Avg Quiz Score" value={`${averageQuizScore}%`} icon="Q" color="#22c55e" />
              <StatCard title="Assignment Score" value={`${averageAssignmentScore}%`} icon="M" color="#f97316" />
              <StatCard title="Meet Minutes" value={averageAttendanceMinutes} icon="T" color="#14b8a6" />
              <StatCard title="Overall Score" value={`${overallPerformanceScore}%`} icon="O" color="#ef4444" />
              <StatCard title="Recent Spend" value={`INR ${totalSpent.toLocaleString()}`} icon="P" color="#f59e0b" />
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 0 }}>Live Class Links</h3>
                <span className="badge badge-blue">Active Links: {liveClassLinks.length}</span>
              </div>

              {liveClassLinks.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>
                  No live class links available yet. Your trainer will add Google Meet links here.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                  {liveClassLinks.map((item) => {
                    const scheduleText = formatMeetingSchedule(item.meetingScheduledAt);
                    const scheduleStatus = getMeetingScheduleStatus(item.meetingScheduledAt);

                    return (
                      <div key={item.enrolmentId} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{item.courseTitle}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                          Schedule: {scheduleText || "Not scheduled yet"}
                          {scheduleStatus && (
                            <span
                              style={{
                                marginLeft: 8,
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 10,
                                fontWeight: 700,
                                color: scheduleStatus === "upcoming" ? "#166534" : "#92400e",
                                background: scheduleStatus === "upcoming" ? "#dcfce7" : "#fef3c7",
                              }}
                            >
                              {scheduleStatus === "upcoming" ? "Upcoming" : "Past"}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <a
                            href={item.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary"
                            style={{ textDecoration: "none", padding: "8px 12px", fontSize: 12 }}
                          >
                            Join Meet
                          </a>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "8px 12px", fontSize: 12 }}
                            onClick={() => router.push(`/admin/courses/${item.courseId}`)}
                            disabled={!item.courseId}
                          >
                            Open Course
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 0 }}>My Enrolled Courses</h3>
                <span className="badge badge-blue">Showing: {filteredEnrolments.length}/{data.enrolments?.length || 0}</span>
              </div>
              {data.enrolments?.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>You are not enrolled in any courses yet.</p>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
                    <input
                      className="input"
                      placeholder="Search course, category, duration"
                      value={enrolledSearch}
                      onChange={(e) => setEnrolledSearch(e.target.value)}
                    />
                    <select className="input" value={enrolledStatusFilter} onChange={(e) => setEnrolledStatusFilter(e.target.value as EnrolmentStatusFilter)}>
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="dropped">Dropped</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <select className="input" value={enrolledCategoryFilter} onChange={(e) => setEnrolledCategoryFilter(e.target.value)}>
                      <option value="all">All Categories</option>
                      {enrolledCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-ghost" onClick={clearEnrolledFilters}>
                      Clear
                    </button>
                  </div>

                  {filteredEnrolments.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No enrolled courses match your filters.</p>
                  ) : (
                    <div className="table-wrapper" style={{ boxShadow: "none", border: "1px solid #f1f5f9" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Category</th>
                            <th>Duration</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEnrolments.map((enrolment) => (
                            <tr key={enrolment._id}>
                              <td style={{ fontWeight: 700 }}>{enrolment.courseId?.title || "-"}</td>
                              <td>{enrolment.courseId?.category || "-"}</td>
                              <td>{enrolment.courseId?.duration || "-"}</td>
                              <td>
                                <div style={{ background: "#e2e8f0", borderRadius: 999, height: 8, width: 120 }}>
                                  <div style={{ background: "#3b82f6", borderRadius: 999, height: 8, width: `${Math.min(100, Math.max(0, enrolment.progress || 0))}%` }} />
                                </div>
                                <span style={{ fontSize: 12, color: "#64748b", marginTop: 4, display: "block" }}>{enrolment.progress || 0}%</span>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    enrolment.status === "active"
                                      ? "badge-green"
                                      : enrolment.status === "completed"
                                        ? "badge-blue"
                                        : "badge-red"
                                  }`}
                                >
                                  {enrolment.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ padding: "6px 10px", fontSize: 12 }}
                                    onClick={() => router.push(`/admin/courses/${enrolment.courseId?._id}`)}
                                    disabled={!enrolment.courseId?._id}
                                  >
                                    Open Course
                                  </button>
                                  {enrolment.courseId?.meetingLink && (
                                    <>
                                      <a
                                        href={enrolment.courseId.meetingLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary"
                                        style={{ padding: "6px 10px", fontSize: 12, textDecoration: "none" }}
                                      >
                                        Join Meet
                                      </a>
                                      {(() => {
                                        const scheduleText = formatMeetingSchedule(enrolment.courseId.meetingScheduledAt);
                                        const scheduleStatus = getMeetingScheduleStatus(enrolment.courseId.meetingScheduledAt);

                                        return (
                                          <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>
                                            {scheduleText || "Schedule pending"}
                                            {scheduleStatus ? ` (${scheduleStatus === "upcoming" ? "Upcoming" : "Past"})` : ""}
                                          </span>
                                        );
                                      })()}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 0 }}>Explore Courses</h3>
                <span className="badge badge-blue">Available: {filteredDiscoverCourses.length}/{discoverCourses.length}</span>
              </div>

              {actionError && <div className="error-msg" style={{ marginBottom: 12 }}>{actionError}</div>}
              {actionSuccess && <div className="success-msg" style={{ marginBottom: 12 }}>{actionSuccess}</div>}

              {discoverCourses.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No new active courses available right now.</p>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
                    <input
                      className="input"
                      placeholder="Search title, trainer, category"
                      value={discoverSearch}
                      onChange={(e) => setDiscoverSearch(e.target.value)}
                    />
                    <select className="input" value={discoverCategoryFilter} onChange={(e) => setDiscoverCategoryFilter(e.target.value)}>
                      <option value="all">All Categories</option>
                      {discoverCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-ghost" onClick={clearDiscoverFilters}>
                      Clear
                    </button>
                  </div>

                  {filteredDiscoverCourses.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No courses match your filters.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                      {filteredDiscoverCourses.map((course) => (
                        <div key={course._id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                          <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{course.title}</h4>
                          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                            {(course.category || "General") + " | " + (course.duration || "Duration not set")}
                          </p>
                          <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>
                            Trainer: <strong>{course.trainerId?.name || "Unassigned"}</strong>
                          </div>
                          <div style={{ fontSize: 13, color: "#334155", marginBottom: 12 }}>
                            Fee: <strong style={{ color: "#16a34a" }}>INR {(course.fee || 0).toLocaleString()}</strong>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "8px 12px", fontSize: 12 }}
                              onClick={() => openEnrollPaymentModal(course)}
                              disabled={paymentLoading || enrollingCourseId === course._id}
                            >
                              {enrollingCourseId === course._id ? "Processing..." : "Enroll"}
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: "8px 12px", fontSize: 12 }}
                              onClick={() => router.push(`/admin/courses/${course._id}`)}
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {data.recentPayments?.length > 0 && (
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Recent Payments</h3>
                <div className="table-wrapper" style={{ boxShadow: "none", border: "1px solid #f1f5f9" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPayments.map((payment) => (
                        <tr key={payment._id}>
                          <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 700, color: "#16a34a" }}>INR {(payment.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedCourseForPayment && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  zIndex: 1200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 14, padding: 22 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Complete Enrollment</h3>
                  <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
                    Course: <strong>{selectedCourseForPayment.title}</strong>
                  </p>
                  <div
                    style={{
                      marginBottom: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <p style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>Amount Payable</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                      INR {Number(selectedCourseForPayment.fee || 0).toLocaleString()}
                    </p>
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                      Payment Mode: Razorpay (Test Mode)
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={startRazorpayEnrollment}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? "Processing..." : Number(selectedCourseForPayment.fee || 0) > 0 ? "Pay & Enroll" : "Enroll"}
                    </button>
                    <button className="btn btn-ghost" onClick={closePaymentModal} disabled={paymentLoading}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
