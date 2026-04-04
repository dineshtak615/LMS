"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API, { resolveAssetUrl } from "@/services/api";

interface CourseItem {
  _id: string;
  title?: string;
}

interface SubmissionItem {
  _id: string;
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
  allowTextAnswer?: boolean;
  allowFileUpload?: boolean;
  mySubmission?: {
    status?: string;
    grade?: number | null;
    submittedAt?: string;
  } | null;
  submissions?: SubmissionItem[];
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<AssignmentItem | null>(null);
  const [search, setSearch] = useState("");

  const [submitForm, setSubmitForm] = useState({ textAnswer: "" });
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/assignments?limit=100");
      setAssignments(response.data?.data?.assignments || []);
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

  const isOverdue = (dueDate?: string | null) => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  };

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assignments;

    return assignments.filter((assignment) => {
      return (
        String(assignment.title || "").toLowerCase().includes(query) ||
        String(assignment.courseId?.title || "").toLowerCase().includes(query)
      );
    });
  }, [assignments, search]);

  const openAssignment = async (assignment: AssignmentItem) => {
    setError("");
    setSubmitMessage("");

    try {
      const response = await API.get(`/assignments/${assignment._id}`);
      const full = response.data?.data?.assignment as AssignmentItem | undefined;
      if (!full) return;

      setSelected(full);
      const mySubmission = full.submissions?.[0];
      setSubmitForm({ textAnswer: mySubmission?.textAnswer || "" });
      setSubmitFile(null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Failed to load assignment.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;

    const allowText = selected.allowTextAnswer !== false;
    const allowFile = selected.allowFileUpload !== false;
    const hasText = Boolean(String(submitForm.textAnswer || "").trim());
    const hasFile = Boolean(submitFile);

    if (allowText && allowFile && !hasText && !hasFile) {
      setSubmitMessage("Please enter a text answer or upload a file.");
      return;
    }

    if (allowText && !allowFile && !hasText) {
      setSubmitMessage("This assignment requires a text answer.");
      return;
    }

    if (!allowText && allowFile && !hasFile) {
      setSubmitMessage("This assignment requires a file upload.");
      return;
    }

    setSubmitting(true);
    setSubmitMessage("");

    try {
      const formData = new FormData();
      if (hasText) formData.append("textAnswer", submitForm.textAnswer);
      if (submitFile) formData.append("file", submitFile);

      await API.post(`/assignments/${selected._id}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmitFile(null);
      setSubmitMessage("Assignment submitted successfully.");

      const response = await API.get(`/assignments/${selected._id}`);
      setSelected(response.data?.data?.assignment || null);

      await fetchData();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitMessage(message || "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const mySubmission = selected?.submissions?.[0];

  return (
    <ProtectedRoute role="student">
      <DashboardLayout>
        {selected ? (
          <div style={{ maxWidth: 760 }}>
            <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>
              Back
            </button>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 0 }}>{selected.title}</h2>
                {selected.dueDate && (
                  <span className={`badge ${isOverdue(selected.dueDate) ? "badge-red" : "badge-green"}`}>
                    {isOverdue(selected.dueDate) ? "Overdue" : "Active"}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <span className="badge badge-blue">{selected.courseId?.title || "Unknown course"}</span>
                <span className="badge badge-gray">Max: {selected.maxMarks}</span>
                {selected.dueDate && (
                  <span className="badge badge-gray">Due: {new Date(selected.dueDate).toLocaleString()}</span>
                )}
              </div>

              {selected.description && (
                <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                  {selected.description}
                </p>
              )}

              {selected.attachmentUrl && resolveAssetUrl(selected.attachmentUrl) && (
                <a
                  href={resolveAssetUrl(selected.attachmentUrl) || undefined}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#2563eb",
                    textDecoration: "none",
                  }}
                >
                  Download assignment file ({selected.attachmentName || "Attachment"})
                </a>
              )}
            </div>

            {mySubmission && (
              <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid #22c55e" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>My Submission</h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                  Submitted: {mySubmission.submittedAt ? new Date(mySubmission.submittedAt).toLocaleString() : "-"}
                </p>

                {mySubmission.textAnswer && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, whiteSpace: "pre-wrap" }}>
                    {mySubmission.textAnswer}
                  </div>
                )}

                {mySubmission.fileUrl && resolveAssetUrl(mySubmission.fileUrl) && (
                  <a
                    href={resolveAssetUrl(mySubmission.fileUrl) || undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
                  >
                    {mySubmission.fileName || "Download submitted file"}
                  </a>
                )}

                {mySubmission.status === "graded" && (
                  <div style={{ marginTop: 12, padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>
                      Grade: {mySubmission.grade}/{selected.maxMarks}
                    </p>
                    {mySubmission.feedback && (
                      <p style={{ fontSize: 13, color: "#475569" }}>Feedback: {mySubmission.feedback}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isOverdue(selected.dueDate) ? (
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                  {mySubmission ? "Update Submission" : "Submit Assignment"}
                </h3>
                <form onSubmit={handleSubmit}>
                  {selected.allowTextAnswer !== false && (
                    <div className="form-group">
                      <label className="label">Text Answer</label>
                      <textarea
                        className="input"
                        rows={6}
                        value={submitForm.textAnswer}
                        onChange={(event) => setSubmitForm({ textAnswer: event.target.value })}
                        placeholder="Write your answer here..."
                      />
                    </div>
                  )}

                  {selected.allowFileUpload !== false && (
                    <div className="form-group">
                      <label className="label">Upload File</label>
                      <input
                        type="file"
                        className="input"
                        onChange={(event) => setSubmitFile(event.target.files?.[0] || null)}
                      />
                      {submitFile && (
                        <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{submitFile.name}</p>
                      )}
                    </div>
                  )}

                  {submitMessage && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: submitMessage.toLowerCase().includes("success") ? "#f0fdf4" : "#fef2f2",
                        color: submitMessage.toLowerCase().includes("success") ? "#15803d" : "#dc2626",
                        border: `1px solid ${submitMessage.toLowerCase().includes("success") ? "#bbf7d0" : "#fecaca"}`,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {submitMessage}
                    </div>
                  )}

                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : mySubmission ? "Update Submission" : "Submit"}
                  </button>
                </form>
              </div>
            ) : !mySubmission ? (
              <div className="error-msg">Submission deadline has passed.</div>
            ) : null}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <h1 className="page-title" style={{ marginBottom: 4 }}>My Assignments</h1>
              <p style={{ color: "#64748b", fontSize: 14 }}>View your assignment list and submit responses.</p>
            </div>

            <input
              className="input"
              placeholder="Search assignments"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ maxWidth: 320, marginBottom: 16 }}
            />

            {loading && <div className="spinner" />}
            {error && <div className="error-msg">{error}</div>}

            {!loading && filteredAssignments.length === 0 ? (
              <div className="card" style={{ textAlign: "center" }}>
                <h3 style={{ marginBottom: 8, color: "#334155" }}>No assignments yet</h3>
                <p style={{ color: "#94a3b8" }}>Your instructors have not posted assignments yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
                {filteredAssignments.map((assignment) => {
                  const overdue = isOverdue(assignment.dueDate);
                  return (
                    <button
                      key={assignment._id}
                      onClick={() => openAssignment(assignment)}
                      style={{
                        border: `1px solid ${overdue ? "#fecaca" : "#e2e8f0"}`,
                        borderRadius: 12,
                        background: "#fff",
                        textAlign: "left",
                        padding: 16,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 0 }}>{assignment.title}</h3>
                        <span className={`badge ${overdue ? "badge-red" : "badge-green"}`}>
                          {overdue ? "Overdue" : "Active"}
                        </span>
                      </div>

                      {assignment.description && (
                        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 10 }}>
                          {assignment.description}
                        </p>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <span className="badge badge-blue">{assignment.courseId?.title || "Unknown course"}</span>
                        <span className="badge badge-gray">Max: {assignment.maxMarks}</span>
                      </div>

                      {assignment.dueDate && (
                        <p style={{ fontSize: 12, color: overdue ? "#dc2626" : "#64748b" }}>
                          Due: {new Date(assignment.dueDate).toLocaleString()}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
