"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import API from "@/services/api";
import { useRouter } from "next/navigation";

export default function SuperAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    API.get("/super-admin/dashboard")
      .then((res) => setData(res.data.data))
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedRoute role="super_admin">
      <DashboardLayout>
        <h1 className="page-title">Super Admin Dashboard</h1>

        {loading && <div className="spinner" />}
        {error && <div className="error-msg">{error}</div>}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32 }}>
              <StatCard title="Total Organizations" value={data.stats.totalOrganizations} icon="🏢" color="#3b82f6" />
              <StatCard title="Active Organizations" value={data.stats.activeOrganizations} icon="✅" color="#22c55e" />
              <StatCard title="Total Users" value={data.stats.totalUsers} icon="👥" color="#f59e0b" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Recent Organizations */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Organizations</h3>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => router.push("/organizations")}>View All</button>
                </div>
                {data.recentOrganizations.map((org: any) => (
                  <div key={org._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{org.name}</p>
                      <p style={{ fontSize: 12, color: "#64748b" }}>{org.email}</p>
                    </div>
                    <span className={`badge ${org.isActive ? "badge-green" : "badge-red"}`}>{org.isActive ? "Active" : "Inactive"}</span>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Activity</h3>
                {data.recentActivity.map((log: any) => (
                  <div key={log._id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{log.action.replace(/_/g, " ")}</p>
                    <p style={{ fontSize: 12, color: "#64748b" }}>{log.description}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}