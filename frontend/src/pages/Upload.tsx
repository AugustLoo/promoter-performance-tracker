/**
 * Upload Page — IC login, then snap & upload in one tap.
 *
 * Flow:
 *  1. Promoter enters their IC number → login.
 *     - Registered by admin: name loads, sees only their assigned open events.
 *     - Not registered: types their name (self-register), sees all open events.
 *  2. Pick event (remembered) → Snap & Upload → results.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { savePromoterInfo, loadPromoterInfo, clearPromoterInfo } from "../utils/storage";
import { compressImages } from "../utils/compress";
import { uploadScreenshots, fetchBatchStatus, promoterLogin } from "../utils/api";
import UploadZone from "../components/UploadZone";
import type { BatchStatusResponse, EventOption } from "../types";

const STATUS_LABEL: Record<string, string> = {
  valid: "Registered",
  duplicate: "Duplicate",
  ocr_failed: "Failed",
  pending: "Processing",
};

export default function Upload() {
  // Identity / login
  const [ic, setIc] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("female");
  const [loggedIn, setLoggedIn] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [event, setEvent] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Upload
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyLogin = useCallback(
    (resp: Awaited<ReturnType<typeof promoterLogin>>, savedEvent?: string) => {
      setRegistered(resp.registered);
      if (resp.registered && resp.name) setName(resp.name);
      if (resp.gender) setGender(resp.gender);
      setEvents(resp.events);
      // Restore previously-picked event if it's still available
      if (savedEvent && resp.events.some((e) => e.name === savedEvent)) {
        setEvent(savedEvent);
      } else if (resp.events.length === 1) {
        setEvent(resp.events[0].name);
      }
      setLoggedIn(true);
    },
    []
  );

  // Auto-login from a saved IC on this phone
  useEffect(() => {
    const saved = loadPromoterInfo();
    if (!saved?.ic_number) return;
    setIc(saved.ic_number);
    setName(saved.name);
    if (saved.gender) setGender(saved.gender);
    promoterLogin(saved.ic_number)
      .then((resp) => applyLogin(resp, saved.event))
      .catch(() => {
        /* stay on login step if it fails */
      });
  }, [applyLogin]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ic.trim()) {
      setLoginError("Enter your IC number.");
      return;
    }
    setLoginError(null);
    setLoggingIn(true);
    try {
      const resp = await promoterLogin(ic.trim());
      applyLogin(resp);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearPromoterInfo();
    setIc("");
    setName("");
    setGender("female");
    setEvent("");
    setEvents([]);
    setRegistered(false);
    setLoggedIn(false);
  };

  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const poll = async () => {
      try {
        const status = await fetchBatchStatus(id);
        setBatchStatus(status);
        if (status.pending === 0 && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 1500);
  }, []);

  const doUpload = useCallback(
    async (toUpload: File[]) => {
      if (!event.trim()) {
        setError("Pick your event/location first.");
        return;
      }
      if (!name.trim()) {
        setError("Enter your name first.");
        return;
      }
      if (toUpload.length === 0) return;

      setError(null);
      setUploading(true);
      try {
        savePromoterInfo({
          name: name.trim(),
          ic_number: ic.trim(),
          gender,
          event: event.trim(),
        });
        const compressed = await compressImages(toUpload);
        const response = await uploadScreenshots(name.trim(), ic.trim(), gender, compressed, event.trim());
        setFiles([]);
        setBatchId(response.batch_id);
        startPolling(response.batch_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [event, name, ic, gender, startPolling]
  );

  const handleCameraCapture = (captured: File[]) => {
    if (!event.trim() || !name.trim()) {
      setFiles((prev) => [...prev, ...captured]);
      setError(!event.trim() ? "Pick your event/location first, then snap." : "Enter your name first.");
      return;
    }
    doUpload(captured);
  };

  const handleGallerySelect = (selected: File[]) => setFiles((prev) => [...prev, ...selected]);
  const handleRemoveFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const handleReset = () => {
    setBatchId(null);
    setBatchStatus(null);
    setFiles([]);
    setError(null);
  };

  // ── Login step ──
  if (!loggedIn) {
    return (
      <div className="page page-narrow">
        <div className="section-header">
          <h1 className="section-title">Sign in</h1>
          <p className="section-subtitle">Enter your IC number to start.</p>
        </div>
        <div className="glass-card">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-ic">
                IC Number
              </label>
              <input
                id="login-ic"
                className="form-input"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 010203101234"
                value={ic}
                onChange={(e) => setIc(e.target.value)}
                autoFocus
              />
            </div>
            {loginError && <div className="error-alert" style={{ marginBottom: 14 }}>{loginError}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loggingIn}>
              {loggingIn ? "Checking…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Processing / results view ──
  if (batchId && batchStatus) {
    const { total, completed, pending, results } = batchStatus;
    const allDone = pending === 0;
    const validCount = results.filter((r) => r.status === "valid").length;
    const dupCount = results.filter((r) => r.status === "duplicate").length;
    const failCount = results.filter((r) => r.status === "ocr_failed").length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <div className="page page-narrow">
        <div className="section-header">
          <h1 className="section-title">{allDone ? "Done" : "Processing"}</h1>
          <p className="section-subtitle">
            {event ? `${event} · ` : ""}
            {allDone ? `${total} photo${total !== 1 ? "s" : ""} processed.` : `${completed} of ${total}…`}
          </p>
        </div>

        <div className="glass-card">
          {!allDone && (
            <div className="processing-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="progress-label">{progressPercent}% ({completed}/{total})</div>
            </div>
          )}

          {allDone && (
            <div className="processing-summary">
              <div className="summary-stat valid"><span className="summary-value">{validCount}</span><span className="summary-label">Registered</span></div>
              <div className="summary-stat duplicate"><span className="summary-value">{dupCount}</span><span className="summary-label">Duplicate</span></div>
              <div className="summary-stat failed"><span className="summary-value">{failCount}</span><span className="summary-label">Failed</span></div>
            </div>
          )}

          <div className="processing-results">
            {results.map((item, index) => (
              <div className={`processing-item ${item.status}`} key={index}>
                {item.status === "pending" && <div className="spinner-small" />}
                <div className="processing-item-details">
                  <div className="processing-item-filename">
                    {item.full_name || `Photo ${index + 1}`}
                    {item.member_id ? ` · ID ${item.member_id}` : ""}
                  </div>
                  <div className="processing-item-message">
                    {item.status === "pending" ? "Reading photo…" : item.message}
                  </div>
                </div>
                <span className={`status-badge ${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span>
              </div>
            ))}
          </div>

          {allDone ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary btn-full" onClick={handleReset}>Snap Next</button>
              <Link to="/my-uploads" className="btn btn-secondary btn-full">View My Uploads</Link>
            </div>
          ) : (
            <div className="processing-indicator">
              <div className="spinner-small" />
              <span>Reading your photo…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Snap & upload view ──
  const noEvents = events.length === 0;

  return (
    <div className="page page-narrow">
      <div className="section-header">
        <h1 className="section-title">Snap & Upload</h1>
        <p className="section-subtitle">
          Point at the customer's membership screen and shoot — we read the name and member ID
          automatically.
        </p>
      </div>

      <div className="glass-card">
        <div className="remember-banner">
          <span>
            {registered ? "Signed in as " : "Uploading as "}
            <strong>{name || "you"}</strong>
          </span>
          <button type="button" className="remember-banner-clear" onClick={handleLogout}>
            Not you?
          </button>
        </div>

        {/* Self-register promoters supply their name */}
        {!registered && (
          <div className="form-group">
            <label className="form-label" htmlFor="promoter-name">Your Name</label>
            <input
              id="promoter-name"
              className="form-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
        )}

        {/* Event picker (from the events assigned/open to this promoter) */}
        <div className="form-group">
          <label className="form-label" htmlFor="event-select">Event / Location</label>
          {noEvents ? (
            <div className="upload-zone-warning">No events are open right now — ask your admin to open one.</div>
          ) : (
            <select
              id="event-select"
              className="form-input"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            >
              <option value="">Select event…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.name}>{ev.name}</option>
              ))}
            </select>
          )}
        </div>

        <UploadZone
          files={files}
          onCameraCapture={handleCameraCapture}
          onGallerySelect={handleGallerySelect}
          onRemoveFile={handleRemoveFile}
          maxFiles={20}
          busy={uploading}
        />

        {error && <div className="error-alert" style={{ marginTop: 14 }}>{error}</div>}

        {files.length > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ marginTop: 14 }}
            onClick={() => doUpload(files)}
            disabled={uploading || !event.trim() || !name.trim()}
          >
            {uploading ? "Uploading…" : `Upload ${files.length} Photo${files.length !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}
