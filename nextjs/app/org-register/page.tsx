"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { getDashboardRoute } from "@/components/ProtectedRoute";

export default function OrgRegisterPage() {
  const [form, setForm] = useState({ orgName: "", orgEmail: "", orgPhone: "", adminName: "", adminEmail: "", adminPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.adminPassword !== form.confirmPassword) return setError("Passwords do not match.");
    if (form.adminPassword.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const res = await API.post("/auth/register", {
        orgName: form.orgName, orgEmail: form.orgEmail, orgPhone: form.orgPhone,
        adminName: form.adminName, adminEmail: form.adminEmail, adminPassword: form.adminPassword,
      });
      const { token, user } = res.data.data;
      login(user, token);
      router.push(getDashboardRoute(user.role));
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Register Organization</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Create your LMS organization account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Organization Details</p>
            <div className="form-group">
              <label className="label">Organization Name *</label>
              <input className="input" name="orgName" value={form.orgName} onChange={handleChange} required placeholder="Acme Institute" />
            </div>
            <div className="form-group">
              <label className="label">Organization Email *</label>
              <input className="input" name="orgEmail" type="email" value={form.orgEmail} onChange={handleChange} required placeholder="contact@acme.com" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Phone</label>
              <input className="input" name="orgPhone" value={form.orgPhone} onChange={handleChange} placeholder="+91 9999999999" />
            </div>
          </div>

          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Admin Account</p>
            <div className="form-group">
              <label className="label">Admin Name *</label>
              <input className="input" name="adminName" value={form.adminName} onChange={handleChange} required placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label className="label">Admin Email *</label>
              <input className="input" name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} required placeholder="admin@acme.com" />
            </div>
            <div className="form-group">
              <label className="label">Password *</label>
              <input className="input" name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} required placeholder="Min 6 characters" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Confirm Password *</label>
              <input className="input" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required placeholder="Repeat password" />
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: 13, fontSize: 15 }}>
            {loading ? "Creating Account..." : "Create Organization"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
          Already registered? <a href="/login" style={{ color: "#3b82f6", fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}