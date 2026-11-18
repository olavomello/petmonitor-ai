import { useEffect, useRef, useState } from "react";
import { api, type Pet, type TrajectoryPoint } from "../api";

const PET_COLORS: Record<string, string> = {
  Branca: "var(--teal)",
  Marrie: "var(--purple)",
};

function petColor(name: string): string {
  if (PET_COLORS[name]) return PET_COLORS[name];
  const hues = [200, 280, 40, 160, 320];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % hues.length;
  return `hsl(${hues[h]}, 70%, 55%)`;
}

function TrajectoryCanvas({
  points,
  color,
  width,
  height,
}: {
  points: TrajectoryPoint[];
  color: string;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Normalize coordinates from pixel-space to canvas
    const xs = points.map((p) => p.x_px);
    const ys = points.map((p) => p.y_px);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const pad = 24;

    function toCanvas(x: number, y: number): [number, number] {
      return [
        pad + ((x - minX) / rangeX) * (width - pad * 2),
        pad + ((y - minY) / rangeY) * (height - pad * 2),
      ];
    }

    // Draw heatmap-style density using small translucent circles
    ctx.save();
    for (const p of points) {
      const [cx, cy] = toCanvas(p.x_px, p.y_px);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      grad.addColorStop(0, color.replace("var(--teal)", "#00b4d8").replace("var(--purple)", "#a78bfa") + "55");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw path connecting points chronologically
    if (points.length > 1) {
      ctx.save();
      ctx.strokeStyle = color.replace("var(--teal)", "#00b4d8").replace("var(--purple)", "#a78bfa");
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      const [x0, y0] = toCanvas(points[0].x_px, points[0].y_px);
      ctx.moveTo(x0, y0);
      for (let i = 1; i < points.length; i++) {
        const [xi, yi] = toCanvas(points[i].x_px, points[i].y_px);
        ctx.lineTo(xi, yi);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Start and end markers
    if (points.length > 0) {
      const [sx, sy] = toCanvas(points[0].x_px, points[0].y_px);
      const [ex, ey] = toCanvas(points[points.length - 1].x_px, points[points.length - 1].y_px);
      ctx.save();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, [points, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", width: "100%", height: "auto", borderRadius: "var(--radius-sm)" }}
    />
  );
}

export default function TrajectoriesView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [points, setPoints] = useState<TrajectoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.pets().then((p) => {
      setPets(p);
      if (p.length > 0 && !selected) setSelected(p[0].name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    api.trajectories(selected)
      .then((r) => setPoints(r.points))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  const color = petColor(selected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Trajectories</h1>
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
          {pets.length === 0 && <option value="">No pets configured</option>}
          {pets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        {points.length > 0 && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {points.length.toLocaleString()} ground-plane samples
          </span>
        )}
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && points.length === 0 && selected && !error && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2.5rem 1rem",
          textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem",
        }}>
          <div style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>📍</div>
          No trajectory data for {selected} yet. Run the pipeline (Camera → Run pipeline) to process clips.
        </div>
      )}

      {!loading && points.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Start</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>End</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{
                width: 20, height: 3,
                background: color.replace("var(--teal)", "#00b4d8").replace("var(--purple)", "#a78bfa"),
                display: "inline-block", borderRadius: 2,
              }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Path</span>
            </div>
          </div>

          {/* Canvas */}
          <div style={{
            background: "#080f1a",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            overflow: "hidden",
            padding: "0.5rem",
          }}>
            <TrajectoryCanvas points={points} color={color} width={800} height={500} />
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            Ground-plane coordinates (bottom-centre of bounding box) from processed footage.
            Each sample is one frame; density indicates frequent areas.
          </p>
        </div>
      )}
    </div>
  );
}
