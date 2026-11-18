import { useEffect, useRef, useState } from "react";
import { api, type ActivityResponse, type BlinkCamerasResponse, type BlinkStatus, type Clip, type Detection, type HeatmapResponse, type Pet, type StatusResponse } from "../api";
import type { View } from "../nav";

const PET_COLOR: Record<string, string> = {
  Branca: "var(--teal)",
  Marrie: "var(--purple)",
};

function petColor(name: string): string {
  return PET_COLOR[name] ?? "var(--text-secondary)";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

function PetCard({ pet, maxTracks }: { pet: Pet; maxTracks: number }) {
  const color = petColor(pet.name);
  const pct = maxTracks > 0 ? Math.min(100, Math.round((pet.track_count / maxTracks) * 100)) : 0;

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1.1rem",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />

      {/* Avatar + name + status */}
      <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", marginBottom: "0.9rem" }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: `color-mix(in srgb, ${color} 14%, var(--bg-elevated))`,
          border: `2px solid color-mix(in srgb, ${color} 40%, transparent)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.2rem", fontWeight: 700, color,
          flexShrink: 0,
        }}>
          {pet.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{pet.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: pet.clip_count > 0 ? "var(--moving)" : "var(--border)",
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              {pet.clip_count > 0 ? "Detected" : "No data"}
            </span>
          </div>
        </div>
      </div>

      {/* Big metric */}
      <div style={{ marginBottom: "0.55rem" }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, color, lineHeight: 1 }}>
          {pet.track_count || "—"}
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
          tracks · {pet.clip_count} clips
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        background: "var(--border)", borderRadius: 999, height: 4,
        marginBottom: "0.8rem", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 999, background: color,
          width: `${pct}%`, transition: "width 0.6s ease",
        }} />
      </div>

    </div>
  );
}

const DET_COLOR: Record<number, string> = { 0: "#00b4d8", 1: "#a78bfa" };
const DET_NAME: Record<number, string> = { 0: "Branca", 1: "Marrie" };

function drawBboxes(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  detections: Detection[],
) {
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (detections.length === 0) return;
  const sx = img.clientWidth / (img.naturalWidth || img.clientWidth);
  const sy = img.clientHeight / (img.naturalHeight || img.clientHeight);
  ctx.font = "bold 11px system-ui, sans-serif";
  for (const d of detections) {
    const x = d.bbox_x * sx;
    const y = d.bbox_y * sy;
    const w = d.bbox_w * sx;
    const h = d.bbox_h * sy;
    const color = DET_COLOR[d.pet_class] ?? "#94a3b8";
    const label = `${DET_NAME[d.pet_class] ?? "Unknown"} ${Math.round(d.confidence * 100)}%`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color + "cc";
    ctx.fillRect(x, y - 19, tw + 10, 19);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 5, y - 5);
  }
}

function CameraPanel({ clips, blinkConnected, cameraName }: { clips: Clip[]; blinkConnected: boolean; cameraName: string }) {
  const latest = clips[0];
  const [detections, setDetections] = useState<Detection[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [snapSrc, setSnapSrc] = useState<string | null>(null);
  const [snapFailed, setSnapFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const useSnapshot = blinkConnected && !!cameraName;

  // Snapshot polling — refresh every 15 s when Blink is connected
  useEffect(() => {
    if (snapIntervalRef.current) { clearInterval(snapIntervalRef.current); snapIntervalRef.current = null; }
    if (!useSnapshot) { setSnapSrc(null); return; }
    const refresh = () => { setSnapFailed(false); setSnapSrc(`${api.blinkSnapshotUrl(cameraName)}?t=${Date.now()}`); };
    refresh();
    snapIntervalRef.current = setInterval(refresh, 15_000);
    return () => { if (snapIntervalRef.current) { clearInterval(snapIntervalRef.current); snapIntervalRef.current = null; } };
  }, [useSnapshot, cameraName]);

  // Load detections for the latest clip (clip mode only)
  useEffect(() => {
    setDetections([]);
    setImgLoaded(false);
    setThumbFailed(false);
    if (useSnapshot || !latest || latest.detection_count === 0) return;
    api.clipDetections(latest.id).then(setDetections).catch(() => {});
  }, [latest?.id, useSnapshot]);

  // Draw bboxes (clip mode only); clear canvas in snapshot mode
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !canvasRef.current) return;
    if (useSnapshot) {
      canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }
    drawBboxes(imgRef.current, canvasRef.current, detections);
  }, [imgLoaded, detections, useSnapshot]);

  const imgSrc = useSnapshot
    ? (snapFailed ? null : snapSrc)
    : (thumbFailed ? null : (latest ? api.clipThumbnailUrl(latest.id) : null));

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.8rem 1rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Camera</span>
          <span style={{
            fontSize: "0.62rem", padding: "0.12rem 0.45rem",
            borderRadius: 999,
            background: blinkConnected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: blinkConnected ? "#86efac" : "#fca5a5",
            fontWeight: 600,
          }}>{blinkConnected ? "Online" : "Offline"}</span>
          <span style={{
            fontSize: "0.62rem", padding: "0.12rem 0.45rem",
            borderRadius: 999, fontWeight: 600,
            background: useSnapshot ? "rgba(0,180,216,0.18)" : "rgba(100,116,139,0.18)",
            color: useSnapshot ? "var(--teal)" : "var(--text-muted)",
          }}>
            {useSnapshot ? "SNAP" : "CLIP"}
          </span>
        </div>
        {cameraName && <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{cameraName}</span>}
      </div>

      {/* Feed area */}
      <div style={{
        flex: 1, background: "#080f1a",
        position: "relative",
        minHeight: 180,
        overflow: "hidden",
      }}>
        {imgSrc ? (
          <>
            <img
              ref={imgRef}
              src={imgSrc}
              alt={useSnapshot ? "Snapshot" : "Latest clip"}
              onLoad={() => setImgLoaded(true)}
              onError={() => { if (useSnapshot) setSnapFailed(true); else setThumbFailed(true); }}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 180 }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            />
          </>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "1.75rem 1.25rem", gap: "0.6rem",
            height: "100%", minHeight: 180,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity={0.25}>
              <rect x="2" y="6" width="14" height="12" rx="2" stroke="#94a3b8" strokeWidth="1.5" />
              <path d="M16 10.5l6-3v9l-6-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
              {blinkConnected ? "Blink camera connected" : "Blink camera not connected"}
            </span>
          </div>
        )}

        {/* Detection badges — clip mode only */}
        {!useSnapshot && detections.length > 0 && (
          <div style={{
            position: "absolute", bottom: 8, left: 8,
            display: "flex", gap: "0.3rem", flexWrap: "wrap",
          }}>
            {[...new Set(detections.map((d) => d.pet_class))].map((cls) => (
              <span key={cls} style={{
                fontSize: "0.62rem", fontWeight: 700,
                padding: "0.1rem 0.5rem", borderRadius: 999,
                background: (DET_COLOR[cls] ?? "#94a3b8") + "cc",
                color: "#fff",
              }}>
                {DET_NAME[cls] ?? "Unknown"}
              </span>
            ))}
          </div>
        )}

        {/* Snapshot refresh indicator */}
        {useSnapshot && snapSrc && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            display: "flex", alignItems: "center", gap: "0.3rem",
            background: "rgba(0,0,0,0.55)", borderRadius: 999,
            padding: "0.15rem 0.55rem",
          }}>
            <span className="spinner" style={{ color: "var(--teal)", width: "0.65rem", height: "0.65rem", borderWidth: "1.5px" }} />
            <span style={{ fontSize: "0.58rem", color: "var(--teal)", fontWeight: 600 }}>~15s</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {useSnapshot ? (
        <div style={{
          padding: "0.55rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.72rem", color: "var(--text-muted)",
        }}>
          <span>Snapshot polling</span>
          <span>~15s delay · not live video</span>
        </div>
      ) : latest ? (
        <div style={{
          padding: "0.55rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.72rem", color: "var(--text-muted)",
        }}>
          <span>{latest.detection_count} detections · {latest.track_count} tracks</span>
          <span>{relativeTime(latest.capture_at ?? latest.ingested_at)}</span>
        </div>
      ) : null}
    </div>
  );
}

// --- Atividades do dia (Daily Activity bar chart) ---

const ACTIVITIES = [
  {
    key: "stationary", label: "Repouso",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="9" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <rect x="4" y="6" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="15" x2="4" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="14" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "moving", label: "Movimento",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="4" r="1.8" fill="currentColor" opacity="0.85" />
        <path d="M9 6.5v5M6.5 9l2.5 1.5 2.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M7 13.5L5.5 16M11 13.5l1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "unknown", label: "Brincando",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="6" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="6" cy="10" r="1.2" fill="currentColor" opacity="0.75" />
        <circle cx="12" cy="10" r="1.2" fill="currentColor" opacity="0.75" />
        <path d="M8 8.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M7 3l1.5 3M11 3l-1.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "not_visible", label: "Em pé",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <ellipse cx="9" cy="7" rx="3" ry="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 15c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="6.5" r="0.7" fill="currentColor" />
        <circle cx="11" cy="6.5" r="0.7" fill="currentColor" />
      </svg>
    ),
  },
];

function thermalColor(ratio: number): string {
  const r = Math.round(ratio < 0.5 ? 0 : (ratio - 0.5) / 0.5 * 255);
  const g = Math.round(ratio < 0.25 ? ratio / 0.25 * 255 : ratio < 0.75 ? 255 : (1 - ratio) / 0.25 * 255);
  const b = Math.round(ratio < 0.5 ? (0.5 - ratio) / 0.5 * 255 : 0);
  const alpha = 0.08 + ratio * 0.75;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function AtividadesDodia({ pets }: { pets: Pet[] }) {
  const [activity, setActivity] = useState<ActivityResponse | null>(null);

  useEffect(() => {
    api.activity().then(setActivity).catch(() => {});
  }, []);

  const summary = activity?.summary ?? {};
  const petNames = pets.map((p) => p.name).filter((n) => summary[n]);
  const PET_COLORS: Record<string, string> = { Branca: "#00b4d8", Marrie: "#a78bfa" };

  // Compute percentage per pet per activity
  const pcts: Record<string, Record<string, number>> = {};
  for (const name of petNames) {
    const counts = summary[name] ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    pcts[name] = {};
    for (const act of ACTIVITIES) {
      pcts[name][act.key] = total > 0 ? Math.round(((counts[act.key] ?? 0) / total) * 100) : 0;
    }
  }

  const allPctVals = Object.values(pcts).flatMap((p) => Object.values(p));
  const yMax = allPctVals.length > 0 ? Math.max(80, ...allPctVals) : 80;
  const ySteps = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  const CHART_H = 148;
  const BAR_W = 12;
  const BAR_GAP = 3;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Atividades do dia</span>
        <div style={{ display: "flex", gap: "0.65rem" }}>
          {petNames.map((name) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: PET_COLORS[name] ?? "#94a3b8", display: "inline-block" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {/* Y axis */}
        <div style={{ width: 32, display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", paddingBottom: 36 }}>
          {ySteps.map((v) => (
            <span key={v} style={{ fontSize: "0.62rem", color: "var(--text-muted)", lineHeight: 1 }}>{v}%</span>
          ))}
        </div>

        {/* Grid + bars + labels */}
        <div style={{ flex: 1 }}>
          {/* Grid lines + bars container */}
          <div style={{ position: "relative", height: CHART_H }}>
            {/* Horizontal grid lines */}
            {ySteps.map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                bottom: `${(i / (ySteps.length - 1)) * 100}%`,
                left: 0, right: 0, height: 1,
                background: "var(--border)", opacity: 0.6,
              }} />
            ))}
            {/* Activity groups */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
              {ACTIVITIES.map((act) => (
                <div key={act.key} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: BAR_GAP }}>
                  {petNames.length === 0 ? (
                    <div style={{ width: BAR_W * 2 + BAR_GAP, height: 2, background: "var(--border)", borderRadius: "2px 2px 0 0" }} />
                  ) : petNames.map((name) => {
                    const pct = pcts[name]?.[act.key] ?? 0;
                    const h = Math.max(2, (pct / yMax) * CHART_H);
                    return (
                      <div key={name} style={{
                        width: BAR_W,
                        height: h,
                        background: PET_COLORS[name] ?? "#94a3b8",
                        borderRadius: "2px 2px 0 0",
                        transition: "height 0.5s ease",
                      }} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* X axis: icons + labels */}
          <div style={{ display: "flex", paddingTop: "0.4rem" }}>
            {ACTIVITIES.map((act) => (
              <div key={act.key} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: "0.2rem",
                color: "var(--text-muted)", fontSize: "0.65rem",
              }}>
                {act.icon}
                {act.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!activity && (
        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
          Analytics available after processing clips
        </p>
      )}
    </div>
  );
}

// --- Mapa de circulação (Heatmap panel) ---

function MapaDeCirculacao({ pets, bgUrl, onNavigate }: { pets: Pet[]; bgUrl: string | null; onNavigate: () => void }) {
  const [heatmaps, setHeatmaps] = useState<Record<string, HeatmapResponse>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const p of pets) init[p.name] = true;
    setVisible(init);
  }, [pets]);

  useEffect(() => {
    if (pets.length === 0) return;
    for (const p of pets) {
      api.heatmap(p.name).then((r) => {
        setHeatmaps((prev) => ({ ...prev, [p.name]: r }));
      }).catch(() => {});
    }
  }, [pets]);

  const PET_COLORS: Record<string, string> = { Branca: "#00b4d8", Marrie: "#a78bfa" };

  // Combine grids for visible pets
  const visiblePets = pets.filter((p) => visible[p.name] && heatmaps[p.name]);
  const combined = (() => {
    if (visiblePets.length === 0) return null;
    const first = heatmaps[visiblePets[0].name];
    const rows = first.grid_h, cols = first.grid_w;
    const combined: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (const p of visiblePets) {
      const g = heatmaps[p.name].grid;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          combined[r][c] += g[r]?.[c] ?? 0;
    }
    return { grid: combined, rows, cols };
  })();

  const combinedMax = combined ? Math.max(1, ...combined.grid.flat()) : 1;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Mapa de circulação (Heatmap)</span>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Map area */}
        <div
          style={{ flex: 1, position: "relative", minHeight: 160, cursor: "pointer" }}
          onClick={onNavigate}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(); }}
        >
          {bgUrl ? (
            <img
              src={bgUrl}
              alt="Room"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#080f1a" }} />
          )}

          {/* Heatmap SVG overlay */}
          {combined && (
            <svg
              viewBox={`0 0 ${combined.cols} ${combined.rows}`}
              width="100%" height="100%"
              style={{ position: "absolute", inset: 0, display: "block" }}
              preserveAspectRatio="none"
            >
              {combined.grid.map((row, r) =>
                row.map((count, c) => {
                  if (count === 0) return null;
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={c} y={r} width={1} height={1}
                      fill={thermalColor(count / combinedMax)}
                    />
                  );
                })
              )}
            </svg>
          )}

          {!combined && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>Open full heatmap →</span>
            </div>
          )}
        </div>

        {/* Controls sidebar */}
        <div style={{
          width: 100, flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          padding: "0.75rem",
          display: "flex", flexDirection: "column", gap: "0.9rem",
          background: "var(--bg-elevated)",
        }}>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Exibir</div>
            {pets.map((p) => (
              <label key={p.name} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={visible[p.name] ?? true}
                  onChange={(e) => setVisible((prev) => ({ ...prev, [p.name]: e.target.checked }))}
                  style={{ accentColor: PET_COLORS[p.name] ?? "var(--teal)", width: 13, height: 13 }}
                />
                <span style={{ fontSize: "0.75rem", color: PET_COLORS[p.name] ?? "var(--text-primary)", fontWeight: 500 }}>{p.name}</span>
              </label>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Intensidade</div>
            <div style={{
              height: 8, borderRadius: 3,
              background: "linear-gradient(to right, rgba(0,0,255,0.7), rgba(0,255,0,0.7), rgba(255,165,0,0.9), rgba(255,0,0,1))",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BlinkBanner({ blinkStatus, onConfigure }: { blinkStatus: BlinkStatus | null; onConfigure: () => void }) {
  if (!blinkStatus || blinkStatus.status === "configured") return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "var(--radius)",
      padding: "0.65rem 1rem",
      marginBottom: "1rem",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
          <path d="M7 4v3M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: "0.82rem", color: "#f87171" }}>
          {blinkStatus.status === "not_configured"
            ? "Blink camera not configured — no new clips will be downloaded"
            : "Blink credentials file is invalid"}
        </span>
      </div>
      <button
        onClick={onConfigure}
        style={{
          fontSize: "0.76rem", fontWeight: 600, color: "#f87171",
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "var(--radius-sm)", padding: "0.3rem 0.7rem", cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        Configure →
      </button>
    </div>
  );
}

function RecentEvents({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return (
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.1rem 1rem",
        marginBottom: "1rem",
      }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.65rem" }}>
          Recent Events
        </span>
        <p style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>
          No clips ingested yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem",
      marginBottom: "1rem",
    }}>
      <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.85rem" }}>
        Recent Events
      </span>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: "0.75rem",
      }}>
        {clips.slice(0, 5).map((clip) => {
          const name = clip.original_filename.split("\\").pop()?.split("/").pop() ?? clip.original_filename;
          const thumbUrl = api.clipThumbnailUrl(clip.id);
          return (
            <div key={clip.id} style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              overflow: "hidden",
              cursor: "pointer",
            }}>
              <div style={{ height: 76, background: "#080f1a", position: "relative", overflow: "hidden" }}>
                <img
                  src={thumbUrl}
                  alt={name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                {clip.detection_count > 0 && (
                  <div style={{
                    position: "absolute", top: 4, right: 4,
                    background: "rgba(0,0,0,0.7)", borderRadius: 999,
                    padding: "1px 6px", fontSize: "0.6rem", color: "var(--teal)", fontWeight: 700,
                  }}>
                    {clip.detection_count} det
                  </div>
                )}
              </div>
              <div style={{ padding: "0.55rem 0.65rem" }}>
                <div style={{
                  fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  marginBottom: "0.2rem",
                }}>
                  {name}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {clip.detection_count} det · {clip.track_count} tracks
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {relativeTime(clip.capture_at ?? clip.ingested_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DaySummary({ status }: { status: StatusResponse }) {
  const stats = [
    { label: "Processed Clips", value: status.clips.total },
    { label: "Detections", value: status.detections.total },
    { label: "Tracks", value: status.tracks.total },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {stats.map(({ label, value }) => (
        <div key={label} style={{
          flex: "1 1 130px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0.85rem 1rem",
        }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
            {label}
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [blinkStatus, setBlinkStatus] = useState<BlinkStatus | null>(null);
  const [cameras, setCameras] = useState<BlinkCamerasResponse | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.status(),
      api.pets(),
      api.clips(10),
      api.blinkStatus().catch(() => null),
      api.blinkCameras().catch(() => null),
    ])
      .then(([s, p, c, bs, cams]) => {
        setStatus(s); setPets(p); setClips(c);
        setBlinkStatus(bs); setCameras(cams);
        const camName = cams?.cameras[0];
        if (camName) setBgUrl(`${api.blinkSnapshotUrl(camName)}?t=${Date.now()}`);
        else if (c[0]) setBgUrl(api.clipThumbnailUrl(c[0].id));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  const maxTracks = Math.max(...pets.map((p) => p.track_count), 1);

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "5rem", color: "var(--text-muted)", fontSize: "0.9rem",
      }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "1.25rem",
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
      }}>
        <strong>Failed to connect to API:</strong> {error}
        <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Make sure <code style={{ color: "var(--teal)" }}>petmonitor-api</code> is running at 127.0.0.1:8000.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1 }}>Dashboard</h1>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.3rem", textTransform: "capitalize" }}>
          {today}
        </p>
      </div>

      {/* Blink offline banner */}
      <BlinkBanner blinkStatus={blinkStatus} onConfigure={() => onNavigate("settings")} />

      {/* Summary stats */}
      {status && <DaySummary status={status} />}

      {/* Top section: pet cards + camera */}
      <div className="db-top">
        {pets.length > 0
          ? pets.map((pet) => <PetCard key={pet.id} pet={pet} maxTracks={maxTracks} />)
          : (
            <>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "1.5rem",
                color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem",
              }}>
                No pets registered
              </div>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "1.5rem",
                color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem",
              }}>
                No pets registered
              </div>
            </>
          )
        }
        <div className="db-camera">
          <CameraPanel
            clips={clips}
            blinkConnected={status?.blink_connected ?? false}
            cameraName={cameras?.cameras[0] ?? ""}
          />
        </div>
      </div>

      {/* Mid section: activity + heatmap */}
      <div className="db-mid">
        <AtividadesDodia pets={pets} />
        <MapaDeCirculacao pets={pets} bgUrl={bgUrl} onNavigate={() => onNavigate("heatmap")} />
      </div>

      {/* Recent events */}
      <RecentEvents clips={clips} />
    </div>
  );
}
