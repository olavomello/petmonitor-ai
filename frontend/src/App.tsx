import { useState, useEffect } from "react";
import NavBar from "./components/NavBar";
import Dashboard from "./views/Dashboard";
import Activity from "./views/Activity";
import HeatmapView from "./views/HeatmapView";
import AdminView from "./views/admin/AdminView";
import EventsView from "./views/EventsView";
import CameraView from "./views/CameraView";
import SettingsView from "./views/SettingsView";
import { NavIcons, NAV_BOTTOM, type View } from "./nav";

type Theme = "dark" | "light";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function MobileTopBar({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <header className="mobile-topbar">
      <img src="/logo-white.png" alt="PetMonitor AI" style={{ height: 26, objectFit: "contain", flex: 1 }} />
      <button className="theme-toggle" onClick={onToggle} aria-label="Toggle theme">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
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
              {NavIcons[item.iconKey](20)}
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
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("theme") as Theme) || "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  function toggleTheme() { setTheme(t => t === "dark" ? "light" : "dark"); }

  return (
    <div className="app-shell">
      <NavBar active={view} onNavigate={setView} />
      <div className="main-wrap">
        <MobileTopBar theme={theme} onToggle={toggleTheme} />
        <div className="desktop-topbar">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <main className="page-content">
          {view === "dashboard" && <Dashboard onNavigate={setView} />}
          {view === "activity" && <Activity />}
          {view === "events" && <EventsView />}
          {view === "heatmap" && <HeatmapView />}
          {view === "camera" && <CameraView onNavigate={(v) => setView(v)} />}
          {view === "admin" && <AdminView />}
          {view === "settings" && <SettingsView />}
        </main>
        <BottomNav active={view} onNavigate={setView} />
      </div>
    </div>
  );
}
