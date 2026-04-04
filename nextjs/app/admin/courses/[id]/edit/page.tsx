"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API from "@/services/api";

interface TrainerOption {
  _id: string;
  name: string;
  specialization?: string | null;
}

export default function EditCoursePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: "",
    fee: "",
    trainerId: "",
    category: "",
    startDate: "",
    endDate: "",
    maxEnrolments: "",
    isActive: "true",
  });
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [enrolmentCount, setEnrolmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    if (!id || authLoading || user?.role !== "admin") return;

    Promise.all([API.get(`/courses/${id}`), API.get("/trainers?limit=100"), API.get(`/enrolments?courseId=${id}&limit=1`)])
      .then(([c, t, e]) => {
        const course = c.data.data?.course || c.data.data;
        setForm({
          title: course.title || "",
          description: course.description || "",
          duration: course.duration || "",
          fee: String(course.fee || ""),
          trainerId: course.trainerId?._id || course.trainerId || "",
          category: course.category || "",
          startDate: course.startDate ? course.startDate.split("T")[0] : "",
          endDate: course.endDate ? course.endDate.split("T")[0] : "",
          maxEnrolments: course.maxEnrolments ? String(course.maxEnrolments) : "",
          isActive: course.isActive ? "true" : "false",
        });
        setTrainers(t.data.data?.trainers || []);
        setEnrolmentCount(e.data.data?.pagination?.total || 0);
      })
      .catch(() => setError("Failed to load course."))
      .finally(() => setLoading(false));
  }, [id, authLoading, user?.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await API.put(`/courses/${id}`, {
        ...form,
        fee: Number(form.fee) || 0,
        maxEnrolments: form.maxEnrolments ? Number(form.maxEnrolments) : undefined,
        isActive: form.isActive === "true",
      });
      setSuccess("Course updated successfully!");
      setTimeout(() => router.push("/admin/courses"), 1500);
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
        <div style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>
              &lt;- Back
            </button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              Edit Course
            </h1>
            {enrolmentCount > 0 && (
              <span className="badge badge-blue" style={{ marginLeft: "auto" }}>
                Enrolled: {enrolmentCount}
              </span>
            )}
          </div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="card">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="label">Course Title *</label>
                  <input className="input" name="title" value={form.title} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="label">Description</label>
                  <textarea className="input" name="description" value={form.description} onChange={handleChange} rows={3} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label className="label">Duration</label>
                    <input className="input" name="duration" value={form.duration} onChange={handleChange} placeholder="e.g. 3 months" />
                  </div>
                  <div className="form-group">
                    <label className="label">Fee (INR)</label>
                    <input className="input" name="fee" type="number" value={form.fee} onChange={handleChange} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="label">Category</label>
                    <input className="input" name="category" value={form.category} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="label">Max Enrolments</label>
                    <input className="input" name="maxEnrolments" type="number" value={form.maxEnrolments} onChange={handleChange} placeholder="No limit" min="1" />
                  </div>
                  <div className="form-group">
                    <label className="label">Start Date</label>
                    <input className="input" name="startDate" type="date" value={form.startDate} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="label">End Date</label>
                    <input className="input" name="endDate" type="date" value={form.endDate} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Assign Trainer</label>
                  <select className="input" name="trainerId" value={form.trainerId} onChange={handleChange}>
                    <option value="">-- No Trainer --</option>
                    {trainers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} - {t.specialization || "General"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="input" name="isActive" value={form.isActive} onChange={handleChange}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
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
