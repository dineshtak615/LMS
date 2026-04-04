"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function CreateStudentPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await API.post("/students", form);
      setSuccess("Student created successfully!");
      setTimeout(() => router.push("/admin/students"), 1500);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to create student.");
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
              Add Student
            </h1>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" name="name" value={form.name} onChange={handleChange} required placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="john@example.com" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="label">Phone</label>
                  <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 555 000 0000" />
                </div>
                <div className="form-group">
                  <label className="label">Gender</label>
                  <select className="input" name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Date of Birth</label>
                <input className="input" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="label">Address</label>
                <input className="input" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St, City" />
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#475569" }}>
                If a student login user already exists with this email, it will link automatically.
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Creating..." : "Create Student"}
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
