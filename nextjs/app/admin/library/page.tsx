"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API, { resolveAssetUrl } from "@/services/api";

export default function LibraryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "records">("items");
  const [error, setError] = useState("");
  const router = useRouter();

  const canManage = user?.role === "admin";
  const canSeeRecords = user?.role === "admin" || user?.role === "finance";

  useEffect(() => {
    const requests = [API.get("/library/items")];
    if (canSeeRecords) requests.push(API.get("/library/records"));

    Promise.all(requests as Promise<any>[])
      .then((responses) => {
        const [itemsResponse, recordsResponse] = responses;
        setItems(itemsResponse.data.data?.items || []);
        setRecords(recordsResponse?.data?.data?.records || []);
      })
      .catch(() => setError("Failed to load library."))
      .finally(() => setLoading(false));
  }, [canSeeRecords]);

  const handleReturn = async (id: string) => {
    if (!confirm("Mark this item as returned?")) return;
    try {
      await API.put(`/library/return/${id}`, {});
      const r = await API.get("/library/records");
      setRecords(r.data.data?.records || []);
    } catch {
      setError("Failed to return item.");
    }
  };

  const tabStyle = (active: boolean) => ({
    padding: "10px 20px",
    border: "none",
    background: active ? "#3b82f6" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  });

  return (
    <ProtectedRoute role={["admin", "trainer", "student", "finance"]}>
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Library
          </h1>
          {canManage && (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => router.push("/admin/library/create")}>
                + Add Item
              </button>
              <button className="btn btn-primary" onClick={() => router.push("/admin/library/issue")}>
                Issue Book
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button style={tabStyle(tab === "items")} onClick={() => setTab("items")}>
            Items ({items.length})
          </button>
          {canSeeRecords && (
            <button style={tabStyle(tab === "records")} onClick={() => setTab("records")}>
              Issue Records ({records.length})
            </button>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <div className="spinner" />
        ) : tab === "items" ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Type</th>
                  <th>Book File</th>
                  <th>Total</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      No library items yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={item._id}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{item.title}</strong>
                      </td>
                      <td>{item.author || "-"}</td>
                      <td>
                        <span className="badge badge-blue">{item.type}</span>
                      </td>
                      <td>
                        {item.fileUrl ? (
                          <a
                            href={resolveAssetUrl(item.fileUrl) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="badge badge-green"
                            style={{ cursor: "pointer" }}
                          >
                            Read
                          </a>
                        ) : (
                          <span className="badge badge-gray">No File</span>
                        )}
                      </td>
                      <td>{item.totalCopies}</td>
                      <td>
                        <span className={`badge ${item.availableCopies > 0 ? "badge-green" : "badge-red"}`}>{item.availableCopies}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Student</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      No issue records.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <strong>{r.itemId?.title || "-"}</strong>
                      </td>
                      <td>{r.studentId?.name || "-"}</td>
                      <td>{new Date(r.issueDate).toLocaleDateString()}</td>
                      <td>{new Date(r.dueDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${r.status === "returned" ? "badge-green" : r.status === "overdue" ? "badge-red" : "badge-yellow"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {canManage && r.status === "issued" && (
                          <button
                            className="btn btn-success"
                            style={{ fontSize: 12, padding: "5px 10px" }}
                            onClick={() => handleReturn(r._id)}
                          >
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
