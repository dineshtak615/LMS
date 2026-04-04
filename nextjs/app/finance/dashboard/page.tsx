"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import API from "@/services/api";

export default function FinanceDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/dashboard/finance")
      .then((res) => setData(res.data.data))
      .catch(() => setError("Failed to load finance dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const methodLabel: Record<string, string> = { cash: "Cash", card: "Card", upi: "UPI", bank_transfer: "Bank Transfer", cheque: "Cheque", other: "Other" };

  return (
    <ProtectedRoute role="finance">
      <DashboardLayout>
        <h1 className="page-title">Finance Dashboard</h1>

        {loading && <div className="spinner" />}
        {error && <div className="error-msg">{error}</div>}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
              <StatCard title="Total Revenue" value={`₹${(data.totalRevenue || 0).toLocaleString()}`} icon="💰" color="#22c55e" />
              <StatCard title="This Month" value={`₹${(data.monthlyRevenue || 0).toLocaleString()}`} icon="📅" color="#3b82f6" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Revenue by Method */}
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Revenue by Payment Method</h3>
                {data.paymentsByMethod?.map((m: any) => (
                  <div key={m._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{methodLabel[m._id] || m._id}</p>
                      <p style={{ fontSize: 12, color: "#64748b" }}>{m.count} payments</p>
                    </div>
                    <strong style={{ color: "#16a34a" }}>₹{m.total.toLocaleString()}</strong>
                  </div>
                ))}
              </div>

              {/* Recent Payments */}
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Recent Payments</h3>
                {data.recentPayments?.map((p: any) => (
                  <div key={p._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{p.studentId?.name || "—"}</p>
                      <p style={{ fontSize: 12, color: "#64748b" }}>{new Date(p.paymentDate).toLocaleDateString()}</p>
                    </div>
                    <strong style={{ color: "#16a34a" }}>₹{p.amount?.toLocaleString()}</strong>
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