"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API from "@/services/api";
import { useAuth } from "@/context/AuthContext";

interface TrainerRow {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  specialization?: string | null;
  isActive: boolean;
  userId?: {
    _id: string;
    email: string;
    isActive: boolean;
  } | null;
}

export default function TrainersPage() {
  const { user } = useAuth();
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const canManage = user?.role === "admin";
  const createTrainerAccountPath = "/admin/users/create?role=trainer&next=%2Fadmin%2Ftrainers";

  const fetchTrainers = async (q = "") => {
    setLoading(true);
    try {
      const res = await API.get(`/trainers?search=${encodeURIComponent(q)}`);
      const data = res.data.data;
      setTrainers(Array.isArray(data?.trainers) ? data.trainers : []);
      setError("");
    } catch {
      setError("Failed to load trainers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this trainer?")) return;
    try {
      await API.delete(`/trainers/${id}`);
      await fetchTrainers(search);
    } catch {
      setError("Failed to deactivate trainer.");
    }
  };

  return (
    <ProtectedRoute role={["admin", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Trainers
          </h1>
          {canManage && (
            <button className="btn btn-primary" onClick={() => router.push(createTrainerAccountPath)}>
              + Add Trainer
            </button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search trainers..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              fetchTrainers(value);
            }}
            style={{ maxWidth: 320 }}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="table-wrapper">
          {loading ? (
            <div className="spinner" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Login Link</th>
                  <th>Phone</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {trainers.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      No trainers found.
                    </td>
                  </tr>
                ) : (
                  trainers.map((trainer, index) => (
                    <tr key={trainer._id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{trainer.name}</strong>
                      </td>
                      <td>{trainer.email}</td>
                      <td>
                        {trainer.userId ? (
                          <span className={`badge ${trainer.userId.isActive ? "badge-green" : "badge-yellow"}`}>
                            Linked
                          </span>
                        ) : (
                          <span className="badge badge-red">Not Linked</span>
                        )}
                      </td>
                      <td>{trainer.phone || "-"}</td>
                      <td>{trainer.specialization || "-"}</td>
                      <td>
                        <span className={`badge ${trainer.isActive ? "badge-green" : "badge-red"}`}>
                          {trainer.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => router.push(`/admin/trainers/${trainer._id}/edit`)}>
                            Edit
                          </button>
                          {trainer.isActive && (
                            <button className="btn btn-danger" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => handleDeactivate(trainer._id)}>
                              Deactivate
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
