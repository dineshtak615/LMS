"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function EditStudentPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "",
    isActive: "true",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    API.get(`/students/${id}`)
      .then((res) => {
        const student = res.data.data?.student || res.data.data;
        setForm({
          name: student.name || "",
          email: student.email || "",
          phone: student.phone || "",
          address: student.address || "",
          dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split("T")[0] : "",
          gender: student.gender || "",
          isActive: student.isActive ? "true" : "false",
        });
      })
      .catch(() => setError("Failed to load student."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await API.put(`/students/${id}`, { ...form, isActive: form.isActive === "true" });
      setSuccess("Student updated successfully!");
      setTimeout(() => router.push("/admin/students"), 1500);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to update.");
    } finally {
      setSaving(false);
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
              Edit Student
            </h1>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="card">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="label">Full Name *</label>
                  <input className="input" name="name" value={form.name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="label">Email *</label>
                  <input className="input" name="email" type="email" value={form.email} onChange={handleChange} required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input className="input" name="phone" value={form.phone} onChange={handleChange} />
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
                  <div className="form-group">
                    <label className="label">Date of Birth</label>
                    <input className="input" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="label">Status</label>
                    <select className="input" name="isActive" value={form.isActive} onChange={handleChange}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Address</label>
                  <input className="input" name="address" value={form.address} onChange={handleChange} />
                </div>
                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, padding: 12 }}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => router.back()} style={{ padding: 12 }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
