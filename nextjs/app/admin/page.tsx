"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ClickableStatCard from "@/components/ClickableStatCard";
import API from "@/services/api";

type DashboardStats = {
  totalStudents: number;
  activeStudents: number;
  totalTrainers: number;
  totalCourses: number;
  activeCourses: number;
  activeEnrolments: number;
  totalRevenue: number;
};

type PaymentItem = {
  _id: string;
  amount: number;
  paymentDate: string;
  studentId?: {
    name?: string;
  } | null;
};

type DashboardData = {
  stats: DashboardStats;
  recentPayments: PaymentItem[];
};

type CourseAnalyticsItem = {
  _id: string;
  courseTitle: string;
  totalEnrolments: number;
  completed: number;
  active: number;
  avgProgress: number;
  completionRate: number;
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [courseAnalytics, setCourseAnalytics] = useState<CourseAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      API.get("/dashboard/admin"),
      API.get("/analytics/courses"),
    ])
      .then(([dashboardRes, analyticsRes]) => {
        setData(dashboardRes.data.data || null);
        setCourseAnalytics(analyticsRes.data.data?.courseStats || []);
      })
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const totalEnrolments = courseAnalytics.reduce((sum, item) => sum + Number(item.totalEnrolments || 0), 0);
  const weightedCompletion = courseAnalytics.reduce(
    (sum, item) => sum + Number(item.completionRate || 0) * Number(item.totalEnrolments || 0),
    0
  );
  const weightedProgress = courseAnalytics.reduce(
    (sum, item) => sum + Number(item.avgProgress || 0) * Number(item.totalEnrolments || 0),
    0
  );

  const overallCompletionRate = totalEnrolments > 0 ? Number((weightedCompletion / totalEnrolments).toFixed(1)) : 0;
  const overallProgress = totalEnrolments > 0 ? Number((weightedProgress / totalEnrolments).toFixed(1)) : 0;
  const lowPerformingCourses = courseAnalytics.filter((item) => Number(item.completionRate || 0) < 40).length;
  const topCourses = [...courseAnalytics]
    .sort((a, b) => Number(b.totalEnrolments || 0) - Number(a.totalEnrolments || 0))
    .slice(0, 5);

  const quickLinks = [
    { label: "Add Student", href: "/admin/users/create?role=student&next=%2Fadmin%2Fstudents", icon: "+ ST" },
    { label: "Add Trainer", href: "/admin/users/create?role=trainer&next=%2Fadmin%2Ftrainers", icon: "+ TR" },
    { label: "Add Course", href: "/admin/courses/create", icon: "+ CO" },
    { label: "New Enrolment", href: "/admin/enrolments/create", icon: "EN" },
    { label: "Record Payment", href: "/admin/payments/create", icon: "PA" },
    { label: "Issue Book", href: "/admin/library/issue", icon: "BK" },
  ];

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <h1 className="page-title">Admin Dashboard</h1>

        {loading && <div className="spinner" />}
        {error && <div className="error-msg">{error}</div>}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
              <ClickableStatCard title="Total Students" value={data.stats.totalStudents} icon="ST" color="#3b82f6" href="/admin/students" />
              <ClickableStatCard title="Active Students" value={data.stats.activeStudents} icon="AS" color="#22c55e" href="/admin/students" />
              <ClickableStatCard title="Trainers" value={data.stats.totalTrainers} icon="TR" color="#f59e0b" href="/admin/trainers" />
              <ClickableStatCard title="Active Courses" value={data.stats.activeCourses} icon="CO" color="#8b5cf6" href="/admin/courses" />
              <ClickableStatCard title="Enrolments" value={data.stats.activeEnrolments} icon="EN" color="#06b6d4" href="/admin/enrolments" />
              <ClickableStatCard title="Total Revenue" value={`INR ${(data.stats.totalRevenue || 0).toLocaleString()}`} icon="RV" color="#10b981" href="/admin/payments" />
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 0 }}>Performance Overview</h3>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => router.push("/admin/analytics")}>
                  Open Analytics
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Overall Completion Rate</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{overallCompletionRate}%</div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Average Progress</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{overallProgress}%</div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Courses Below 40%</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{lowPerformingCourses}</div>
                </div>
              </div>

              {topCourses.length > 0 ? (
                <div className="table-wrapper" style={{ boxShadow: "none", border: "1px solid #f1f5f9" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Enrolments</th>
                        <th>Completion</th>
                        <th>Avg Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCourses.map((course) => (
                        <tr key={course._id}>
                          <td style={{ fontWeight: 600 }}>{course.courseTitle}</td>
                          <td>{course.totalEnrolments}</td>
                          <td>{course.completionRate}%</td>
                          <td>{course.avgProgress}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#94a3b8" }}>No performance data yet.</p>
              )}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
                {quickLinks.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => router.push(link.href)}
                    className="btn btn-ghost"
                    style={{ padding: "14px 12px", textAlign: "center", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 18 }}>{link.icon}</span>
                    <span>{link.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {data.recentPayments?.length > 0 && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Payments</h3>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => router.push("/admin/payments")}>
                    View All
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Student</th>
                      <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.map((payment) => (
                      <tr key={payment._id}>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: 14 }}>{payment.studentId?.name || "-"}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontWeight: 700, color: "#16a34a" }}>INR {Number(payment.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#64748b" }}>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
