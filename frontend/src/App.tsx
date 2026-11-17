import { useState } from "react";
import NavBar from "./components/NavBar";
import Dashboard from "./views/Dashboard";
import Activity from "./views/Activity";
import HeatmapView from "./views/HeatmapView";
import AdminView from "./views/admin/AdminView";

type View = "dashboard" | "activity" | "heatmap" | "admin";

const BottomIcons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  activity: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="8" width="3" height="6.5" rx="0.75" fill="currentColor" opacity="0.7" />
      <rect x="6.5" y="4" width="3" height="10.5" rx="0.75" fill="currentColor" opacity="0.85" />
      <rect x="11.5" y="1.5" width="3" height="13" rx="0.75" fill="currentColor" />
    </svg>
  ),
  events: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5a4 4 0 00-4 4v4l-1.5 2h11L12 9.5v-4a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  trajectories: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <circle cx="3.5" cy="12.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="3.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 11L11 5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 2" />
    </svg>
  ),
  models: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.1 4.1L6.5 6.5M9.5 6.5L11.9 4.1M4.1 11.9L6.5 9.5M9.5 9.5L11.9 11.9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
};

const NAV_BOTTOM: { id: View | null; label: string; iconKey: keyof typeof BottomIcons; available: boolean }[] = [
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard", available: true },
  { id: "activity", label: "Activities", iconKey: "activity", available: true },
  { id: null, label: "Events", iconKey: "events", available: false },
  { id: null, label: "Trajectories", iconKey: "trajectories", available: false },
  { id: "admin", label: "Models", iconKey: "models", available: true },
];

function MobileTopBar() {
  return (
    <header className="mobile-topbar">
      <img src="/logo.png" alt="PetMonitor AI" style={{ height: 26, objectFit: "contain" }} />
    </header>
  );
}

function BottomNav({ active, onNavigate }: { active: View; onNavigate: (v: View) => void }) {
  return (
    <nav className="bottom-nav">
      {NAV_BOTTOM.map((item) => {
        const isActive = item.id !== null && item.id === active;
        const disabled = !item.available;
        return (
          <button
            key={item.label}
            onClick={() => { if (item.available && item.id !== null) onNavigate(item.id); }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
              padding: "0.55rem 0.25rem 0.45rem",
              color: disabled
                ? "var(--text-muted)"
                : isActive
                ? "var(--teal)"
                : "var(--text-secondary)",
              fontSize: "0.62rem",
              fontWeight: isActive ? 600 : 400,
              background: "transparent",
              border: "none",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <div style={{
              width: 30, height: 26, borderRadius: 6,
              background: isActive ? "rgba(0,180,216,0.12)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.12s",
            }}>
              {BottomIcons[item.iconKey]}
            </div>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="app-shell">
      <NavBar active={view} onNavigate={setView} />
      <div className="main-wrap">
        <MobileTopBar />
        <main className="page-content">
          {view === "dashboard" && <Dashboard onNavigate={setView} />}
          {view === "activity" && <Activity />}
          {view === "heatmap" && <HeatmapView />}
          {view === "admin" && <AdminView />}
        </main>
        <BottomNav active={view} onNavigate={setView} />
      </div>
    </div>
  );
}
