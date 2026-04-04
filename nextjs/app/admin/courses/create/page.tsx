"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API from "@/services/api";

export default function CreateCoursePage() {
  const { user, isLoading } = useAuth();
  const [form, setForm] = useState({
    title: "", description: "", duration: "", fee: "",
    trainerId: "", category: "", startDate: "", endDate: "", maxEnrolments: "",
  });
  const [trainers, setTrainers] = useState<any[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.role !== "admin") return;

    API.get("/trainers?limit=100")
      .then((res) => {
        const d = res.data.data;
        const list = Array.isArray(d?.trainers) ? d.trainers : [];
        setTrainers(list);
      })
      .catch(() => {
        setError("Failed to load trainers.");
      });
  }, [isLoading, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("fee", String(Number(form.fee) || 0));
      if (form.duration)      formData.append("duration",      form.duration);
      if (form.trainerId)     formData.append("trainerId",     form.trainerId);
      if (form.category)      formData.append("category",      form.category);
      if (form.startDate)     formData.append("startDate",     form.startDate);
      if (form.endDate)       formData.append("endDate",       form.endDate);
      if (form.maxEnrolments) formData.append("maxEnrolments", String(form.maxEnrolments));
      if (videoFile)          formData.append("video",         videoFile);
      if (pdfFile)            formData.append("pdf",           pdfFile);

      const created = await API.post("/courses", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Course created successfully! Redirecting...");

      setTimeout(() => {
        const dest = user?.role === "trainer" ? "/trainer" : "/admin/courses";
        if (dest === "/trainer") {
          const createdCourse = created.data?.data?.course;
          if (createdCourse?._id) {
            sessionStorage.setItem("trainerDashboard:newCourse", JSON.stringify(createdCourse));
          }
          window.location.href = `/trainer?updated=${Date.now()}`;
          return;
        }
        router.push(dest);
        router.refresh();
      }, 1500);

    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create course.");
    } finally { setLoading(false); }
  };

  const isTrainer = user?.role === "trainer";

  return (
    <ProtectedRoute role={["admin", "trainer"]}>
      <DashboardLayout>
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>← Back</button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Add Course</h1>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Course Title *</label>
                <input className="input" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Full Stack Web Development" />
              </div>

              <div className="form-group">
                <label className="label">Description</label>
                <textarea className="input" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Course description..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="label">Duration</label>
                  <input className="input" name="duration" value={form.duration} onChange={handleChange} placeholder="e.g. 3 months" />
                </div>
                <div className="form-group">
                  <label className="label">Fee (₹)</label>
                  <input className="input" name="fee" type="number" value={form.fee} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="label">Category</label>
                  <input className="input" name="category" value={form.category} onChange={handleChange} placeholder="e.g. Technology" />
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
                {isTrainer ? (
                  <div style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 14, color: "#166534", fontWeight: 600 }}>
                    👨‍🏫 {user?.name} (You — auto assigned)
                  </div>
                ) : (
                  <select className="input" name="trainerId" value={form.trainerId} onChange={handleChange}>
                    <option value="">-- Select Trainer --</option>
                    {trainers.map((t) => (
                      <option key={t._id} value={t._id}>{t.name} — {t.specialization || "General"}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="label">Course Video (MP4, MOV, etc.)</label>
                <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="input" />
                {videoFile && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>✅ {videoFile.name}</p>}
              </div>

              <div className="form-group">
                <label className="label">Course PDF (syllabus, notes, etc.)</label>
                <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="input" />
                {pdfFile && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>✅ {pdfFile.name}</p>}
              </div>

              {error   && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Creating..." : "Create Course"}
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
