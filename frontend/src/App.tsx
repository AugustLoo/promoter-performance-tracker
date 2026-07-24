/**
 * App — Root component with route configuration.
 */

import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Leaderboard from "./pages/Leaderboard";
import Upload from "./pages/Upload";
import MyUploads from "./pages/MyUploads";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <div className="app-container">
      <Navbar />

      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/my-uploads" element={<MyUploads />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Leaderboard />} />
      </Routes>
    </div>
  );
}
