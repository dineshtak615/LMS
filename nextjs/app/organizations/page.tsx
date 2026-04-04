"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchOrgs = (q = "") => {
    setLoading(true);
    API.get(`/super-admin/organizations?search=${q}`)
      .then((res) => {
        const d = res.data.data;
        setOrgs(Array.isArray(d?.organizations) ? d.organizations : Array.isArray(d) ? d : []);
      })
      .catch(() => setError("Failed to load organizations."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      await API.patch(`/super-admin/organizations/${id}/toggle`);
      fetchOrgs(search);
    } catch { setError("Failed to toggle status."); }
    finally { setToggling(null); }
  };

  return (
    <ProtectedRoute role="super_admin">
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Organizations</h1>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input className="input" placeholder="Search organizations..." value={search} onChange={(e) => { setSearch(e.target.value); fetchOrgs(e.target.value); }} style={{ maxWidth: 320 }} />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? <div className="spinner" /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Plan</th><th>Students</th><th>Courses</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No organizations found.</td></tr>
                ) : orgs.map((org, i) => (
                  <tr key={org._id}>
                    <td>{i + 1}</td>
                    <td><strong>{org.name}</strong></td>
                    <td>{org.email}</td>
                    <td><span className="badge badge-blue">{org.plan}</span></td>
                    <td>{org.students ?? "—"}</td>
                    <td>{org.courses ?? "—"}</td>
                    <td><span className={`badge ${org.isActive ? "badge-green" : "badge-red"}`}>{org.isActive ? "Active" : "Inactive"}</span></td>
                    <td>
                      <button
                        className={`btn ${org.isActive ? "btn-danger" : "btn-success"}`}
                        style={{ fontSize: 12, padding: "5px 12px" }}
                        disabled={toggling === org._id}
                        onClick={() => handleToggle(org._id)}
                      >
                        {toggling === org._id ? "..." : org.isActive ? "Deactivate" : "Activate"}
                      </button>
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