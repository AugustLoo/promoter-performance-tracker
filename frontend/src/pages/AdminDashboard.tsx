/**
 * Admin Dashboard Page — Protected view for administrators.
 *
 * Features:
 *  - Stats overview cards (total, valid, duplicate, OCR failed)
 *  - Clickable stat cards to filter submissions by status
 *  - Submissions table with promoter name, username, status badge, timestamp
 *  - Clickable image paths to preview uploaded screenshots
 *  - Auto-refreshes every 10 seconds
 *  - Logout button to clear session
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminStats,
  deleteSubmission,
  deleteSubmissionsBatch,
  fetchAdminPromoters,
  downloadExport,
  fetchEvents,
  createEvent,
  updateEvent,
  createPromoter,
  updatePromoter,
} from "../utils/api";
import type { AdminStatsResponse, EventItem, AdminPromoterItem } from "../types";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [eventFilter, setEventFilter] = useState<string>("");
  const [dayFilter, setDayFilter] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPromotersModal, setShowPromotersModal] = useState(false);
  const [promotersList, setPromotersList] = useState<AdminPromoterItem[]>([]);
  const [promotersLoading, setPromotersLoading] = useState(false);
  const [promotersError, setPromotersError] = useState<string | null>(null);

  // Events management
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [manageError, setManageError] = useState<string | null>(null);

  // Add-promoter form (inside Team modal)
  const [newProm, setNewProm] = useState({ name: "", ic_number: "", gender: "female", event_ids: [] as number[] });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const token = sessionStorage.getItem("admin_token");

  // Redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate("/admin", { replace: true });
    }
  }, [token, navigate]);

  // Fetch data
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const result = await fetchAdminStats(
        token,
        statusFilter || undefined,
        undefined,
        eventFilter || undefined,
        dayFilter || undefined
      );
      setData(result);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message.includes("expired")) {
        sessionStorage.removeItem("admin_token");
        navigate("/admin", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, eventFilter, dayFilter, navigate]);

  // Initial load and polling
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Logout
  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    navigate("/admin", { replace: true });
  };

  // One-click Excel export of all data
  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      await downloadExport(token);
    } catch (err) {
      if (err instanceof Error && err.message.includes("expired")) {
        sessionStorage.removeItem("admin_token");
        navigate("/admin", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Select row handler
  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all handler
  const handleSelectAll = (visibleSubmissions: any[]) => {
    const visibleIds = visibleSubmissions.map((sub) => sub.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const newSelected = [...prev];
        visibleIds.forEach((id) => {
          if (!newSelected.includes(id)) {
            newSelected.push(id);
          }
        });
        return newSelected;
      });
    }
  };

  // Batch delete handler
  const handleBatchDeleteClick = () => {
    setShowBatchConfirmModal(true);
  };

  const executeBatchDelete = async () => {
    try {
      if (!token) return;
      setShowBatchConfirmModal(false);
      setLoading(true);
      await deleteSubmissionsBatch(token, selectedIds);
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete submissions");
    } finally {
      setLoading(false);
    }
  };

  // Promoters card click handler
  const handlePromotersCardClick = async () => {
    if (!token) return;
    setShowPromotersModal(true);
    setPromotersLoading(true);
    setPromotersError(null);
    try {
      const [list, evs] = await Promise.all([fetchAdminPromoters(token), fetchEvents(token)]);
      setPromotersList(list);
      setEventsList(evs);
    } catch (err) {
      setPromotersError(err instanceof Error ? err.message : "Failed to load promoters");
    } finally {
      setPromotersLoading(false);
    }
  };

  // ── Events management ──
  const openEventsModal = async () => {
    if (!token) return;
    setShowEventsModal(true);
    setManageError(null);
    setEventsBusy(true);
    try {
      setEventsList(await fetchEvents(token));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setEventsBusy(false);
    }
  };

  const handleAddEvent = async () => {
    if (!token || !newEventName.trim()) return;
    setManageError(null);
    try {
      await createEvent(token, newEventName.trim());
      setNewEventName("");
      setEventsList(await fetchEvents(token));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Failed to add event");
    }
  };

  const handleToggleEvent = async (ev: EventItem) => {
    if (!token) return;
    setManageError(null);
    try {
      await updateEvent(token, ev.id, { active: !ev.active });
      setEventsList(await fetchEvents(token));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Failed to update event");
    }
  };

  // ── Team / roster management ──
  const reloadPromoters = async () => {
    if (!token) return;
    setPromotersList(await fetchAdminPromoters(token));
  };

  const handleAddPromoter = async () => {
    if (!token || !newProm.name.trim() || !newProm.ic_number.trim()) return;
    setPromotersError(null);
    try {
      await createPromoter(token, {
        name: newProm.name.trim(),
        ic_number: newProm.ic_number.trim(),
        gender: newProm.gender,
        event_ids: newProm.event_ids,
      });
      setNewProm({ name: "", ic_number: "", gender: "female", event_ids: [] });
      await reloadPromoters();
    } catch (err) {
      setPromotersError(err instanceof Error ? err.message : "Failed to add promoter");
    }
  };

  const handleTogglePromoterEvent = async (prom: AdminPromoterItem, eventId: number) => {
    if (!token) return;
    const next = prom.event_ids.includes(eventId)
      ? prom.event_ids.filter((id) => id !== eventId)
      : [...prom.event_ids, eventId];
    try {
      await updatePromoter(token, prom.id, { event_ids: next });
      await reloadPromoters();
    } catch (err) {
      setPromotersError(err instanceof Error ? err.message : "Failed to update assignment");
    }
  };

  const toggleNewPromEvent = (eventId: number) => {
    setNewProm((prev) => ({
      ...prev,
      event_ids: prev.event_ids.includes(eventId)
        ? prev.event_ids.filter((id) => id !== eventId)
        : [...prev.event_ids, eventId],
    }));
  };

  // Delete submission handler
  const handleDeleteClick = (id: number) => {
    if (deleteConfirmId === id) {
      executeDelete(id);
    } else {
      setDeleteConfirmId(id);
      // Auto-reset after 8 seconds (gives the user plenty of time)
      setTimeout(() => {
        setDeleteConfirmId((currentId) => (currentId === id ? null : currentId));
      }, 8000);
    }
  };

  const executeDelete = async (id: number) => {
    try {
      if (!token) return;
      setDeleteConfirmId(null);
      await deleteSubmission(token, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete submission");
    }
  };

  // Filter click
  const handleFilterClick = (filter: string) => {
    setStatusFilter((prev) => (prev === filter ? "" : filter));
    setLoading(true);
  };

  // Format timestamp
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (!token) return null;

  return (
    <div className="page page-wide">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1 className="section-title" style={{ textAlign: "left", marginBottom: 4 }}>
            ⚙️ Admin Dashboard
          </h1>
          <p className="section-subtitle" style={{ textAlign: "left" }}>
            Monitor all submissions and promoter activity
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={openEventsModal}>
            🎪 Events
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePromotersCardClick}>
            👥 Team
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Preparing…" : "⬇ Download Excel"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="spinner-overlay">
          <div className="spinner" />
          <p className="spinner-text">Loading dashboard...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            color: "var(--danger)",
            padding: "14px 18px",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 20,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {data && (
        <>
          {/* Stats Cards */}
          <div className="admin-stats-grid">
            <div
              className={`glass-card admin-stat-card ${statusFilter === "" ? "active" : ""}`}
              onClick={() => handleFilterClick("")}
            >
              <div className="admin-stat-value" style={{ color: "var(--text-primary)" }}>
                {data.total_submissions}
              </div>
              <div className="admin-stat-label">All</div>
            </div>
            <div
              className={`glass-card admin-stat-card ${statusFilter === "valid" ? "active" : ""}`}
              onClick={() => handleFilterClick("valid")}
            >
              <div className="admin-stat-value" style={{ color: "var(--success)" }}>
                {data.total_valid}
              </div>
              <div className="admin-stat-label">Valid</div>
            </div>
            <div
              className={`glass-card admin-stat-card ${statusFilter === "duplicate" ? "active" : ""}`}
              onClick={() => handleFilterClick("duplicate")}
            >
              <div className="admin-stat-value" style={{ color: "var(--danger)" }}>
                {data.total_duplicate}
              </div>
              <div className="admin-stat-label">Duplicate</div>
            </div>
            <div
              className={`glass-card admin-stat-card ${statusFilter === "ocr_failed" ? "active" : ""}`}
              onClick={() => handleFilterClick("ocr_failed")}
            >
              <div className="admin-stat-value" style={{ color: "var(--warning)" }}>
                {data.total_ocr_failed}
              </div>
              <div className="admin-stat-label">OCR Failed</div>
            </div>
            <div 
              className="glass-card admin-stat-card clickable"
              onClick={handlePromotersCardClick}
            >
              <div className="admin-stat-value" style={{ color: "var(--accent)" }}>
                {data.total_promoters}
              </div>
              <div className="admin-stat-label">Promoters</div>
            </div>
          </div>

          {/* Event / Day filters */}
          {(data.events.length > 0 || data.days.length > 0) && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <select
                className="form-input"
                style={{ maxWidth: 240 }}
                value={eventFilter}
                onChange={(e) => {
                  setEventFilter(e.target.value);
                  setLoading(true);
                }}
              >
                <option value="">All events</option>
                {data.events.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                style={{ maxWidth: 200 }}
                value={dayFilter}
                onChange={(e) => {
                  setDayFilter(e.target.value);
                  setLoading(true);
                }}
              >
                <option value="">All days</option>
                {data.days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {(eventFilter || dayFilter) && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEventFilter("");
                    setDayFilter("");
                    setLoading(true);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Submissions Table */}
          <div className="glass-card admin-table-wrapper">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              padding: "0 4px"
            }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                {statusFilter ? `${statusFilter.toUpperCase().replace("_", " ")} Submissions` : "All Submissions"}
              </h3>
              {selectedIds.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBatchDeleteClick}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  🗑 Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>
            {data.submissions.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={data.submissions.every((sub) => selectedIds.includes(sub.id))}
                        onChange={() => handleSelectAll(data.submissions)}
                        style={{ cursor: "pointer", width: 16, height: 16 }}
                      />
                    </th>
                    <th>#</th>
                    <th>Promoter</th>
                    <th>Username</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((sub) => (
                    <tr key={sub.id} className={sub.status === "valid" && !sub.member_id ? "needs-review" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sub.id)}
                          onChange={() => handleSelectRow(sub.id)}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                      </td>
                      <td className="muted">{sub.id}</td>
                      <td>{sub.promoter_name}</td>
                      <td>
                        {sub.extracted_username ? (
                          <span className="username-cell">{sub.extracted_username}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                        {sub.member_id ? (
                          <div className="muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                            ID {sub.member_id}
                          </div>
                        ) : sub.status === "valid" ? (
                          <div style={{ fontSize: "0.72rem", marginTop: 2, color: "var(--warning-text)", fontWeight: 600 }}>
                            ⚠ No ID — check
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {sub.event ? sub.event : <span className="muted">—</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${sub.status}`}>
                          {sub.status === "valid" && "✓ "}
                          {sub.status === "duplicate" && "✗ "}
                          {sub.status === "ocr_failed" && "? "}
                          {sub.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="time-cell">{formatTime(sub.created_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => setPreviewImage(`/uploads/${sub.image_path}`)}
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          >
                            👁 View
                          </button>
                          <button
                            className={`btn ${deleteConfirmId === sub.id ? "btn-danger" : "btn-danger btn-sm"}`}
                            type="button"
                            onClick={() => handleDeleteClick(sub.id)}
                            style={{ 
                              padding: "4px 10px", 
                              fontSize: "0.75rem",
                              background: deleteConfirmId === sub.id ? "#dc2626" : undefined,
                              borderColor: deleteConfirmId === sub.id ? "#dc2626" : undefined
                            }}
                          >
                            {deleteConfirmId === sub.id ? "⚠️ Confirm?" : "🗑 Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">No Submissions Found</div>
                <div className="empty-text">
                  {statusFilter
                    ? `No submissions with status "${statusFilter}".`
                    : "No submissions have been made yet."}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="image-preview-overlay"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Submission preview" />
        </div>
      )}

      {/* Events Management Modal */}
      {showEventsModal && (
        <div className="modal-overlay" onClick={() => setShowEventsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🎪 Events</h2>
              <button className="modal-close" onClick={() => setShowEventsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  className="form-input"
                  placeholder="New event name (e.g. MyTown Concourse)"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddEvent} disabled={!newEventName.trim()}>
                  Add
                </button>
              </div>
              {manageError && <div className="error-alert" style={{ marginBottom: 12 }}>{manageError}</div>}
              {eventsBusy ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}><div className="spinner" /></div>
              ) : eventsList.length === 0 ? (
                <div className="empty-text">No events yet. Add one above.</div>
              ) : (
                <div className="modal-table-wrapper">
                  <table className="modal-table">
                    <thead>
                      <tr><th>Event</th><th>Valid</th><th>Uploads</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {eventsList.map((ev) => (
                        <tr key={ev.id}>
                          <td style={{ fontWeight: 600 }}>{ev.name}</td>
                          <td>{ev.valid_count}</td>
                          <td>{ev.total_uploads}</td>
                          <td>
                            <button
                              className={`btn btn-sm ${ev.active ? "btn-secondary" : "btn-primary"}`}
                              onClick={() => handleToggleEvent(ev)}
                            >
                              {ev.active ? "Open · Close it" : "Closed · Open it"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team / Roster Modal */}
      {showPromotersModal && (
        <div className="modal-overlay" onClick={() => setShowPromotersModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">👥 Team</h2>
              <button className="modal-close" onClick={() => setShowPromotersModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Add promoter */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 14, marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Add promoter</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="Name"
                    value={newProm.name} onChange={(e) => setNewProm({ ...newProm, name: e.target.value })} />
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="IC number"
                    value={newProm.ic_number} onChange={(e) => setNewProm({ ...newProm, ic_number: e.target.value })} />
                  <select className="form-input" style={{ maxWidth: 120 }}
                    value={newProm.gender} onChange={(e) => setNewProm({ ...newProm, gender: e.target.value })}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                {eventsList.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {eventsList.map((ev) => (
                      <label key={ev.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.82rem" }}>
                        <input type="checkbox" checked={newProm.event_ids.includes(ev.id)} onChange={() => toggleNewPromEvent(ev.id)} />
                        {ev.name}
                      </label>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary btn-sm" onClick={handleAddPromoter}
                  disabled={!newProm.name.trim() || !newProm.ic_number.trim()}>
                  Add to team
                </button>
              </div>

              {promotersError && <div className="error-alert" style={{ marginBottom: 12 }}>{promotersError}</div>}

              {promotersLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}><div className="spinner" /></div>
              ) : (
                <div className="modal-table-wrapper">
                  <table className="modal-table">
                    <thead>
                      <tr><th>Name</th><th>IC</th><th>Signups</th><th>Assigned events</th></tr>
                    </thead>
                    <tbody>
                      {promotersList.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td><code>{p.ic_number}</code></td>
                          <td>{p.valid_count}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {eventsList.length === 0 ? (
                                <span className="muted">—</span>
                              ) : (
                                eventsList.map((ev) => {
                                  const on = p.event_ids.includes(ev.id);
                                  return (
                                    <button
                                      key={ev.id}
                                      className={`status-badge ${on ? "valid" : ""}`}
                                      style={{ cursor: "pointer", border: on ? "none" : "1px solid var(--border)", background: on ? undefined : "transparent", color: on ? undefined : "var(--text-muted)" }}
                                      onClick={() => handleTogglePromoterEvent(p, ev.id)}
                                      title={on ? "Assigned — click to remove" : "Not assigned — click to assign"}
                                    >
                                      {ev.name}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowBatchConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">⚠️ Confirm Batch Delete</h2>
              <button className="modal-close" onClick={() => setShowBatchConfirmModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "30px 24px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗑️</div>
              <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>
                Are you sure you want to delete {selectedIds.length} submissions?
              </p>
              <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 24 }}>
                This will release the unique username constraints in the database and permanently delete the uploaded image files. This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowBatchConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={executeBatchDelete}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
