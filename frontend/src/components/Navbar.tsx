/**
 * Navbar — Fixed top navigation with Baito branding.
 * Links: Upload (primary task), My Uploads (history), Leaderboard.
 */

import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <NavLink to="/" className="navbar-brand">
          <div className="navbar-brand-mark" />
          <span>BaitoTrack</span>
        </NavLink>

        <div className="navbar-links">
          <NavLink
            to="/upload"
            className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
          >
            Upload
          </NavLink>

          <NavLink
            to="/my-uploads"
            className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
          >
            My Uploads
          </NavLink>

          <NavLink
            to="/"
            end
            className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
          >
            Leaderboard
          </NavLink>

          <NavLink to="/admin" className="navbar-admin-btn" style={{ marginLeft: 8 }}>
            Admin
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
