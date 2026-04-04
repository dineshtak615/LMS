"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function CreateTrainerPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "",
    qualifications: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await API.post("/trainers", form);
      setSuccess("Trainer created successfully!");
      setTimeout(() => router.push("/admin/trainers"), 1500);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to create trainer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>
              &lt;- Back
            </button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              Add Trainer
            </h1>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" name="name" value={form.name} onChange={handleChange} required placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="trainer@example.com" />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 555 000 0000" />
              </div>
              <div className="form-group">
                <label className="label">Specialization</label>
                <input className="input" name="specialization" value={form.specialization} onChange={handleChange} placeholder="e.g. Data Science, Web Development" />
              </div>
              <div className="form-group">
                <label className="label">Qualifications</label>
                <input className="input" name="qualifications" value={form.qualifications} onChange={handleChange} placeholder="e.g. M.Tech, B.E" />
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#475569" }}>
                If a trainer login user already exists with this email, it will link automatically.
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Creating..." : "Create Trainer"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => router.back()} style={{ padding: 12 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
