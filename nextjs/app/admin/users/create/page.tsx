"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";

const ALLOWED_ROLES = ["trainer", "finance", "student"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

const isAllowedRole = (value: string | null): value is AllowedRole =>
  Boolean(value && ALLOWED_ROLES.includes(value as AllowedRole));

function CreateUserPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedRoleParam = searchParams.get("role");
  const roleLocked = isAllowedRole(requestedRoleParam);
  const requestedRole: AllowedRole = roleLocked ? requestedRoleParam : "trainer";

  const requestedNext = searchParams.get("next");
  const nextPath =
    requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/admin/users";

  const [form, setForm] = useState<{ name: string; email: string; password: string; role: AllowedRole }>({
    name: "",
    email: "",
    password: "",
    role: requestedRole,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roleLocked) return;
    setForm((prev) => ({ ...prev, role: requestedRole }));
  }, [roleLocked, requestedRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "role") {
      setForm((prev) => ({ ...prev, role: value as AllowedRole }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await API.post("/organizations/users", form);
      setSuccess(`${form.role.charAt(0).toUpperCase() + form.role.slice(1)} account created!`);
      setTimeout(() => router.push(nextPath), 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create user.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "8px 14px" }}>← Back</button>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Create User Account</h1>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" name="name" value={form.name} onChange={handleChange} required placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="user@example.com" />
              </div>
              <div className="form-group">
                <label className="label">Password *</label>
                <input className="input" name="password" type="password" value={form.password} onChange={handleChange} required placeholder="Min 6 characters" />
              </div>
              <div className="form-group">
                <label className="label">Role *</label>
                <select className="input" name="role" value={form.role} onChange={handleChange} disabled={roleLocked}>
                  <option value="trainer">Trainer</option>
                  <option value="finance">Finance</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#166534" }}>
                This creates a login account. If a trainer/student profile already exists with the same email, it will be linked automatically.
              </div>
              {roleLocked && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#1d4ed8" }}>
                  Role is preselected from the previous page.
                </div>
              )}

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: 12 }}>
                  {loading ? "Creating..." : "Create Account"}
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

export default function CreateUserPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#f8fafc",
          }}
        >
          <div className="spinner" />
        </div>
      }
    >
      <CreateUserPageContent />
    </Suspense>
  );
}
