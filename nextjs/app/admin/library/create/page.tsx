"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function CreateLibraryItemPage() {
  const [form, setForm] = useState({ title: "", author: "", category: "", type: "book", isbn: "", totalCopies: "1" });
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("author", form.author);
      formData.append("category", form.category);
      formData.append("type", form.type);
      formData.append("isbn", form.isbn);
      formData.append("totalCopies", String(Number(form.totalCopies) || 1));
      if (bookFile) formData.append("bookFile", bookFile);

      await API.post("/library/items", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setSuccess("Library item added!");
      setTimeout(() => router.push("/admin/library"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add item.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>← Back</button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Add Library Item</h1>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Title *</label>
                <input className="input" name="title" value={form.title} onChange={handleChange} required placeholder="Book title" />
              </div>
              <div className="form-group">
                <label className="label">Author</label>
                <input className="input" name="author" value={form.author} onChange={handleChange} placeholder="Author name" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label className="label">Type</label>
                  <select className="input" name="type" value={form.type} onChange={handleChange}>
                    <option value="book">Book</option>
                    <option value="journal">Journal</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Total Copies</label>
                  <input className="input" name="totalCopies" type="number" min="1" value={form.totalCopies} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Category</label>
                  <input className="input" name="category" value={form.category} onChange={handleChange} placeholder="e.g. Science" />
                </div>
                <div className="form-group">
                  <label className="label">ISBN</label>
                  <input className="input" name="isbn" value={form.isbn} onChange={handleChange} placeholder="Optional" />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Book File (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="input"
                  onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                />
                {bookFile && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 5 }}>Selected: {bookFile.name}</p>}
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Adding..." : "Add Item"}
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
