/**
 * API client for communicating with the FastAPI backend.
 * All API calls go through these typed functions.
 */

import type {
  BatchUploadResponse,
  BatchStatusResponse,
  LeaderboardResponse,
  AdminLoginResponse,
  AdminStatsResponse,
  MySubmissionsResponse,
  PromoterLoginResponse,
  EventItem,
  AdminPromoterItem,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Upload screenshots with promoter info for OCR processing.
 */
export async function uploadScreenshots(
  promoterName: string,
  icNumber: string,
  gender: string,
  files: File[],
  event?: string
): Promise<BatchUploadResponse> {
  const formData = new FormData();
  formData.append("promoter_name", promoterName);
  formData.append("ic_number", icNumber);
  formData.append("gender", gender);
  if (event) formData.append("event", event);

  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

/**
 * Poll the processing status of a batch upload.
 */
export async function fetchBatchStatus(
  batchId: string
): Promise<BatchStatusResponse> {
  const res = await fetch(`${API_BASE}/batch/${batchId}/status`);

  if (!res.ok) {
    throw new Error("Failed to fetch batch status");
  }

  return res.json();
}

/**
 * Log in on the phone by IC number.
 * Returns whether the promoter is registered, their name, and the events
 * they can upload to (assigned-open, or all open if unregistered/unassigned).
 */
export async function promoterLogin(icNumber: string): Promise<PromoterLoginResponse> {
  const res = await fetch(`${API_BASE}/promoter/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ic_number: icNumber }),
  });
  if (res.status === 429) throw new Error("Too many attempts. Please wait a minute.");
  if (!res.ok) throw new Error("Login failed. Please try again.");
  return res.json();
}

/** Admin: list all events with counts. */
export async function fetchEvents(token: string): Promise<EventItem[]> {
  const res = await fetch(`${API_BASE}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { sessionStorage.removeItem("admin_token"); throw new Error("Session expired. Please log in again."); }
  if (!res.ok) throw new Error("Failed to load events");
  return res.json();
}

/** Admin: create an event. */
export async function createEvent(token: string, name: string): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/admin/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create event" }));
    throw new Error(err.detail || "Failed to create event");
  }
  return res.json();
}

/** Admin: update an event (rename and/or open/close). */
export async function updateEvent(
  token: string,
  id: number,
  patch: { name?: string; active?: boolean }
): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/admin/events/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update event");
  return res.json();
}

/** Admin: create a promoter with event assignments. */
export async function createPromoter(
  token: string,
  data: { name: string; ic_number: string; gender: string; event_ids: number[] }
): Promise<AdminPromoterItem> {
  const res = await fetch(`${API_BASE}/admin/promoters`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to add promoter" }));
    throw new Error(err.detail || "Failed to add promoter");
  }
  return res.json();
}

/** Admin: update a promoter (name, gender, event assignments). */
export async function updatePromoter(
  token: string,
  id: number,
  patch: { name?: string; gender?: string; event_ids?: number[] }
): Promise<AdminPromoterItem> {
  const res = await fetch(`${API_BASE}/admin/promoters/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update promoter");
  return res.json();
}

/**
 * Fetch the promoter's own submission history by IC number.
 */
export async function fetchMySubmissions(
  icNumber: string
): Promise<MySubmissionsResponse> {
  // POST body keeps the IC number out of URLs, logs, and browser history
  const res = await fetch(`${API_BASE}/my-submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ic_number: icNumber }),
  });
  if (res.status === 429) throw new Error("Too many lookups. Please wait a minute.");
  if (!res.ok) throw new Error("Failed to fetch your uploads");
  return res.json();
}

/**
 * Fetch the real-time leaderboard data.
 */
export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_BASE}/leaderboard`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

/**
 * Authenticate admin with PIN code.
 */
export async function adminLogin(pin: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  if (!res.ok) throw new Error("Login request failed");
  return res.json();
}

/**
 * Fetch admin dashboard stats and submissions.
 * Requires a valid admin token in the Authorization header.
 */
export async function fetchAdminStats(
  token: string,
  statusFilter?: string,
  promoterFilter?: string,
  eventFilter?: string,
  dayFilter?: string
): Promise<AdminStatsResponse> {
  const params = new URLSearchParams();
  if (statusFilter) params.append("status_filter", statusFilter);
  if (promoterFilter) params.append("promoter_filter", promoterFilter);
  if (eventFilter) params.append("event_filter", eventFilter);
  if (dayFilter) params.append("day_filter", dayFilter);

  const url = `${API_BASE}/admin/stats${params.toString() ? "?" + params.toString() : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    // Token expired or invalid — clear it
    sessionStorage.removeItem("admin_token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error("Failed to fetch admin data");
  return res.json();
}

/**
 * Download all campaign data as an Excel file (.xlsx).
 * Fetches with the admin token, then triggers a browser download.
 */
export async function downloadExport(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    sessionStorage.removeItem("admin_token");
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) throw new Error("Export failed. Please try again.");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "promoter-data.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Delete a submission by ID.
 * Requires a valid admin token in the Authorization header.
 */
export async function deleteSubmission(
  token: string,
  submissionId: number
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/admin/submission/${submissionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    sessionStorage.removeItem("admin_token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(err.detail || "Delete failed");
  }

  return res.json();
}

/**
 * Delete multiple submissions by their IDs.
 * Requires a valid admin token in the Authorization header.
 */
export async function deleteSubmissionsBatch(
  token: string,
  ids: number[]
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  const res = await fetch(`${API_BASE}/admin/submissions/batch-delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  if (res.status === 401) {
    sessionStorage.removeItem("admin_token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Batch delete failed" }));
    throw new Error(err.detail || "Batch delete failed");
  }

  return res.json();
}

/**
 * Fetch all registered promoters for admin verification.
 * Requires a valid admin token in the Authorization header.
 */
export async function fetchAdminPromoters(
  token: string
): Promise<AdminPromoterItem[]> {
  const res = await fetch(`${API_BASE}/admin/promoters`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    sessionStorage.removeItem("admin_token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error("Failed to fetch promoters list");
  return res.json();
}

