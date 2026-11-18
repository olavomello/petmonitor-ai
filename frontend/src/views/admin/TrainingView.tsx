import { useEffect, useRef, useState } from "react";
import { adminApi, type ActiveModelResponse, type TrainingRun } from "../../api";

function formatDt(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TrainingView() {
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [activeModel, setActiveModel] = useState<ActiveModelResponse | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [runsData, modelData] = await Promise.all([adminApi.runs(), adminApi.activeModel()]);
      setRuns(runsData);
      setActiveModel(modelData);
    } catch (e) {
      setMsg(String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function activateRun(runName: string) {
    setActivating(runName);
    setMsg(null);
    try {
      const r = await adminApi.activateRun(runName);
      setMsg(`Model activated: ${r.activated} (${formatBytes(r.size_bytes)})`);
      await load(true);
    } catch (e) {
      setMsg(`Error: ${e}`);
    } finally {
      setActivating(null);
    }
  }

  useEffect(() => { load(); }, []);

  function startPolling() {
    setPolling(true);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks++;
      await load(true);
      if (ticks >= 20) stopPolling();
    }, 15_000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  }

  useEffect(() => () => stopPolling(), []);

  async function triggerTrain() {
    setMsg(null);
    try {
      const r = await adminApi.train();
      setMsg(`Training started (PID ${r.pid}) — refreshing every 15 s.`);
      startPolling();
      await load(true);
    } catch (e) {
      setMsg(`Error: ${e}`);
    }
  }

  return (
    <div>
      {/* Active model banner */}
      {activeModel !== null && (
        <div style={{
          background: activeModel.active ? "color-mix(in srgb, var(--teal) 12%, var(--bg-card))" : "var(--bg-card)",
          border: `1px solid ${activeModel.active ? "var(--teal)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          padding: "0.65rem 1rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          fontSize: "0.82rem",
        }}>
          <span style={{ fontSize: "1rem" }}>{activeModel.active ? "✅" : "⚠️"}</span>
          {activeModel.active ? (
            <span>
              <strong style={{ color: "var(--teal)" }}>Active model:</strong>{" "}
              <code style={{ fontSize: "0.78rem" }}>models/best.pt</code>
              {activeModel.size_bytes !== null && (
                <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>({formatBytes(activeModel.size_bytes)})</span>
              )}
            </span>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>
              No active model — activate a training run below to enable detection.
            </span>
          )}
        </div>
      )}

      {/* Step-by-step guide */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.65rem" }}>How to train a model</div>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {[
            "Open the Dataset tab and scan frames to register extracted images.",
            "Review and label images in the Dataset tab (keep/discard/label with bounding boxes).",
            "In the Dataset tab, run Split to divide labeled images into train/val sets.",
            "Open the Clips & Sync tab and sync new clips from your Blink camera if needed.",
            "Return here and click Start training — training runs in the background.",
            "After training finishes, the best weights are saved and used for future detection runs.",
          ].map((step, i) => (
            <li key={i} style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--teal)", fontWeight: 600 }}>Step {i + 1}:</span> {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Training in progress banner */}
      {polling && (
        <div style={{
          background: "color-mix(in srgb, var(--teal) 10%, var(--bg-card))",
          border: "1px solid var(--teal)",
          borderRadius: "var(--radius)",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          fontSize: "0.85rem",
        }}>
          <span className="spinner" style={{ color: "var(--teal)", width: "1.1rem", height: "1.1rem", borderWidth: "2.5px" }} />
          <span>
            <strong style={{ color: "var(--teal)" }}>Training in progress</strong>
            <span style={{ color: "var(--text-secondary)", marginLeft: "0.5rem" }}>— auto-refreshing every 15 s</span>
          </span>
          <button
            onClick={stopPolling}
            style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "underline", padding: 0 }}
          >
            stop watching
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={triggerTrain}
          disabled={polling}
          style={{
            padding: "0.5rem 1.1rem",
            background: polling ? "var(--border)" : "var(--teal)",
            color: polling ? "var(--text-muted)" : "#fff",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: polling ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {polling && <span className="spinner" style={{ width: "0.85rem", height: "0.85rem" }} />}
          {polling ? "Training…" : "Start training"}
        </button>
        <button
          onClick={() => load()}
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
            border: `1px solid ${msg.startsWith("Error") ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: msg.startsWith("Error") ? "var(--danger)" : "var(--text-secondary)",
            marginBottom: "1rem",
          }}
        >
          {msg}
        </p>
      )}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", padding: "0.5rem 0" }}>
          <span className="spinner" style={{ width: "1rem", height: "1rem" }} />
          <span>Loading…</span>
        </div>
      ) : runs.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No training runs found in <code>runs/</code>. Start one above.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>Run</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Started</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Weights</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Metrics / Status</th>
                <th style={{ padding: "0.5rem 0.75rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{r.name}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {formatDt(r.started_at)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    {r.has_best_weights ? (
                      <span style={{ color: "var(--teal)" }}>✓</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem" }}>
                    {r.error ? (
                      <span style={{ color: "#f87171" }} title={r.error}>Error</span>
                    ) : r.last_epoch ? (
                      <span style={{ color: "var(--text-secondary)" }}>
                        {Object.entries(r.last_epoch).map(([k, v]) => `${k}=${v}`).join("  ")}
                      </span>
                    ) : r.finished_at ? (
                      <span style={{ color: "var(--text-muted)" }}>Done — no metrics</span>
                    ) : (
                      <span style={{ color: "var(--teal)", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                        <span className="spinner" style={{ width: "0.75rem", height: "0.75rem" }} />
                        Running…
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    {r.has_best_weights && (
                      <button
                        onClick={() => activateRun(r.name)}
                        disabled={activating === r.name}
                        style={{
                          padding: "0.3rem 0.7rem",
                          background: "var(--teal)",
                          color: "#fff",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          opacity: activating === r.name ? 0.6 : 1,
                          cursor: activating === r.name ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {activating === r.name ? "Activating…" : "Set as active"}
                      </button>
                    )}
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
