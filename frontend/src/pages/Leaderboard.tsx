/**
 * Leaderboard — Home page with live campaign stats and rankings.
 * Clean Baito-branded layout: gradient hero, stat cards, top-3 podium, full table.
 */

import { Link } from "react-router-dom";
import { fetchLeaderboard } from "../utils/api";
import { usePolling } from "../hooks/usePolling";

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src && (src.startsWith("http") || src.startsWith("/") || src.startsWith("data:"))) {
    return <img src={src} alt={name} />;
  }
  // Initials fallback on brand gradient
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (
    <svg viewBox="0 0 40 40">
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#69C5E9" />
          <stop offset="100%" stopColor="#0066CC" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill="url(#bg-grad)" />
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#fff"
        fontSize="15"
        fontFamily="'Funnel Display', sans-serif"
        fontWeight="600"
      >
        {initials}
      </text>
    </svg>
  );
}

export default function Leaderboard() {
  const { data, loading, error } = usePolling(fetchLeaderboard, 5000);

  const entries = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxCount = entries[0]?.valid_count || 1;

  return (
    <div className="page">
      {/* Hero */}
      <header className="lb-hero">
        <div className="lb-hero-eyebrow">Baito · Promoter Tracker</div>
        <h1 className="lb-hero-title">Every signup, counted and verified.</h1>
        <Link to="/upload" className="btn btn-primary">
          Upload Proof
        </Link>
      </header>

      {loading && !data && (
        <div className="spinner-overlay">
          <div className="spinner" />
          <p className="spinner-text">Loading leaderboard…</p>
        </div>
      )}

      {error && !data && (
        <div className="empty-state">
          <div className="empty-title">Connection failed</div>
          <div className="empty-text">{error}</div>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <section className="stats-bar">
            <div className="stat-card">
              <div className="stat-label">Promoters</div>
              <div className="stat-value">{data.total_promoters}</div>
              <div className="stat-hint">active</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valid Signups</div>
              <div className="stat-value">{data.total_valid}</div>
              <div className="stat-hint">verified & unique</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today</div>
              <div className="stat-value">{data.today_valid}</div>
              <div className="stat-hint">new signups</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Promoter</div>
              <div className="stat-value" style={{ fontSize: "1.15rem", paddingTop: 5 }}>
                {entries[0]?.promoter_name || "—"}
              </div>
              <div className="stat-hint">
                {entries[0] ? `${entries[0].valid_count} signups` : "no data yet"}
              </div>
            </div>
          </section>

          {/* Top 3 podium */}
          {top3.length > 0 && (
            <section className="podium-row">
              {top3.map((entry, i) => (
                <div className={`podium-card ${i === 0 ? "first" : ""}`} key={entry.rank} style={{ order: i === 0 ? 1 : i === 1 ? 0 : 2 }}>
                  <div className="podium-rank">{i + 1}</div>
                  <div className="podium-avatar">
                    <Avatar src={entry.avatar} name={entry.promoter_name} />
                  </div>
                  <div className="podium-name">{entry.promoter_name}</div>
                  <div className="podium-count">{entry.valid_count}</div>
                  <div className="podium-unit">signups</div>
                </div>
              ))}
            </section>
          )}

          {/* Full rankings */}
          {rest.length > 0 && (
            <section className="lb-table-card">
              {rest.map((entry) => (
                <div className="lb-row" key={entry.rank}>
                  <div className="lb-rank">{entry.rank}</div>
                  <div className="lb-avatar">
                    <Avatar src={entry.avatar} name={entry.promoter_name} />
                  </div>
                  <div className="lb-name">{entry.promoter_name}</div>
                  <div className="lb-bar-group">
                    <div className="lb-track">
                      <div
                        className="lb-fill"
                        style={{
                          width: `${Math.min(100, Math.max(4, (entry.valid_count / maxCount) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="lb-count">{entry.valid_count}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {entries.length === 0 && (
            <div className="glass-card empty-state">
              <div className="empty-title">No signups yet</div>
              <div className="empty-text">Rankings will appear as promoters upload proofs.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
