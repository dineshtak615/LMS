"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchUsers = (q = "", r = "", p = 1) => {
    setLoading(true);
    API.get(`/super-admin/users?search=${q}&role=${r}&page=${p}&limit=20`)
      .then((res) => {
        const d = res.data.data;
        setUsers(Array.isArray(d?.users) ? d.users : []);
        setPagination(d?.pagination || null);
      })
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const roleColors: Record<string, string> = {
    admin: "badge-blue",
    trainer: "badge-green",
    student: "badge-yellow",
    finance: "badge-gray",
    super_admin: "badge-red",
  };

  return (
    <ProtectedRoute role="super_admin">
      <DashboardLayout>
        <h1 className="page-title">All Users</h1>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); fetchUsers(e.target.value, role, 1); }}
            style={{ maxWidth: 280 }}
          />
          <select
            className="input"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); fetchUsers(search, e.target.value, 1); }}
            style={{ maxWidth: 180 }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="trainer">Trainer</option>
            <option value="student">Student</option>
            <option value="finance">Finance</option>
          </select>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? <div className="spinner" /> : (
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Organization</th><th>Status</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No users found.</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u._id}>
                    <td>{((page - 1) * 20) + i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {u?.name?.charAt(0)?.toUpperCase() ?? "U"}
                        </div>
                        <strong>{u?.name ?? "—"}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${roleColors[u.role] || "badge-gray"}`}>{u.role.replace("_", " ")}</span></td>
                    <td>{u.organizationId?.name || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                    <td><span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button className="btn btn-ghost" disabled={page === 1} onClick={() => { setPage(page - 1); fetchUsers(search, role, page - 1); }} style={{ padding: "6px 14px" }}>← Prev</button>
            <span style={{ padding: "8px 14px", fontSize: 14, color: "#64748b" }}>Page {page} of {pagination.totalPages}</span>
            <button className="btn btn-ghost" disabled={page === pagination.totalPages} onClick={() => { setPage(page + 1); fetchUsers(search, role, page + 1); }} style={{ padding: "6px 14px" }}>Next →</button>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}