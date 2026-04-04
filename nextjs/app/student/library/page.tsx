"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import API, { resolveAssetUrl } from "@/services/api";

interface LibraryItem {
  _id: string;
  title: string;
  author?: string | null;
  category?: string | null;
  type?: string | null;
  fileUrl?: string | null;
  fileOriginalName?: string | null;
}

interface LibraryRecord {
  _id: string;
  status: "issued" | "returned" | "overdue";
  issueDate: string;
  dueDate: string;
  returnDate?: string | null;
  itemId?: {
    _id?: string;
    title?: string;
    author?: string;
    type?: string;
    fileUrl?: string;
    fileOriginalName?: string;
  } | null;
}

export default function StudentLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [records, setRecords] = useState<LibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [returningRecordId, setReturningRecordId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedBook, setSelectedBook] = useState<LibraryItem | null>(null);

  const loadItems = useCallback(async () => {
    const res = await API.get("/library/items?limit=500");
    const list = res.data?.data?.items;
    setItems(Array.isArray(list) ? (list as LibraryItem[]) : []);
  }, []);

  useEffect(() => {
    let mounted = true;

    loadItems()
      .then(() => {
        if (!mounted) return;
      })
      .catch(() => {
        if (mounted) setError("Failed to load library books.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadItems]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await API.get("/library/records?limit=200");
      const list = res.data?.data?.records;
      setRecords(Array.isArray(list) ? (list as LibraryRecord[]) : []);
    } catch {
      setActionError("Failed to load your borrowed books.");
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleReturnBook = async (recordId: string) => {
    setActionError("");
    setActionSuccess("");
    setReturningRecordId(recordId);
    try {
      await API.put(`/library/return/${recordId}`, {});
      setActionSuccess("Book returned successfully.");
      await Promise.all([loadRecords(), loadItems()]);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(message || "Failed to return book.");
    } finally {
      setReturningRecordId(null);
    }
  };

  const activeRecords = useMemo(
    () => records.filter((record) => record.status === "issued" || record.status === "overdue"),
    [records]
  );

  const activeItemIds = useMemo(() => {
    const ids = new Set<string>();
    activeRecords.forEach((record) => {
      if (record.itemId?._id) ids.add(record.itemId._id);
    });
    return ids;
  }, [activeRecords]);

  const visibleItems = useMemo(() => items.filter((item) => activeItemIds.has(item._id)), [activeItemIds, items]);

  useEffect(() => {
    setSelectedBook((prev) => {
      if (prev?._id && visibleItems.some((item) => item._id === prev._id)) {
        return prev;
      }
      return visibleItems.find((item) => item.fileUrl) || visibleItems[0] || null;
    });
  }, [visibleItems]);

  const filteredItems = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return visibleItems.filter((item) => {
      if (selectedType !== "all" && item.type !== selectedType) return false;
      if (!searchText) return true;

      const title = (item.title || "").toLowerCase();
      const author = (item.author || "").toLowerCase();
      const category = (item.category || "").toLowerCase();
      return title.includes(searchText) || author.includes(searchText) || category.includes(searchText);
    });
  }, [search, selectedType, visibleItems]);

  const availableTypes = useMemo(() => {
    const values = visibleItems.map((item) => String(item.type || "").trim()).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [visibleItems]);

  const selectedBookUrl = resolveAssetUrl(selectedBook?.fileUrl);
  const activeBorrowedCount = activeRecords.length;

  return (
    <ProtectedRoute role="student">
      <DashboardLayout>
        <h1 className="page-title">Library</h1>

        {error && <div className="error-msg">{error}</div>}
        {actionError && <div className="error-msg">{actionError}</div>}
        {actionSuccess && <div className="success-msg">{actionSuccess}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 0 }}>My Borrowed Books</h3>
            <span className="badge badge-blue">Active: {activeBorrowedCount}</span>
          </div>

          {recordsLoading ? (
            <div className="spinner" />
          ) : activeRecords.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No active borrowed books.</p>
          ) : (
            <div className="table-wrapper" style={{ boxShadow: "none", border: "1px solid #f1f5f9" }}>
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>File</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRecords.map((record) => {
                    const canReturn = record.status === "issued" || record.status === "overdue";
                    const fileUrl = resolveAssetUrl(record.itemId?.fileUrl);

                    return (
                      <tr key={record._id}>
                        <td>
                          <strong>{record.itemId?.title || "-"}</strong>
                        </td>
                        <td>{new Date(record.issueDate).toLocaleDateString()}</td>
                        <td>{new Date(record.dueDate).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${record.status === "returned" ? "badge-green" : record.status === "overdue" ? "badge-red" : "badge-yellow"}`}>
                            {record.status}
                          </span>
                        </td>
                        <td>
                          {fileUrl ? (
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="badge badge-green" style={{ cursor: "pointer" }}>
                              Read
                            </a>
                          ) : (
                            <span className="badge badge-gray">No File</span>
                          )}
                        </td>
                        <td>
                          {canReturn ? (
                            <button
                              className="btn btn-success"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => handleReturnBook(record._id)}
                              disabled={returningRecordId === record._id}
                            >
                              {returningRecordId === record._id ? "Returning..." : "Return Book"}
                            </button>
                          ) : (
                            <span className="badge badge-gray">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loading ? (
          <div className="spinner" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(420px, 2fr)", gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 0 }}>My Issued Books</h3>
                <span className="badge badge-blue">{filteredItems.length}</span>
              </div>

              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  placeholder="Search title, author, category"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                  <option value="all">All Types</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ maxHeight: 520, overflow: "auto", display: "grid", gap: 8 }}>
                {filteredItems.length === 0 ? (
                  <p style={{ color: "#94a3b8" }}>No active books found.</p>
                ) : (
                  filteredItems.map((item) => {
                    const isActive = selectedBook?._id === item._id;
                    return (
                      <button
                        key={item._id}
                        onClick={() => setSelectedBook(item)}
                        style={{
                          textAlign: "left",
                          padding: 10,
                          borderRadius: 8,
                          border: isActive ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                          background: isActive ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                          {(item.author || "Unknown author") + " | " + (item.category || "General")}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          {item.fileUrl ? <span className="badge badge-green">Readable</span> : <span className="badge badge-gray">No File</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 10 }}>{selectedBook ? `Read: ${selectedBook.title}` : "Select a book"}</h3>

              {!selectedBook ? (
                <p style={{ color: "#94a3b8" }}>Select a book from the list to start reading.</p>
              ) : !selectedBookUrl ? (
                <p style={{ color: "#94a3b8" }}>This item has no uploaded PDF file yet.</p>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <a href={selectedBookUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }}>
                      Open In New Tab
                    </a>
                  </div>
                  <iframe
                    title={selectedBook.fileOriginalName || selectedBook.title}
                    src={selectedBookUrl}
                    style={{ width: "100%", height: 620, border: "1px solid #e2e8f0", borderRadius: 8 }}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
