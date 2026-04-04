"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function IssueBookPage() {
  const [form, setForm] = useState({ itemId: "", studentId: "", dueDate: "", notes: "" });
  const [items, setItems] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([API.get("/library/items?limit=200"), API.get("/students?limit=200")])
      .then(([i, s]) => { setItems(i.data.data?.items || []); setStudents(s.data.data?.students || []); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await API.post("/library/issue", form);
      setSuccess("Item issued successfully!");
      setTimeout(() => router.push("/admin/library"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to issue item.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>← Back</button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Issue Library Item</h1>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Select Item *</label>
                <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} required>
                  <option value="">-- Select Item --</option>
                  {items.map((i) => <option key={i._id} value={i._id} disabled={i.availableCopies === 0}>{i.title} (Available: {i.availableCopies})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Select Student *</label>
                <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
                  <option value="">-- Select Student --</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.email}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Due Date *</label>
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required min={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Issuing..." : "Issue Item"}
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