import { useEffect, useState } from "react";
import { api, adminApi, type BlinkStatus } from "../api";
import type { View } from "../nav";

type PipelineStep = "sync" | "extract" | "detect" | "track" | "analyse";

type StepState = "idle" | "running" | "done" | "error";

const STEPS: { id: PipelineStep; label: string; desc: string }[] = [
  { id: "sync", label: "Sync", desc: "Download new Blink clips" },
  { id: "extract", label: "Extract", desc: "Sample frames from clips" },
  { id: "detect", label: "Detect", desc: "Run YOLO object detection" },
  { id: "track", label: "Track", desc: "Build multi-frame tracks" },
  { id: "analyse", label: "Analyse", desc: "Classify activity states" },
];

export default function CameraView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [blinkStatus, setBlinkStatus] = useState<BlinkStatus | null>(null);
  const [stepStates, setStepStates] = useState<Record<PipelineStep, StepState>>({
    sync: "idle", extract: "idle", detect: "idle", track: "idle", analyse: "idle",
  });
  const [lastResult, setLastResult] = useState<Record<PipelineStep, string>>({
    sync: "", extract: "", detect: "", track: "", analyse: "",
  });

  useEffect(() => {
    api.blinkStatus()
      .then(setBlinkStatus)
      .catch(() => setBlinkStatus(null));
  }, []);

  async function runStep(step: PipelineStep) {
    setStepStates((s) => ({ ...s, [step]: "running" }));
    setLastResult((r) => ({ ...r, [step]: "" }));
    try {
      let res: { status: string; pid?: number };
      if (step === "sync") res = await adminApi.sync();
      else if (step === "extract") res = await adminApi.extract();
      else if (step === "detect") res = await adminApi.detect();
      else if (step === "track") res = await adminApi.track();
      else res = await adminApi.analyse();
      setStepStates((s) => ({ ...s, [step]: "done" }));
      setLastResult((r) => ({
        ...r,
        [step]: res.pid ? `Started (pid ${res.pid})` : res.status,
      }));
    } catch (err) {
      setStepStates((s) => ({ ...s, [step]: "error" }));
      setLastResult((r) => ({ ...r, [step]: String(err) }));
    }
  }

  const isConnected = blinkStatus?.status === "configured";

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Camera</h1>
      </div>

      {/* Blink Status */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem 1.25rem",
        marginBottom: "1.25rem", display: "flex",
        alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isConnected ? "#22c55e" : "#ef4444",
            boxShadow: isConnected ? "0 0 0 3px rgba(34,197,94,0.2)" : "0 0 0 3px rgba(239,68,68,0.2)",
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Blink Camera</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              {blinkStatus === null
                ? "Checking…"
                : isConnected
                ? "Authenticated and ready"
                : "Not authenticated — sync will fail"}
            </div>
          </div>
        </div>
        {!isConnected && blinkStatus !== null && (
          <button
            onClick={() => onNavigate("settings")}
            style={{
              background: "var(--teal)", color: "#0a1628", border: "none",
              borderRadius: "var(--radius-sm)", padding: "0.4rem 0.9rem",
              fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
            }}
          >
            Authenticate →
          </button>
        )}
      </div>

      {/* Pipeline Steps */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Pipeline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {STEPS.map((step) => {
            const state = stepStates[step.id];
            const result = lastResult[step.id];
            return (
              <div
                key={step.id}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "0.75rem 1rem",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>{step.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{step.desc}</div>
                  {result && (
                    <div style={{
                      fontSize: "0.68rem", marginTop: "0.2rem",
                      color: state === "error" ? "#f87171" : "#86efac",
                    }}>
                      {result}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => runStep(step.id)}
                  disabled={state === "running"}
                  style={{
                    background: state === "done"
                      ? "rgba(34,197,94,0.15)"
                      : state === "error"
                      ? "rgba(239,68,68,0.15)"
                      : "var(--bg-elevated)",
                    color: state === "done"
                      ? "#86efac"
                      : state === "error"
                      ? "#f87171"
                      : "var(--text-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "0.35rem 0.85rem",
                    fontSize: "0.78rem", fontWeight: 600,
                    cursor: state === "running" ? "not-allowed" : "pointer",
                    opacity: state === "running" ? 0.6 : 1,
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  {state === "running" ? "Running…" : state === "done" ? "✓ Run again" : state === "error" ? "Retry" : "Run"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
