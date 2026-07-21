/**
 * Upload Page — Snap or select membership photos, upload, watch OCR results live.
 *
 * Flow:
 *  1. Promoter fills name + IC once (remembered on this phone)
 *  2. Snap Photo (camera) or Choose Photos (gallery)
 *  3. Submit → instant upload, then real-time per-photo OCR status
 *  4. Done → summary + link to My Uploads history
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { savePromoterInfo, loadPromoterInfo, clearPromoterInfo } from "../utils/storage";
import { compressImages } from "../utils/compress";
import { uploadScreenshots, fetchBatchStatus } from "../utils/api";
import UploadZone from "../components/UploadZone";
import type { BatchStatusResponse } from "../types";

const STATUS_LABEL: Record<string, string> = {
  valid: "Registered",
  duplicate: "Duplicate",
  ocr_failed: "Failed",
  pending: "Processing",
};

export default function Upload() {
  const [name, setName] = useState("");
  const [icNumber, setIcNumber] = useState("");
  const [gender, setGender] = useState("female");
  const [remembered, setRemembered] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = loadPromoterInfo();
    if (saved) {
      setName(saved.name);
      setIcNumber(saved.ic_number);
      if (saved.gender) setGender(saved.gender);
      setRemembered(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearSaved = () => {
    clearPromoterInfo();
    setName("");
    setIcNumber("");
    setGender("female");
    setRemembered(false);
  };

  const handleReset = () => {
    setBatchId(null);
    setBatchStatus(null);
    setFiles([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !icNumber.trim()) {
      setError("Please fill in your name and IC number.");
      return;
    }
    if (files.length === 0) {
      setError("Please snap or select at least one photo.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      savePromoterInfo({ name: name.trim(), ic_number: icNumber.trim(), gender });
      setRemembered(true);

      const compressed = await compressImages(files);
      const response = await uploadScreenshots(name.trim(), icNumber.trim(), gender, compressed);

      setBatchId(response.batch_id);
      setFiles([]);
      startPolling(response.batch_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

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
            {allDone
              ? `All ${total} photo${total !== 1 ? "s" : ""} processed.`
              : `${completed} of ${total} photo${total !== 1 ? "s" : ""} processed…`}
          </p>
        </div>

        <div className="glass-card">
          <div className="processing-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="progress-label">
              {progressPercent}% ({completed}/{total})
            </div>
          </div>

          {allDone && (
            <div className="processing-summary">
              <div className="summary-stat valid">
                <span className="summary-value">{validCount}</span>
                <span className="summary-label">Registered</span>
              </div>
              <div className="summary-stat duplicate">
                <span className="summary-value">{dupCount}</span>
                <span className="summary-label">Duplicate</span>
              </div>
              <div className="summary-stat failed">
                <span className="summary-value">{failCount}</span>
                <span className="summary-label">Failed</span>
              </div>
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
                <span className={`status-badge ${item.status}`}>
                  {STATUS_LABEL[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>

          {allDone ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary btn-full" onClick={handleReset}>
                Upload More
              </button>
              <Link to="/my-uploads" className="btn btn-secondary btn-full">
                View My Uploads
              </Link>
            </div>
          ) : (
            <div className="processing-indicator">
              <div className="spinner-small" />
              <span>Reading your photos…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Upload form ──
  return (
    <div className="page page-narrow">
      <div className="section-header">
        <h1 className="section-title">Upload Proof</h1>
        <p className="section-subtitle">
          Snap a photo of the customer's membership screen — we'll read the name and member ID
          automatically.
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          {remembered && (
            <div className="remember-banner">
              <span>
                Welcome back, <strong>{name}</strong>
              </span>
              <button type="button" className="remember-banner-clear" onClick={handleClearSaved}>
                Not you?
              </button>
            </div>
          )}

          {!remembered && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="promoter-name">
                  Your Name
                </label>
                <input
                  id="promoter-name"
                  className="form-input"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ic-number">
                  IC Number
                </label>
                <input
                  id="ic-number"
                  className="form-input"
                  type="text"
                  placeholder="e.g. 010203-10-1234"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  required
                  maxLength={50}
                />
                <p className="form-hint">Used only to identify you. Never shown publicly.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <div className="gender-toggle-group">
                  <button
                    type="button"
                    className={`gender-btn ${gender === "male" ? "active" : ""}`}
                    onClick={() => setGender("male")}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    className={`gender-btn ${gender === "female" ? "active" : ""}`}
                    onClick={() => setGender("female")}
                  >
                    Female
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Photos</label>
            <UploadZone
              files={files}
              onFilesSelected={handleFilesSelected}
              onRemoveFile={handleRemoveFile}
              maxFiles={20}
            />
          </div>

          {error && (
            <div className="error-alert" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={uploading || files.length === 0}
          >
            {uploading ? (
              <>
                <div className="spinner-small" style={{ borderTopColor: "#fff" }} />
                Uploading…
              </>
            ) : files.length > 0 ? (
              `Upload ${files.length} Photo${files.length !== 1 ? "s" : ""}`
            ) : (
              "Upload"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
