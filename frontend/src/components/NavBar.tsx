type View = "dashboard" | "activity" | "heatmap" | "admin";

interface Props {
  active: View;
  onNavigate: (v: View) => void;
}

const Icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="8" width="3" height="6.5" rx="0.75" fill="currentColor" opacity="0.7" />
      <rect x="6.5" y="4" width="3" height="10.5" rx="0.75" fill="currentColor" opacity="0.85" />
      <rect x="11.5" y="1.5" width="3" height="13" rx="0.75" fill="currentColor" />
    </svg>
  ),
  events: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5a4 4 0 00-4 4v4l-1.5 2h11L12 9.5v-4a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  trajectories: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3.5" cy="12.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="3.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 11L11 5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 2" />
    </svg>
  ),
  heatmap: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 1v14M11 1v14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  camera: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 7.5l4-2.5v6L11 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  models: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.1 4.1L6.5 6.5M9.5 6.5L11.9 4.1M4.1 11.9L6.5 9.5M9.5 9.5L11.9 11.9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.24 1.24M11.36 11.36l1.24 1.24M3.4 12.6l1.24-1.24M11.36 4.64l1.24-1.24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

const NAV_ITEMS: { id: View | null; label: string; iconKey: keyof typeof Icons; available: boolean }[] = [
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard", available: true },
  { id: "activity", label: "Atividades", iconKey: "activity", available: true },
  { id: null, label: "Eventos", iconKey: "events", available: false },
  { id: null, label: "Trajetórias", iconKey: "trajectories", available: false },
  { id: "heatmap", label: "Heatmap", iconKey: "heatmap", available: true },
  { id: null, label: "Câmera", iconKey: "camera", available: false },
  { id: "admin", label: "Modelos AI", iconKey: "models", available: true },
  { id: null, label: "Configurações", iconKey: "settings", available: false },
];

export default function NavBar({ active, onNavigate }: Props) {
  return (
    <nav className="sidebar-nav">
      {/* Logo */}
      <div style={{
        padding: "1.1rem 1rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: "var(--teal)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2a3 3 0 00-3 3v3l-1 1.5h8L11 8V5a3 3 0 00-3-3z" fill="#0f1b2d" />
            <circle cx="8" cy="8" r="1" fill="#0f1b2d" />
          </svg>
        </div>
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
            PetMonitor <span style={{ color: "var(--teal)" }}>AI</span>
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: "0.5rem 0.5rem", overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id !== null && item.id === active;
          const disabled = !item.available;
          return (
            <button
              key={item.label}
              onClick={() => { if (item.available && item.id !== null) onNavigate(item.id); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                marginBottom: "0.1rem",
                fontWeight: isActive ? 600 : 400,
                color: disabled
                  ? "var(--text-muted)"
                  : isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                background: isActive ? "rgba(0,180,216,0.12)" : "transparent",
                fontSize: "0.88rem",
                cursor: disabled ? "default" : "pointer",
                textAlign: "left",
                border: "none",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              <span style={{
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                color: isActive ? "var(--teal)" : disabled ? "var(--border)" : "var(--text-muted)",
                transition: "color 0.12s",
              }}>
                {Icons[item.iconKey]}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {disabled && (
                <span style={{
                  fontSize: "0.6rem",
                  color: "var(--border)",
                  fontWeight: 400,
                  background: "var(--bg-elevated)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: 999,
                }}>
                  breve
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Blink status */}
      <div style={{
        padding: "0.75rem 1rem",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {Icons.camera}
        </div>
        <div>
          <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Blink – Living Room
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.1rem" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--border)", display: "inline-block" }} />
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Offline</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
