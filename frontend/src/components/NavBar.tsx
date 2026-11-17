type View = "dashboard" | "activity" | "heatmap" | "admin";

interface Props {
  active: View;
  onNavigate: (v: View) => void;
}

const LINKS: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "activity", label: "Atividade" },
  { id: "heatmap", label: "Heatmap" },
  { id: "admin", label: "Admin" },
];

export default function NavBar({ active, onNavigate }: Props) {
  return (
    <nav
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0 1rem",
        flexWrap: "wrap",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: "1rem",
          color: "var(--teal)",
          padding: "0.75rem 0",
          marginRight: "0.5rem",
          letterSpacing: "0.02em",
        }}
      >
        PetMonitor
      </span>
      {LINKS.map((l) => (
        <button
          key={l.id}
          onClick={() => onNavigate(l.id)}
          aria-current={active === l.id ? "page" : undefined}
          style={{
            padding: "0.6rem 0.9rem",
            borderRadius: "var(--radius-sm)",
            fontWeight: active === l.id ? 600 : 400,
            color: active === l.id ? "var(--teal)" : "var(--text-secondary)",
            background: active === l.id ? "rgba(0,180,216,0.12)" : "transparent",
            transition: "background 0.15s, color 0.15s",
            fontSize: "0.9rem",
          }}
        >
          {l.label}
        </button>
      ))}
    </nav>
  );
}
