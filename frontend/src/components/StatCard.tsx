interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export default function StatCard({ label, value, sub, color }: Props) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        minWidth: 120,
        flex: "1 1 140px",
      }}
    >
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: "1.75rem", fontWeight: 700, color: color ?? "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sub}</span>
      )}
    </div>
  );
}
