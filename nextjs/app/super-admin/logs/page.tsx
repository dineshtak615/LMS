"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchLogs = (m = "", p = 1) => {
    setLoading(true);
    API.get(`/super-admin/activity-logs?module=${m}&page=${p}&limit=30`)
      .then((res) => {
        const d = res.data.data;
        setLogs(Array.isArray(d?.logs) ? d.logs : []);
        setPagination(d?.pagination || null);
      })
      .catch(() => setError("Failed to load activity logs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, []);

  const moduleColors: Record<string, string> = {
    auth: "badge-blue",
    student: "badge-green",
    trainer: "badge-yellow",
    course: "badge-blue",
    enrolment: "badge-green",
    payment: "badge-green",
    library: "badge-yellow",
    organization: "badge-blue",
    super_admin: "badge-red",
    analytics: "badge-gray",
    dashboard: "badge-gray",
  };

  const modules = ["auth", "student", "trainer", "course", "enrolment", "payment", "library", "organization", "super_admin"];

  return (
    <ProtectedRoute role="super_admin">
      <DashboardLayout>
        <h1 className="page-title">Activity Logs</h1>

        {/* Filter by module */}
        <div style={{ marginBottom: 20 }}>
          <select
            className="input"
            value={module}
            onChange={(e) => { setModule(e.target.value); setPage(1); fetchLogs(e.target.value, 1); }}
            style={{ maxWidth: 220 }}
          >
            <option value="">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m.replace("_", " ").toUpperCase()}</option>
            ))}
          </select>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? <div className="spinner" /> : (
            <table>
              <thead>
                <tr><th>#</th><th>Action</th><th>Module</th><th>User</th><th>Organization</th><th>Description</th><th>Time</th></tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No activity logs found.</td></tr>
                ) : logs.map((log, i) => (
                  <tr key={log._id}>
                    <td>{((page - 1) * 30) + i + 1}</td>
                    <td>
                      <strong style={{ fontSize: 13 }}>{log.action?.replace(/_/g, " ")}</strong>
                    </td>
                    <td>
                      <span className={`badge ${moduleColors[log.module] || "badge-gray"}`}>
                        {log.module?.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      {log.userId ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{log.userId?.name ?? "—"}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{log.userId?.email}</div>
                        </div>
                      ) : <span style={{ color: "#94a3b8" }}>System</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>{log.organizationId?.name || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                    <td style={{ fontSize: 13, color: "#64748b", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.description || "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button className="btn btn-ghost" disabled={page === 1} onClick={() => { setPage(page - 1); fetchLogs(module, page - 1); }} style={{ padding: "6px 14px" }}>← Prev</button>
            <span style={{ padding: "8px 14px", fontSize: 14, color: "#64748b" }}>Page {page} of {pagination.totalPages}</span>
            <button className="btn btn-ghost" disabled={page === pagination.totalPages} onClick={() => { setPage(page + 1); fetchLogs(module, page + 1); }} style={{ padding: "6px 14px" }}>Next →</button>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}