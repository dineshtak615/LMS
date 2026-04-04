"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function CreateEnrolmentPage() {
  const [form, setForm] = useState({ studentId: "", courseId: "", notes: "" });
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      API.get("/students?limit=200"),
      API.get("/courses?limit=200&isActive=true"),
      API.get("/enrolments?limit=20"),
    ]).then(([s, c, e]) => {
      setStudents(s.data.data?.students || []);
      setCourses(c.data.data?.courses || []);
      setEnrolments(e.data.data?.enrolments || []);
    });
  }, []);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(""); setSuccess("");
    if (!form.studentId || !form.courseId) return setError("Please select both a student and a course.");
    setLoading(true);
    try {
      const response = await API.post("/enrolments", form);
      setSuccess(response.data?.message || "Student enrolled successfully!");
      const e = await API.get("/enrolments?limit=20");
      setEnrolments(e.data.data?.enrolments || []);
      setForm({ studentId: "", courseId: "", notes: "" });
    } catch (err: any) {
      setError(err.response?.data?.message || "Enrolment failed.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <h1 className="page-title">Enrolments</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
          {/* Form */}
          <div className="card" style={{ alignSelf: "start" }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>New Enrolment</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Select Student *</label>
                <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
                  <option value="">-- Select Student --</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.email}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Select Course *</label>
                <select className="input" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
                  <option value="">-- Select Course --</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.title} {c.fee ? `— ₹${c.fee}` : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: 12 }}>
                {loading ? "Enrolling..." : "Enrol Student"}
              </button>
            </form>
          </div>

          {/* Recent Enrolments */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Student</th><th>Course</th><th>Status</th><th>Progress</th></tr>
              </thead>
              <tbody>
                {enrolments.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>No enrolments yet.</td></tr>
                ) : enrolments.map((e) => (
                  <tr key={e._id}>
                    <td><strong>{e.studentId?.name || "—"}</strong></td>
                    <td>{e.courseId?.title || "—"}</td>
                    <td><span className={`badge ${e.status === "active" ? "badge-green" : e.status === "completed" ? "badge-blue" : "badge-red"}`}>{e.status}</span></td>
                    <td>{e.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
