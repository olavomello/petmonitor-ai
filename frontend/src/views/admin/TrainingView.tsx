import { useEffect, useState } from "react";
import { adminApi, type TrainingRun } from "../../api";

export default function TrainingView() {
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRuns(await adminApi.runs());
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function triggerTrain() {
    setMsg(null);
    try {
      const r = await adminApi.train();
      setMsg(`Training started (PID ${r.pid}) — check the terminal.`);
    } catch (e) {
      setMsg(`Error: ${e}`);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={triggerTrain}
          style={{
            padding: "0.5rem 1.1rem",
            background: "var(--teal)",
            color: "#fff",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Start training
        </button>
        <button
          onClick={load}
          style={{
            padding: "0.5rem 1.1rem",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.9rem",
          }}
        >
          Reload
        </button>
      </div>
      {msg && (
        <p
          style={{
            padding: "0.6rem 0.9rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "1rem",
          }}
        >
          {msg}
        </p>
      )}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : runs.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No runs found in <code>runs/detect/</code>.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>Run</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Weights</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Last epoch</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace" }}>{r.name}</td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    {r.has_best_weights ? (
                      <span style={{ color: "var(--teal)" }}>✓</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {r.last_epoch
                      ? Object.entries(r.last_epoch)
                          .slice(0, 5)
                          .map(([k, v]) => `${k}=${v}`)
                          .join("  ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
