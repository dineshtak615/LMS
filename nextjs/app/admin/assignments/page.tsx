"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import API, { resolveAssetUrl } from "@/services/api";

interface CourseItem {
  _id: string;
  title?: string;
}

interface UserLite {
  _id: string;
  name?: string;
  email?: string;
}

interface SubmissionItem {
  _id: string;
  studentId?: UserLite | null;
  submittedAt?: string;
  textAnswer?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  status: "submitted" | "graded" | "returned";
  grade?: number | null;
  feedback?: string | null;
}

interface AssignmentItem {
  _id: string;
  title: string;
  description?: string | null;
  courseId?: CourseItem | null;
  dueDate?: string | null;
  maxMarks: number;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  submissionCount?: number;
  submissions?: SubmissionItem[];
  allowTextAnswer?: boolean;
  allowFileUpload?: boolean;
}

const initialForm = {
  title: "",
  description: "",
  courseId: "",
  dueDate: "",
  maxMarks: "100",
  allowTextAnswer: true,
  allowFileUpload: true,
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(initialForm);
  const [attachment, setAttachment] = useState<File | null>(null);

  const [gradeModal, setGradeModal] = useState<{
    assignmentId: string;
    submissionId: string;
    studentName: string;
    maxMarks: number;
  } | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", feedback: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignmentRes, courseRes] = await Promise.all([
        API.get("/assignments?limit=100"),
        API.get("/courses?limit=200"),
      ]);

      setAssignments(assignmentRes.data?.data?.assignments || []);
      setCourses(courseRes.data?.data?.courses || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesSearch =
        !query ||
        String(assignment.title || "").toLowerCase().includes(query) ||
        String(assignment.courseId?.title || "").toLowerCase().includes(query);
      const matchesCourse = !filterCourse || String(assignment.courseId?._id || "") === filterCourse;
      return matchesSearch && matchesCourse;
    });
  }, [assignments, search, filterCourse]);

  const isOverdue = (dueDate?: string | null) => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("courseId", form.courseId);
      formData.append("maxMarks", form.maxMarks);
      formData.append("allowTextAnswer", String(form.allowTextAnswer));
      formData.append("allowFileUpload", String(form.allowFileUpload));
      if (form.dueDate) formData.append("dueDate", form.dueDate);
      if (attachment) formData.append("attachment", attachment);

      await API.post("/assignments", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowCreate(false);
      setForm(initialForm);
      setAttachment(null);
      await fetchData();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;

    try {
      await API.delete(`/assignments/${deleteTarget._id}`);
      setDeleteTarget(null);
      if (selectedAssignment && selectedAssignment._id === deleteTarget._id) {
        setSelectedAssignment(null);
      }
      await fetchData();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to delete assignment.");
    }
  };

  const openSubmissions = async (assignment: AssignmentItem) => {
    try {
      const response = await API.get(`/assignments/${assignment._id}`);
      const full = response.data?.data?.assignment as AssignmentItem | undefined;
      if (full) setSelectedAssignment(full);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to load assignment details.");
    }
  };

  const handleGrade = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gradeModal) return;

    setSaving(true);
    setError("");

    try {
      await API.put(
        `/assignments/${gradeModal.assignmentId}/submissions/${gradeModal.submissionId}/grade`,
        gradeForm
      );
      setGradeModal(null);
      setGradeForm({ grade: "", feedback: "" });

      if (selectedAssignment?._id) {
        const response = await API.get(`/assignments/${selectedAssignment._id}`);
        setSelectedAssignment(response.data?.data?.assignment || null);
      }

      await fetchData();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to grade submission.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Assignments</h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>Create and manage assignment submissions.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New Assignment
          </button>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

        {!selectedAssignment && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input
              className="input"
              placeholder="Search assignment"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ maxWidth: 280 }}
            />
            <select
              className="input"
              value={filterCourse}
              onChange={(event) => setFilterCourse(event.target.value)}
              style={{ maxWidth: 260 }}
            >
              <option value="">All Courses</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
            {(search || filterCourse) && (
              <button className="btn btn-ghost" onClick={() => { setSearch(""); setFilterCourse(""); }}>
                Clear
              </button>
            )}
          </div>
        )}

        {loading && <div className="spinner" />}

        {!loading && !selectedAssignment && (
          <>
            {filteredAssignments.length === 0 ? (
              <div className="card" style={{ textAlign: "center" }}>
                <h3 style={{ marginBottom: 8, color: "#334155" }}>No assignments found</h3>
                <p style={{ color: "#94a3b8", marginBottom: 16 }}>Create your first assignment to get started.</p>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  Create Assignment
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {filteredAssignments.map((assignment) => (
                  <div key={assignment._id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 0 }}>
                        {assignment.title}
                      </h3>
                      {assignment.dueDate && (
                        <span className={`badge ${isOverdue(assignment.dueDate) ? "badge-red" : "badge-green"}`}>
                          {isOverdue(assignment.dueDate) ? "Overdue" : "Active"}
                        </span>
                      )}
                    </div>

                    {assignment.description && (
                      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                        {assignment.description}
                      </p>
                    )}

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span className="badge badge-blue">{assignment.courseId?.title || "Unknown course"}</span>
                      <span className="badge badge-gray">Max: {assignment.maxMarks}</span>
                      {assignment.dueDate && (
                        <span className="badge badge-gray">{new Date(assignment.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>
                        Submissions: {assignment.submissionCount || 0}
                      </span>
                      {assignment.attachmentUrl && resolveAssetUrl(assignment.attachmentUrl) && (
                        <a
                          href={resolveAssetUrl(assignment.attachmentUrl) || undefined}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}
                        >
                          Attachment
                        </a>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} onClick={() => openSubmissions(assignment)}>
                        View Submissions
                      </button>
                      <button className="btn btn-ghost" style={{ padding: "8px 10px", fontSize: 13 }} onClick={() => setDeleteTarget(assignment)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && selectedAssignment && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedAssignment(null)}>Back</button>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                  {selectedAssignment.title}
                </h2>
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  {selectedAssignment.courseId?.title || "Unknown course"} | Max Marks: {selectedAssignment.maxMarks}
                </p>
              </div>
            </div>

            {!selectedAssignment.submissions || selectedAssignment.submissions.length === 0 ? (
              <div className="card" style={{ textAlign: "center" }}>
                <h3 style={{ marginBottom: 8, color: "#334155" }}>No submissions yet</h3>
                <p style={{ color: "#94a3b8" }}>Students have not submitted this assignment.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Submitted At</th>
                      <th>Answer/File</th>
                      <th>Status</th>
                      <th>Grade</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAssignment.submissions.map((submission) => {
                      const submissionFileUrl = resolveAssetUrl(submission.fileUrl || null);
                      return (
                        <tr key={submission._id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{submission.studentId?.name || "-"}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{submission.studentId?.email || ""}</div>
                          </td>
                          <td>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "-"}</td>
                          <td>
                            {submission.textAnswer && (
                              <p style={{ maxWidth: 220, fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {submission.textAnswer}
                              </p>
                            )}
                            {submissionFileUrl && (
                              <a href={submissionFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>
                                {submission.fileName || "Download"}
                              </a>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${submission.status === "graded" ? "badge-green" : "badge-gray"}`}>
                              {submission.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {submission.grade === null || submission.grade === undefined
                              ? "-"
                              : `${submission.grade}/${selectedAssignment.maxMarks}`}
                          </td>
                          <td>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => {
                                setGradeModal({
                                  assignmentId: selectedAssignment._id,
                                  submissionId: submission._id,
                                  studentName: submission.studentId?.name || "Student",
                                  maxMarks: selectedAssignment.maxMarks,
                                });
                                setGradeForm({
                                  grade: submission.grade === null || submission.grade === undefined ? "" : String(submission.grade),
                                  feedback: submission.feedback || "",
                                });
                              }}
                            >
                              {submission.status === "graded" ? "Re-grade" : "Grade"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {showCreate && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 14, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Assignment</h2>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#64748b" }}
                >
                  X
                </button>
              </div>

              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="label">Title *</label>
                  <input
                    className="input"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Course *</label>
                  <select
                    className="input"
                    value={form.courseId}
                    onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
                    required
                  >
                    <option value="">Select course</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="form-group">
                    <label className="label">Due Date</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.dueDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Max Marks</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={form.maxMarks}
                      onChange={(event) => setForm((prev) => ({ ...prev, maxMarks: event.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 22, marginBottom: 14 }}>
                  <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.allowTextAnswer}
                      onChange={(event) => setForm((prev) => ({ ...prev, allowTextAnswer: event.target.checked }))}
                    />
                    Allow text answer
                  </label>
                  <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.allowFileUpload}
                      onChange={(event) => setForm((prev) => ({ ...prev, allowFileUpload: event.target.checked }))}
                    />
                    Allow file upload
                  </label>
                </div>

                <div className="form-group">
                  <label className="label">Attachment</label>
                  <input
                    type="file"
                    className="input"
                    onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                  />
                  {attachment && (
                    <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{attachment.name}</p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? "Creating..." : "Create"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {gradeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Grade Submission</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
                Student: {gradeModal.studentName}
              </p>
              <form onSubmit={handleGrade}>
                <div className="form-group">
                  <label className="label">Grade (0 to {gradeModal.maxMarks})</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max={gradeModal.maxMarks}
                    required
                    value={gradeForm.grade}
                    onChange={(event) => setGradeForm((prev) => ({ ...prev, grade: event.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Feedback</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={gradeForm.feedback}
                    onChange={(event) => setGradeForm((prev) => ({ ...prev, feedback: event.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setGradeModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="Delete Assignment"
          message={`Delete "${deleteTarget?.title || ""}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
