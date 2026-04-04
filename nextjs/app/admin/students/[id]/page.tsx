"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

interface StudentProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface EnrolmentRow {
  _id: string;
  status: "active" | "completed" | "dropped";
  progress?: number;
  courseId?: { title?: string | null } | null;
}

interface PaymentRow {
  _id: string;
  paymentDate: string;
  amount?: number;
  method?: string;
  status?: string;
}

export default function StudentProfilePage() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    Promise.all([API.get(`/students/${id}`), API.get(`/enrolments?studentId=${id}&limit=50`), API.get(`/payments?studentId=${id}&limit=20`)])
      .then(([studentRes, enrolmentsRes, paymentsRes]) => {
        setStudent(studentRes.data.data?.student || studentRes.data.data || null);
        setEnrolments(enrolmentsRes.data.data?.enrolments || []);
        setPayments(paymentsRes.data.data?.payments || []);
      })
      .catch(() => setError("Failed to load student profile."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ProtectedRoute role={["admin", "trainer", "finance"]}>
        <DashboardLayout>
          <div className="spinner" />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute role={["admin", "trainer", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>
            &lt;- Back
          </button>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Student Profile
          </h1>
          <button className="btn btn-primary" onClick={() => router.push(`/admin/students/${id}/edit`)} style={{ marginLeft: "auto", padding: "8px 20px" }}>
            Edit
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {student && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
            <div>
              <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 32,
                    margin: "0 auto 16px",
                  }}
                >
                  {student.name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{student.name}</h2>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>{student.email}</p>
                <span className={`badge ${student.isActive ? "badge-green" : "badge-red"}`}>{student.isActive ? "Active" : "Inactive"}</span>
              </div>

              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                  Details
                </h3>
                {[
                  ["Phone", student.phone || "-"],
                  ["Gender", student.gender || "-"],
                  ["Date of Birth", student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "-"],
                  ["Address", student.address || "-"],
                  ["Joined", new Date(student.createdAt).toLocaleDateString()],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "#64748b", flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Enrolled Courses ({enrolments.length})</h3>
                {enrolments.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>No enrolments yet.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Course</th>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolments.map((item) => (
                        <tr key={item._id}>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: 14 }}>{item.courseId?.title || "-"}</td>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                            <span className={`badge ${item.status === "active" ? "badge-green" : item.status === "completed" ? "badge-blue" : "badge-red"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ background: "#e2e8f0", borderRadius: 999, height: 8, width: 100 }}>
                              <div style={{ background: "#3b82f6", borderRadius: 999, height: 8, width: `${item.progress || 0}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#64748b" }}>{item.progress || 0}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Payment History ({payments.length})</h3>
                {payments.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>No payments recorded.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Date</th>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Amount</th>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Method</th>
                        <th style={{ textAlign: "left", padding: "8px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment._id}>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontWeight: 700, color: "#16a34a" }}>
                            INR {payment.amount?.toLocaleString()}
                          </td>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                            {payment.method?.replace("_", " ")}
                          </td>
                          <td style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                            <span className={`badge ${payment.status === "completed" ? "badge-green" : "badge-yellow"}`}>{payment.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
