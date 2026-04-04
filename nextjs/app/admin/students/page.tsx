"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import EmptyState from "@/components/EmptyState";
import API from "@/services/api";
import { useAuth } from "@/context/AuthContext";

interface StudentRow {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  userId?: {
    _id: string;
    email: string;
    isActive: boolean;
  } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const router = useRouter();
  const canManage = user?.role === "admin";

  const fetchStudents = async (q = "", p = 1) => {
    setLoading(true);
    try {
      const res = await API.get(`/students?search=${encodeURIComponent(q)}&page=${p}&limit=15`);
      const data = res.data.data;
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setPagination(data?.pagination || null);
      setError("");
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDeactivate = async () => {
    try {
      await API.delete(`/students/${modal.id}`);
      await fetchStudents(search, page);
    } catch {
      setError("Failed to deactivate student.");
    } finally {
      setModal({ open: false, id: "", name: "" });
    }
  };

  const createStudentAccountPath = "/admin/users/create?role=student&next=%2Fadmin%2Fstudents";

  return (
    <ProtectedRoute role={["admin", "trainer", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Students
          </h1>
          {canManage && (
            <button className="btn btn-primary" onClick={() => router.push(createStudentAccountPath)}>
              + Add Student
            </button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              setPage(1);
              fetchStudents(value, 1);
            }}
            style={{ maxWidth: 320 }}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? (
            <div className="spinner" />
          ) : students.length === 0 ? (
            <EmptyState
              icon="Students"
              title="No students found"
              desc={canManage ? "Create student login first to provide dashboard access." : "No students available."}
              actionLabel={canManage ? "+ Add Student" : undefined}
              onAction={canManage ? () => router.push(createStudentAccountPath) : undefined}
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Login Link</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student._id}>
                    <td>{(page - 1) * 15 + index + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#3b82f6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {student.name?.charAt(0)?.toUpperCase() || "S"}
                        </div>
                        <strong>{student.name}</strong>
                      </div>
                    </td>
                    <td>{student.email}</td>
                    <td>
                      {student.userId ? (
                        <span className={`badge ${student.userId.isActive ? "badge-green" : "badge-yellow"}`}>
                          Linked
                        </span>
                      ) : (
                        <span className="badge badge-red">Not Linked</span>
                      )}
                    </td>
                    <td>{student.phone || "-"}</td>
                    <td>
                      <span className={`badge ${student.isActive ? "badge-green" : "badge-red"}`}>
                        {student.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "#64748b" }}>{new Date(student.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: "5px 10px" }}
                          onClick={() => router.push(`/admin/students/${student._id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: "5px 10px" }}
                          onClick={() => router.push(`/admin/students/${student._id}/edit`)}
                          disabled={!canManage}
                        >
                          Edit
                        </button>
                        {canManage && student.isActive && (
                          <button
                            className="btn btn-danger"
                            style={{ fontSize: 12, padding: "5px 10px" }}
                            onClick={() => setModal({ open: true, id: student._id, name: student.name })}
                          >
                            Deactivate
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

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button
              className="btn btn-ghost"
              disabled={page === 1}
              onClick={() => {
                const prevPage = page - 1;
                setPage(prevPage);
                fetchStudents(search, prevPage);
              }}
              style={{ padding: "6px 14px" }}
            >
              Prev
            </button>
            <span style={{ padding: "8px 14px", fontSize: 14, color: "#64748b" }}>
              Page {page} of {pagination.totalPages}
            </span>
            <button
              className="btn btn-ghost"
              disabled={page === pagination.totalPages}
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchStudents(search, nextPage);
              }}
              style={{ padding: "6px 14px" }}
            >
              Next
            </button>
          </div>
        )}

        <ConfirmModal
          isOpen={modal.open}
          title={`Deactivate ${modal.name}?`}
          message="This student will lose access and be marked inactive. You can reactivate later."
          confirmLabel="Yes, Deactivate"
          danger
          onConfirm={handleDeactivate}
          onCancel={() => setModal({ open: false, id: "", name: "" })}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
