"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function CreatePaymentPage() {
  const [form, setForm] = useState({ studentId: "", courseId: "", amount: "", method: "cash", transactionId: "", paymentDate: new Date().toISOString().split("T")[0], notes: "", receiptNumber: "" });
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([API.get("/students?limit=200"), API.get("/courses?limit=200")])
      .then(([s, c]) => { setStudents(s.data.data?.students || []); setCourses(c.data.data?.courses || []); });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.amount || Number(form.amount) <= 0) return setError("Enter a valid amount.");
    setLoading(true);
    try {
      await API.post("/payments", { ...form, amount: Number(form.amount) });
      setSuccess("Payment recorded successfully!");
      setTimeout(() => router.push("/admin/payments"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to record payment.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute role={["admin", "finance"]}>
      <DashboardLayout>
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>← Back</button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Record Payment</h1>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Student *</label>
                <select className="input" name="studentId" value={form.studentId} onChange={handleChange} required>
                  <option value="">-- Select Student --</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.email}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Course (optional)</label>
                <select className="input" name="courseId" value={form.courseId} onChange={handleChange}>
                  <option value="">-- Select Course --</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="label">Amount (₹) *</label>
                  <input className="input" name="amount" type="number" value={form.amount} onChange={handleChange} required min="1" placeholder="5000" />
                </div>
                <div className="form-group">
                  <label className="label">Payment Method</label>
                  <select className="input" name="method" value={form.method} onChange={handleChange}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Payment Date</label>
                  <input className="input" name="paymentDate" type="date" value={form.paymentDate} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Receipt Number</label>
                  <input className="input" name="receiptNumber" value={form.receiptNumber} onChange={handleChange} placeholder="RCP-001" />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Transaction ID</label>
                <input className="input" name="transactionId" value={form.transactionId} onChange={handleChange} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes" />
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Recording..." : "Record Payment"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => router.back()} style={{ padding: 12 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}