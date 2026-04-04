"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import API from "@/services/api";
import { useAuth } from "@/context/AuthContext";

type OverviewData = {
  students: {
    thisMonth: number;
    lastMonth: number;
    growth: number | string;
  };
  enrolments: {
    thisMonth: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
  };
  enrolmentByStatus: Array<{
    _id: string;
    count: number;
  }>;
};

type RevenueDataPoint = {
  _id: {
    year: number;
    month: number;
  };
  total: number;
  count: number;
};

type CourseStat = {
  _id: string;
  courseTitle: string;
  totalEnrolments: number;
  active: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
};

type StudentPerformanceStat = {
  _id: string;
  studentName: string;
  studentEmail: string;
  totalEnrolments: number;
  activeEnrolments: number;
  completedEnrolments: number;
  droppedEnrolments: number;
  suspendedEnrolments: number;
  averageProgress: number;
  completionRate: number;
  averageQuizScore: number;
  averageAttendanceMinutes: number;
  attendanceScore: number;
  overallScore: number;
  lastActivityAt?: string | null;
};

type TrainerPerformanceStat = {
  _id: string;
  trainerName: string;
  trainerEmail: string;
  specialization?: string | null;
  totalCourses: number;
  activeCourses: number;
  publishedCourses: number;
  totalStudents: number;
  totalEnrolments: number;
  activeEnrolments: number;
  completedEnrolments: number;
  droppedEnrolments: number;
  suspendedEnrolments: number;
  averageProgress: number;
  completionRate: number;
  averageQuizScore: number;
  averageAttendanceMinutes: number;
  attendanceScore: number;
  overallScore: number;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [studentsPerformance, setStudentsPerformance] = useState<StudentPerformanceStat[]>([]);
  const [trainersPerformance, setTrainersPerformance] = useState<TrainerPerformanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!user) return;

    let isActive = true;
    setLoading(true);
    setError("");

    const loadAnalytics = async () => {
      const [overviewResult, revenueResult, coursesResult, studentsResult, trainersResult] = await Promise.allSettled([
        API.get("/analytics/overview"),
        API.get("/analytics/revenue?months=6"),
        user.role === "admin" ? API.get("/analytics/courses") : Promise.resolve(null),
        user.role === "admin" ? API.get("/analytics/students-performance?limit=15") : Promise.resolve(null),
        user.role === "admin" ? API.get("/analytics/trainers-performance?limit=15") : Promise.resolve(null),
      ]);

      let hasCriticalError = false;

      if (overviewResult.status === "fulfilled") {
        if (isActive) setOverview(overviewResult.value.data.data || null);
      } else {
        hasCriticalError = true;
      }

      if (revenueResult.status === "fulfilled") {
        if (isActive) setRevenue(revenueResult.value.data.data?.revenueData || []);
      } else {
        hasCriticalError = true;
      }

      if (coursesResult.status === "fulfilled") {
        if (isActive) {
          if (user.role === "admin") {
            setCourses(coursesResult.value?.data?.data?.courseStats || []);
          } else {
            setCourses([]);
          }
        }
      } else if (isActive) {
        setCourses([]);
      }

      if (studentsResult.status === "fulfilled") {
        if (isActive) {
          if (user.role === "admin") {
            setStudentsPerformance(studentsResult.value?.data?.data?.studentStats || []);
          } else {
            setStudentsPerformance([]);
          }
        }
      } else if (isActive) {
        setStudentsPerformance([]);
      }

      if (trainersResult.status === "fulfilled") {
        if (isActive) {
          if (user.role === "admin") {
            setTrainersPerformance(trainersResult.value?.data?.data?.trainerStats || []);
          } else {
            setTrainersPerformance([]);
          }
        }
      } else if (isActive) {
        setTrainersPerformance([]);
      }

      if (isActive && hasCriticalError) {
        setError("Failed to load analytics.");
      }

      if (isActive) {
        setLoading(false);
      }
    };

    loadAnalytics();

    return () => {
      isActive = false;
    };
  }, [user]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatPercent = (value: number | string | null | undefined, decimals = 1) => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return "0%";
    return `${numericValue.toFixed(decimals)}%`;
  };
  const getScoreBadgeClass = (score: number) => {
    if (score >= 75) return "badge-green";
    if (score >= 50) return "badge-yellow";
    return "badge-red";
  };
  const formatLastActivity = (value?: string | null) => {
    if (!value) return "--";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return "--";
    return parsedDate.toLocaleDateString();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setExportError("");

    try {
      const response = await API.get("/analytics/export/csv?months=6", { responseType: "blob" });
      const contentDisposition = String(response.headers?.["content-disposition"] || "");
      const matchedName = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = matchedName?.[1] || "analytics-export.csv";

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.setAttribute("download", filename);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      setExportError("Failed to export analytics CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProtectedRoute role={["admin", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Analytics</h1>
          <button className="btn btn-primary" onClick={handleExportCsv} disabled={exporting || loading}>
            {exporting ? "Exporting..." : "Export Excel (CSV)"}
          </button>
        </div>

        {loading && <div className="spinner" />}
        {error && <div className="error-msg">{error}</div>}
        {exportError && <div className="error-msg">{exportError}</div>}

        {overview && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
              <StatCard title="New Students (This Month)" value={overview.students.thisMonth} icon="Students" color="#3b82f6" subtitle={`Last month: ${overview.students.lastMonth}`} />
              <StatCard title="New Enrolments" value={overview.enrolments.thisMonth} icon="Enrolments" color="#8b5cf6" />
              <StatCard title="Revenue This Month" value={`Rs ${Number(overview.revenue.thisMonth || 0).toLocaleString()}`} icon="Revenue" color="#22c55e" subtitle={`Last month: Rs ${Number(overview.revenue.lastMonth || 0).toLocaleString()}`} />
              <StatCard title="Student Growth" value={`${overview.students.growth}%`} icon="Growth" color="#f59e0b" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Enrolment by Status</h3>
                {overview.enrolmentByStatus.map((s) => (
                  <div key={s._id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{s._id}</span>
                    <strong>{s.count}</strong>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Monthly Revenue</h3>
                {revenue.length === 0 ? <p style={{ color: "#94a3b8" }}>No revenue data.</p> :
                  revenue.map((r) => (
                    <div key={`${r._id.year}-${r._id.month}`} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span>{months[r._id.month - 1]} {r._id.year}</span>
                      <strong style={{ color: "#16a34a" }}>Rs {Number(r.total || 0).toLocaleString()}</strong>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {courses.length > 0 && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Course Performance</h3>
            <div className="table-wrapper" style={{ boxShadow: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr><th>Course</th><th>Enrolments</th><th>Active</th><th>Completed</th><th>Completion Rate</th><th>Avg Progress</th></tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c._id}>
                      <td><strong>{c.courseTitle}</strong></td>
                      <td>{c.totalEnrolments}</td>
                      <td>{c.active}</td>
                      <td>{c.completed}</td>
                      <td><span className={`badge ${c.completionRate >= 70 ? "badge-green" : c.completionRate >= 40 ? "badge-yellow" : "badge-red"}`}>{c.completionRate}%</span></td>
                      <td>{c.avgProgress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {user?.role === "admin" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginTop: courses.length > 0 ? 24 : 0 }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Trainer Performance</h3>
              {trainersPerformance.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No trainer performance data yet.</p>
              ) : (
                <div className="table-wrapper" style={{ boxShadow: "none", borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Trainer</th>
                        <th>Overall</th>
                        <th>Completion</th>
                        <th>Progress</th>
                        <th>Quiz</th>
                        <th>Attendance</th>
                        <th>Courses</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainersPerformance.map((trainer, index) => (
                        <tr key={trainer._id}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{trainer.trainerName}</strong>
                            <div style={{ color: "#64748b", fontSize: 12 }}>{trainer.trainerEmail || "--"}</div>
                          </td>
                          <td>
                            <span className={`badge ${getScoreBadgeClass(trainer.overallScore)}`}>{formatPercent(trainer.overallScore)}</span>
                          </td>
                          <td>{formatPercent(trainer.completionRate)}</td>
                          <td>{formatPercent(trainer.averageProgress)}</td>
                          <td>{formatPercent(trainer.averageQuizScore)}</td>
                          <td>{Math.round(Number(trainer.averageAttendanceMinutes || 0))} min</td>
                          <td>{trainer.totalCourses}</td>
                          <td>{trainer.totalStudents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Student Performance</h3>
              {studentsPerformance.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No student performance data yet.</p>
              ) : (
                <div className="table-wrapper" style={{ boxShadow: "none", borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>Overall</th>
                        <th>Completion</th>
                        <th>Progress</th>
                        <th>Quiz</th>
                        <th>Attendance</th>
                        <th>Enrolments</th>
                        <th>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsPerformance.map((student, index) => (
                        <tr key={student._id}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{student.studentName}</strong>
                            <div style={{ color: "#64748b", fontSize: 12 }}>{student.studentEmail || "--"}</div>
                          </td>
                          <td>
                            <span className={`badge ${getScoreBadgeClass(student.overallScore)}`}>{formatPercent(student.overallScore)}</span>
                          </td>
                          <td>{formatPercent(student.completionRate)}</td>
                          <td>{formatPercent(student.averageProgress)}</td>
                          <td>{formatPercent(student.averageQuizScore)}</td>
                          <td>{Math.round(Number(student.averageAttendanceMinutes || 0))} min</td>
                          <td>
                            {student.totalEnrolments} total / {student.completedEnrolments} done
                          </td>
                          <td>{formatLastActivity(student.lastActivityAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
