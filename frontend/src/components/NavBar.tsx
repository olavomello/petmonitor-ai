import { NavIcons, NAV_SIDEBAR, type View } from "../nav";

interface Props {
  active: View;
  onNavigate: (v: View) => void;
}

export default function NavBar({ active, onNavigate }: Props) {
  return (
    <nav className="sidebar-nav">
      <div style={{
        padding: "1rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "rgba(255,255,255,0.07)",
        height: 46,
      }}>
        <img
          src="/logo-white.png"
          alt="PetMonitor AI"
          style={{ height: 28, maxWidth: "90%", objectFit: "contain" }}
        />
      </div>

      <div style={{ flex: 1, padding: "0.5rem 0.5rem", overflowY: "auto" }}>
        {NAV_SIDEBAR.map((item) => {
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
                {NavIcons[item.iconKey](16)}
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
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

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
          {NavIcons.camera(16)}
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
