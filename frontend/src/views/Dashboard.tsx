import { useEffect, useRef, useState } from "react";
import { api, type ActivityResponse, type BlinkCamerasResponse, type BlinkStatus, type Clip, type Detection, type HeatmapResponse, type Pet, type StatusResponse, type SyncStatusResponse } from "../api";
import type { View } from "../nav";

const PET_COLOR: Record<string, string> = { Branca: "#00b4d8", Marrie: "#a78bfa" };
function petColor(name: string): string { return PET_COLOR[name] ?? "var(--text-secondary)"; }

const FPS = 15;
function framesToTime(frames: number): string {
  const s = Math.floor(frames / FPS);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "—";
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

function PawIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="9" rx="3.5" ry="2.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="5" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="10" cy="5" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="2" cy="8" r="0.9" fill="currentColor" opacity="0.6" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

const ACTIVITIES = [
  {
    key: "stationary", label: "Repouso",
    icon: (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="4" r="1.8" fill="currentColor" opacity="0.85" />
        <path d="M9 6.5v5M6.5 9l2.5 1.5 2.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M7 13.5L5.5 16M11 13.5l1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "unknown", label: "Brincando",
    icon: (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <ellipse cx="9" cy="7" rx="3" ry="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 15c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="6.5" r="0.7" fill="currentColor" />
        <circle cx="11" cy="6.5" r="0.7" fill="currentColor" />
      </svg>
    ),
  },
];

function ActivityRow({
  act, frames, total, color,
}: {
  act: { key: string; label: string; icon: React.ReactNode };
  frames: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((frames / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.42rem" }}>
      <span style={{ color, opacity: 0.85, flexShrink: 0, display: "flex" }}>{act.icon}</span>
      <span style={{ fontSize: "0.78rem", flex: "0 0 72px", color: "var(--text-secondary)" }}>{act.label}</span>
      <div style={{ flex: 1, background: "var(--border)", borderRadius: 999, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color, minWidth: "2.2rem", textAlign: "right" }}>{pct}%</span>
      <span style={{ fontSize: "0.67rem", color: "var(--text-muted)", minWidth: "2.8rem" }}>({framesToTime(frames)})</span>
    </div>
  );
}

function PetCard({ pet, actSummary }: { pet: Pet; actSummary: Record<string, number> | null }) {
  const color = petColor(pet.name);
  const counts = actSummary ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const dominant = total > 0
    ? ACTIVITIES.reduce((best, act) => (counts[act.key] ?? 0) > (counts[best.key] ?? 0) ? act : best, ACTIVITIES[0])
    : null;
  const dominantFrames = dominant ? (counts[dominant.key] ?? 0) : 0;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.1rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      {/* Avatar + name */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.85rem" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: `color-mix(in srgb, ${color} 15%, var(--bg-elevated))`,
          border: `2px solid color-mix(in srgb, ${color} 45%, transparent)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.35rem", fontWeight: 700, color, flexShrink: 0,
        }}>
          {pet.name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>{pet.name}</span>
            <span style={{ color }}><PawIcon size={13} /></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: pet.clip_count > 0 ? "#22c55e" : "var(--border)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              {pet.clip_count > 0 ? "Detectada agora" : "Sem dados"}
            </span>
          </div>
        </div>
      </div>
      {/* Dominant time */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: "2.2rem", fontWeight: 700, color, lineHeight: 1 }}>
          {dominantFrames > 0 ? framesToTime(dominantFrames) : (pet.track_count > 0 ? `${pet.track_count}` : "—")}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
          {dominant?.label ?? (pet.track_count > 0 ? "tracks" : "Sem dados")}
        </div>
      </div>
      {/* Activity breakdown */}
      {ACTIVITIES.map((act) => (
        <ActivityRow key={act.key} act={act} frames={counts[act.key] ?? 0} total={total} color={color} />
      ))}
    </div>
  );
}

const DET_COLOR: Record<number, string> = { 0: "#00b4d8", 1: "#a78bfa" };
const DET_NAME: Record<number, string> = { 0: "Branca", 1: "Marrie" };

function drawBboxes(img: HTMLImageElement, canvas: HTMLCanvasElement, detections: Detection[]) {
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
    const x = d.bbox_x * sx, y = d.bbox_y * sy, w = d.bbox_w * sx, h = d.bbox_h * sy;
    const color = DET_COLOR[d.pet_class] ?? "#94a3b8";
    const label = `${DET_NAME[d.pet_class] ?? "Unknown"} ${Math.round(d.confidence * 100)}%`;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
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

  useEffect(() => {
    if (snapIntervalRef.current) { clearInterval(snapIntervalRef.current); snapIntervalRef.current = null; }
    if (!useSnapshot) { setSnapSrc(null); return; }
    const refresh = () => { setSnapFailed(false); setSnapSrc(`${api.blinkSnapshotUrl(cameraName)}?t=${Date.now()}`); };
    refresh();
    snapIntervalRef.current = setInterval(refresh, 15_000);
    return () => { if (snapIntervalRef.current) { clearInterval(snapIntervalRef.current); snapIntervalRef.current = null; } };
  }, [useSnapshot, cameraName]);

  // Always load detections from latest clip (used in both clip and snapshot modes)
  useEffect(() => {
    setDetections([]);
    setImgLoaded(false);
    setThumbFailed(false);
    if (!latest || latest.detection_count === 0) return;
    api.clipDetections(latest.id).then(setDetections).catch(() => {});
  }, [latest?.id]);

  // Draw bboxes on canvas whenever image is loaded or detections change
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !canvasRef.current) return;
    drawBboxes(imgRef.current, canvasRef.current, detections);
  }, [imgLoaded, detections]);

  const imgSrc = useSnapshot
    ? (snapFailed ? null : snapSrc)
    : (thumbFailed ? null : (latest ? api.clipThumbnailUrl(latest.id) : null));

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Camera</span>
          <span style={{ fontSize: "0.62rem", padding: "0.12rem 0.45rem", borderRadius: 999, background: blinkConnected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: blinkConnected ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
            {blinkConnected ? "Online" : "Offline"}
          </span>
        </div>
        {cameraName && <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{cameraName}</span>}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, background: "#080f1a", position: "relative", minHeight: 180, overflow: "hidden" }}>
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
            {/* Snapshot badge — top left */}
            {useSnapshot && (
              <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(0,0,0,0.6)", borderRadius: 999, padding: "0.18rem 0.6rem" }}>
                <span className="snap-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>SNAP</span>
              </div>
            )}
            {/* Camera name badge — top right */}
            {cameraName && (
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(0,0,0,0.6)", borderRadius: 999, padding: "0.18rem 0.6rem" }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="4" width="8" height="6" rx="1" stroke="#fff" strokeWidth="1.2" />
                  <path d="M9 6.5l4-2v5l-4-2" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: "0.65rem", color: "#fff", fontWeight: 500 }}>{cameraName}</span>
              </div>
            )}
            {/* Controls bar — bottom */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)", padding: "0.6rem 0.75rem 0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: 0.7 }}>
                <circle cx="9" cy="9" r="7.5" stroke="#fff" strokeWidth="1.3" />
                <path d="M7.5 6.5l5 2.5-5 2.5V6.5z" fill="#fff" />
              </svg>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: 0.7 }}>
                <path d="M3 6h2v6H3zM5 9l5-5v10L5 9z" fill="#fff" />
              </svg>
              <div style={{ flex: 1 }} />
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: 0.7 }}>
                <path d="M2 7V2h5M11 2h5v5M2 11v5h5M16 11v5h-5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.75rem 1.25rem", gap: "0.6rem", height: "100%", minHeight: 180 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity={0.25}>
              <rect x="2" y="6" width="14" height="12" rx="2" stroke="#94a3b8" strokeWidth="1.5" />
              <path d="M16 10.5l6-3v9l-6-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
              {blinkConnected ? "Blink camera connected" : "Blink camera not connected"}
            </span>
          </div>
        )}

        {/* Detection badges — clip mode */}
        {!useSnapshot && detections.length > 0 && (
          <div style={{ position: "absolute", bottom: 42, left: 8, display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            {[...new Set(detections.map((d) => d.pet_class))].map((cls) => (
              <span key={cls} style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0.1rem 0.5rem", borderRadius: 999, background: (DET_COLOR[cls] ?? "#94a3b8") + "cc", color: "#fff" }}>
                {DET_NAME[cls] ?? "Unknown"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {useSnapshot ? (
        <div style={{ padding: "0.45rem 1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          <span>Snapshot polling</span>
          <span>~15s · not live</span>
        </div>
      ) : latest ? (
        <div style={{ padding: "0.45rem 1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          <span>{latest.detection_count} detections · {latest.track_count} tracks</span>
          <span>{relativeTime(latest.capture_at ?? latest.ingested_at)}</span>
        </div>
      ) : null}
    </div>
  );
}

function thermalColor(ratio: number): string {
  const r = Math.round(ratio < 0.5 ? 0 : (ratio - 0.5) / 0.5 * 255);
  const g = Math.round(ratio < 0.25 ? ratio / 0.25 * 255 : ratio < 0.75 ? 255 : (1 - ratio) / 0.25 * 255);
  const b = Math.round(ratio < 0.5 ? (0.5 - ratio) / 0.5 * 255 : 0);
  const alpha = 0.08 + ratio * 0.75;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function AtividadesDodia({ pets }: { pets: Pet[] }) {
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  useEffect(() => { api.activity().then(setActivity).catch(() => {}); }, []);

  const summary = activity?.summary ?? {};
  const petNames = pets.map((p) => p.name).filter((n) => summary[n]);
  const PET_COLORS: Record<string, string> = { Branca: "#00b4d8", Marrie: "#a78bfa" };

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
  const CHART_H = 148, BAR_W = 12, BAR_GAP = 3;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
      <div style={{ display: "flex", gap: "0.25rem" }}>
        <div style={{ width: 32, display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", paddingBottom: 36 }}>
          {ySteps.map((v) => <span key={v} style={{ fontSize: "0.62rem", color: "var(--text-muted)", lineHeight: 1 }}>{v}%</span>)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ position: "relative", height: CHART_H }}>
            {ySteps.map((_, i) => (
              <div key={i} style={{ position: "absolute", bottom: `${(i / (ySteps.length - 1)) * 100}%`, left: 0, right: 0, height: 1, background: "var(--border)", opacity: 0.6 }} />
            ))}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
              {ACTIVITIES.map((act) => (
                <div key={act.key} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: BAR_GAP }}>
                  {petNames.length === 0 ? (
                    <div style={{ width: BAR_W * 2 + BAR_GAP, height: 2, background: "var(--border)", borderRadius: "2px 2px 0 0" }} />
                  ) : petNames.map((name) => {
                    const pct = pcts[name]?.[act.key] ?? 0;
                    const h = Math.max(2, (pct / yMax) * CHART_H);
                    return <div key={name} style={{ width: BAR_W, height: h, background: PET_COLORS[name] ?? "#94a3b8", borderRadius: "2px 2px 0 0", transition: "height 0.5s ease" }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", paddingTop: "0.4rem" }}>
            {ACTIVITIES.map((act) => (
              <div key={act.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem", color: "var(--text-muted)", fontSize: "0.65rem" }}>
                {act.icon}
                {act.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      {!activity && <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>Analytics available after processing clips</p>}
    </div>
  );
}

function MapaDeCirculacao({ pets, bgUrl, onNavigate }: { pets: Pet[]; bgUrl: string | null; onNavigate: () => void }) {
  const [heatmaps, setHeatmaps] = useState<Record<string, HeatmapResponse>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const PET_COLORS: Record<string, string> = { Branca: "#00b4d8", Marrie: "#a78bfa" };

  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const p of pets) init[p.name] = true;
    setVisible(init);
  }, [pets]);

  useEffect(() => {
    if (pets.length === 0) return;
    for (const p of pets) {
      api.heatmap(p.name).then((r) => { setHeatmaps((prev) => ({ ...prev, [p.name]: r })); }).catch(() => {});
    }
  }, [pets]);

  const visiblePets = pets.filter((p) => visible[p.name] && heatmaps[p.name]);
  const combined = (() => {
    if (visiblePets.length === 0) return null;
    const first = heatmaps[visiblePets[0].name];
    const rows = first.grid_h, cols = first.grid_w;
    const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (const p of visiblePets) {
      const g = heatmaps[p.name].grid;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] += g[r]?.[c] ?? 0;
    }
    return { grid, rows, cols };
  })();
  const combinedMax = combined ? Math.max(1, ...combined.grid.flat()) : 1;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Mapa de circulação (Heatmap)</span>
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ flex: 1, position: "relative", minHeight: 160, cursor: "pointer" }} onClick={onNavigate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(); }}>
          {bgUrl ? (
            <img src={bgUrl} alt="Room" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#080f1a" }} />
          )}
          {combined && (
            <svg viewBox={`0 0 ${combined.cols} ${combined.rows}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block" }} preserveAspectRatio="none">
              {combined.grid.map((row, r) => row.map((count, c) => count === 0 ? null : (
                <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={thermalColor(count / combinedMax)} />
              )))}
            </svg>
          )}
          {!combined && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>Open full heatmap →</span></div>}
        </div>
        <div style={{ width: 100, flexShrink: 0, borderLeft: "1px solid var(--border)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.9rem", background: "var(--bg-elevated)" }}>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Exibir</div>
            {pets.map((p) => (
              <label key={p.name} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: "0.4rem" }}>
                <input type="checkbox" checked={visible[p.name] ?? true} onChange={(e) => setVisible((prev) => ({ ...prev, [p.name]: e.target.checked }))} style={{ accentColor: PET_COLORS[p.name] ?? "var(--teal)", width: 13, height: 13 }} />
                <span style={{ fontSize: "0.75rem", color: PET_COLORS[p.name] ?? "var(--text-primary)", fontWeight: 500 }}>{p.name}</span>
              </label>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Intensidade</div>
            <div style={{ height: 8, borderRadius: 3, background: "linear-gradient(to right, rgba(0,0,255,0.7), rgba(0,255,0,0.7), rgba(255,165,0,0.9), rgba(255,0,0,1))" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BlinkBanner({ blinkStatus, onConfigure }: { blinkStatus: BlinkStatus | null; onConfigure: () => void }) {
  if (!blinkStatus || blinkStatus.status === "configured") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)", padding: "0.65rem 1rem", marginBottom: "1rem", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
          <path d="M7 4v3M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: "0.82rem", color: "#f87171" }}>
          {blinkStatus.status === "not_configured" ? "Blink camera not configured — no new clips will be downloaded" : "Blink credentials file is invalid"}
        </span>
      </div>
      <button onClick={onConfigure} style={{ fontSize: "0.76rem", fontWeight: 600, color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-sm)", padding: "0.3rem 0.7rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
        Configure →
      </button>
    </div>
  );
}

function RecentEvents({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1rem" }}>
      <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.85rem" }}>Recent Events</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.75rem" }}>
        {clips.slice(0, 5).map((clip) => {
          const name = clip.original_filename.split("\\").pop()?.split("/").pop() ?? clip.original_filename;
          return (
            <div key={clip.id} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ height: 76, background: "#080f1a", position: "relative", overflow: "hidden" }}>
                <img src={api.clipThumbnailUrl(clip.id)} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                {clip.detection_count > 0 && (
                  <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", borderRadius: 999, padding: "1px 6px", fontSize: "0.6rem", color: "var(--teal)", fontWeight: 700 }}>{clip.detection_count} det</div>
                )}
              </div>
              <div style={{ padding: "0.55rem 0.65rem" }}>
                <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.2rem" }}>{name}</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{clip.detection_count} det · {clip.track_count} tracks</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{relativeTime(clip.capture_at ?? clip.ingested_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SyncChip({ sync }: { sync: SyncStatusResponse }) {
  const color = sync.last_errors.length > 0 ? "var(--danger)" : sync.is_syncing ? "#00b4d8" : "var(--text-muted)";
  const label = sync.is_syncing
    ? "Sincronizando…"
    : sync.last_synced_at
    ? `Sincronizado ${relativeTime(sync.last_synced_at)}`
    : "Aguardando sync";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 999, padding: "0.22rem 0.6rem",
      fontSize: "0.7rem", color,
    }}>
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"
        style={{ animation: sync.is_syncing ? "spin 1s linear infinite" : undefined }}
      >
        <path d="M7 2a5 5 0 1 1-4.33 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </div>
  );
}

function DaySummary({ status, activity }: { status: StatusResponse; activity: ActivityResponse | null }) {
  const summary = activity?.summary ?? {};
  const maxFrames = Object.values(summary).reduce((max, ps) => {
    const t = Object.values(ps as Record<string, number>).reduce((a, b) => a + b, 0);
    return Math.max(max, t);
  }, 0);

  const items = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 7v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      value: maxFrames > 0 ? framesToTime(maxFrames) : `${status.clips.total} clips`,
      label: "Tempo monitorado",
      color: "var(--teal)",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <ellipse cx="11" cy="14" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="1.6" fill="currentColor" opacity="0.7" />
          <circle cx="15" cy="8" r="1.6" fill="currentColor" opacity="0.7" />
          <circle cx="4" cy="12" r="1.3" fill="currentColor" opacity="0.6" />
          <circle cx="18" cy="12" r="1.3" fill="currentColor" opacity="0.6" />
        </svg>
      ),
      value: status.detections.total,
      label: "Eventos detectados",
      color: "var(--purple)",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="2" y="6" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15 10l5-2.5v7L15 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
      value: status.clips.total,
      label: "Clipes salvos",
      color: "var(--teal)",
    },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {items.map(({ icon, value, label, color }) => (
        <div key={label} style={{ flex: "1 1 150px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ color, opacity: 0.9, flexShrink: 0 }}>{icon}</div>
          <div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{label}</div>
          </div>
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
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.status(),
      api.pets(),
      api.clips(10),
      api.blinkStatus().catch(() => null),
      api.blinkCameras().catch(() => null),
      api.activity().catch(() => null),
    ])
      .then(([s, p, c, bs, cams, act]) => {
        setStatus(s); setPets(p); setClips(c);
        setBlinkStatus(bs); setCameras(cams); setActivity(act);
        const camName = cams?.cameras[0];
        if (camName) setBgUrl(`${api.blinkSnapshotUrl(camName)}?t=${Date.now()}`);
        else if (c[0]) setBgUrl(api.clipThumbnailUrl(c[0].id));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const poll = () => api.syncStatus().then(setSyncStatus).catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1.25rem", background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
        <strong>Failed to connect to API:</strong> {error}
        <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Make sure <code style={{ color: "var(--teal)" }}>petmonitor-api</code> is running at 127.0.0.1:8000.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1 }}>Dashboard</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.3rem", textTransform: "capitalize" }}>{today}</p>
        </div>
        {syncStatus && <SyncChip sync={syncStatus} />}
      </div>

      <BlinkBanner blinkStatus={blinkStatus} onConfigure={() => onNavigate("settings")} />

      {/* Resumo do dia */}
      {status && <DaySummary status={status} activity={activity} />}

      {/* Pet cards + camera */}
      <div className="db-top">
        {pets.length > 0 ? pets.map((pet) => (
          <PetCard key={pet.id} pet={pet} actSummary={activity?.summary[pet.name] ?? null} />
        )) : (
          <>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem", color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem" }}>No pets registered</div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem", color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem" }}>No pets registered</div>
          </>
        )}
        <div className="db-camera">
          <CameraPanel clips={clips} blinkConnected={status?.blink_connected ?? false} cameraName={cameras?.cameras[0] ?? ""} />
        </div>
      </div>

      {/* Activity chart + heatmap */}
      <div className="db-mid">
        <AtividadesDodia pets={pets} />
        <MapaDeCirculacao pets={pets} bgUrl={bgUrl} onNavigate={() => onNavigate("heatmap")} />
      </div>

      <RecentEvents clips={clips} />
    </div>
  );
}
