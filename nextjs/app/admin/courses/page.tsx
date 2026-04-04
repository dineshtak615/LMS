"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import API, { resolveAssetUrl } from "@/services/api";

interface CourseRow {
  _id: string;
  title: string;
  category?: string | null;
  duration?: string | null;
  fee?: number;
  trainerId?: { name?: string } | null;
  enrolmentCount?: number;
  isActive?: boolean;
  videoUrl?: string | null;
  pdfUrl?: string | null;
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const fetchCourses = (q = "") => {
    setLoading(true);
    API.get(`/courses?search=${q}`)
      .then((res) => {
        const d = res.data.data;
        setCourses(Array.isArray(d?.courses) ? d.courses : []);
      })
      .catch(() => setError("Failed to load courses."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    API.get("/courses?search=")
      .then((res) => {
        if (!mounted) return;
        const d = res.data.data;
        setCourses(Array.isArray(d?.courses) ? d.courses : []);
      })
      .catch(() => {
        if (mounted) setError("Failed to load courses.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const canManage = user?.role === "admin" || user?.role === "trainer";
  const isAdmin = user?.role === "admin";

  return (
    <ProtectedRoute role={["admin", "trainer", "student", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Courses
          </h1>

          {canManage && (
            <button className="btn btn-primary" onClick={() => router.push("/admin/courses/create")}>
              + Add Course
            </button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              fetchCourses(e.target.value);
            }}
            style={{ maxWidth: 320 }}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? (
            <div className="spinner" />
          ) : courses.length === 0 ? (
            <EmptyState
              icon="Courses"
              title="No courses found"
              desc={search ? "Try a different search term." : "No courses have been created yet."}
              actionLabel={canManage ? "+ Add Course" : undefined}
              onAction={canManage ? () => router.push("/admin/courses/create") : undefined}
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Fee</th>
                  <th>Trainer</th>
                  <th>Enrolled</th>
                  <th>Materials</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={c._id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{c.title}</strong>
                    </td>
                    <td>{c.category || "-"}</td>
                    <td>{c.duration || "-"}</td>
                    <td style={{ fontWeight: 600, color: "#16a34a" }}>INR {(c.fee || 0).toLocaleString()}</td>
                    <td>{c.trainerId?.name || <span style={{ color: "#94a3b8" }}>Unassigned</span>}</td>
                    <td>
                      <span className="badge badge-blue">Count: {c.enrolmentCount ?? 0}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.videoUrl ? (
                          <a
                            href={resolveAssetUrl(c.videoUrl) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="badge badge-blue"
                            style={{ cursor: "pointer" }}
                          >
                            Video
                          </a>
                        ) : (
                          <span className="badge badge-gray">No Video</span>
                        )}
                        {c.pdfUrl ? (
                          <a
                            href={resolveAssetUrl(c.pdfUrl) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="badge badge-green"
                            style={{ cursor: "pointer" }}
                          >
                            PDF
                          </a>
                        ) : (
                          <span className="badge badge-gray">No PDF</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.isActive ? "badge-green" : "badge-red"}`}>{c.isActive ? "Active" : "Inactive"}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: "5px 12px" }}
                          onClick={() => router.push(`/admin/courses/${c._id}`)}
                        >
                          View
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: "5px 12px" }}
                            onClick={() => router.push(`/admin/courses/${c._id}/edit`)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
