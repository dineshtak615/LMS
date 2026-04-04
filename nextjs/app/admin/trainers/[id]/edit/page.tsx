"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function EditTrainerPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "",
    qualifications: "",
    isActive: "true",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    API.get(`/trainers/${id}`)
      .then((res) => {
        const trainer = res.data.data?.trainer || res.data.data;
        setForm({
          name: trainer.name || "",
          email: trainer.email || "",
          phone: trainer.phone || "",
          specialization: trainer.specialization || "",
          qualifications: trainer.qualifications || "",
          isActive: trainer.isActive ? "true" : "false",
        });
      })
      .catch(() => setError("Failed to load trainer."))
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
      await API.put(`/trainers/${id}`, { ...form, isActive: form.isActive === "true" });
      setSuccess("Trainer updated successfully!");
      setTimeout(() => router.push("/admin/trainers"), 1500);
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
              Edit Trainer
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
                    <label className="label">Status</label>
                    <select className="input" name="isActive" value={form.isActive} onChange={handleChange}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Specialization</label>
                  <input className="input" name="specialization" value={form.specialization} onChange={handleChange} placeholder="e.g. Data Science" />
                </div>
                <div className="form-group">
                  <label className="label">Qualifications</label>
                  <input className="input" name="qualifications" value={form.qualifications} onChange={handleChange} placeholder="e.g. M.Tech" />
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
