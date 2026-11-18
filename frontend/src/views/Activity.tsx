import { useEffect, useState } from "react";
import { api, type ActivityEvent, type ActivityResponse, type Pet } from "../api";

const STATE_COLORS: Record<string, string> = {
  moving: "var(--moving)",
  stationary: "var(--stationary)",
  not_visible: "var(--not-visible)",
  unknown: "var(--text-muted)",
};

const STATE_LABELS: Record<string, string> = {
  moving: "Moving",
  stationary: "Stationary",
  not_visible: "Not visible",
  unknown: "Unknown",
};

function StateIcon({ state, size = 18 }: { state: string; size?: number }) {
  const color = STATE_COLORS[state] ?? "var(--text-muted)";
  if (state === "moving") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="4.5" r="2" fill={color} />
        <path d="M9 7v5M6.5 9l2.5 1 2.5-1" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M7 13.5l-1.5 2M11 13.5l1.5 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === "stationary") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="4.5" r="2" fill={color} />
        <path d="M9 7v7" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M6 14h6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === "not_visible") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
        <path d="M3 9s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke={color} strokeWidth="1.4" />
        <line x1="3" y1="3" x2="15" y2="15" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1.4" strokeDasharray="3 2" />
      <text x="9" y="13" textAnchor="middle" fontSize="8" fill={color} fontWeight="700">?</text>
    </svg>
  );
}

function Badge({ state }: { state: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "0.2rem 0.5rem",
      borderRadius: 4,
      fontSize: "0.75rem",
      fontWeight: 600,
      color: STATE_COLORS[state] ?? "var(--text-muted)",
      background: `${STATE_COLORS[state] ?? "var(--text-muted)"}22`,
    }}>
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

const STATE_ORDER = ["moving", "stationary", "not_visible", "unknown"];

function SummaryCard({ identity, counts }: { identity: string; counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <div style={{ fontWeight: 700, fontSize: "1rem" }}>{identity}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
        {STATE_ORDER.map((state) => {
          const count = counts[state] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const color = STATE_COLORS[state] ?? "var(--text-muted)";
          return (
            <div key={state} style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              padding: "0.6rem 0.75rem",
              display: "flex", alignItems: "center", gap: "0.6rem",
            }}>
              <StateIcon state={state} size={20} />
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color, lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                  {STATE_LABELS[state] ?? state}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--border)" }}>
        {STATE_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((state) => (
          <div key={state} style={{
            height: "100%",
            width: `${Math.round(((counts[state] ?? 0) / total) * 100)}%`,
            background: STATE_COLORS[state] ?? "var(--text-muted)",
            transition: "width 0.6s ease",
          }} />
        ))}
      </div>
    </div>
  );
}

function SummaryBar({ summary }: { summary: Record<string, Record<string, number>> }) {
  if (Object.keys(summary).length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
      {Object.entries(summary).map(([identity, counts]) => (
        <SummaryCard key={identity} identity={identity} counts={counts} />
      ))}
    </div>
  );
}

export default function Activity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.pets().then(setPets).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.activity(selected || undefined)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Activity</h1>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            padding: "0.4rem 0.75rem",
            fontSize: "0.9rem",
          }}
        >
          <option value="">All pets</option>
          {pets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && data && (
        <>
          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Summary</h2>
            {Object.keys(data.summary).length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No events processed yet.</p>
              : <SummaryBar summary={data.summary} />
            }
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>{data.note}</p>
          </section>

          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Events <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({data.events.length})</span>
            </h2>
            {data.events.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No events to display.</p>
              : (
                <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-surface)" }}>
                        {["Clip", "Track", "Pet", "State", "Frames"].map((h) => (
                          <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((ev: ActivityEvent) => (
                        <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>#{ev.clip_id}</td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>{ev.track_id}</td>
                          <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>{ev.identity}</td>
                          <td style={{ padding: "0.6rem 0.75rem" }}><Badge state={ev.state} /></td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>{ev.frame_start}–{ev.frame_end}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </section>
        </>
      )}
    </div>
  );
}
