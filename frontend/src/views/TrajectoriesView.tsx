import { useEffect, useRef, useState } from "react";
import { api, type Clip, type Pet, type TrajectoryPoint } from "../api";

const PET_COLORS: Record<string, string> = {
  Branca: "#00b4d8",
  Marrie: "#a78bfa",
};

function petColor(name: string): string {
  if (PET_COLORS[name]) return PET_COLORS[name];
  const hues = [200, 280, 40, 160, 320];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % hues.length;
  return `hsl(${hues[h]}, 70%, 55%)`;
}

function TrajectoryCanvas({
  points, color,
}: {
  points: TrajectoryPoint[]; color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const xs = points.map((p) => p.x_px);
    const ys = points.map((p) => p.y_px);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const pad = 24;

    function toCanvas(x: number, y: number): [number, number] {
      return [
        pad + ((x - minX) / rangeX) * (W - pad * 2),
        pad + ((y - minY) / rangeY) * (H - pad * 2),
      ];
    }

    ctx.save();
    for (const p of points) {
      const [cx, cy] = toCanvas(p.x_px, p.y_px);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (points.length > 1) {
      ctx.save();
      ctx.strokeStyle = color;
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
  }, [points, color]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={450}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}

function PetTrajectoryCard({
  pet, points, bgUrl, solo,
}: {
  pet: Pet; points: TrajectoryPoint[]; bgUrl: string | null; solo: boolean;
}) {
  const color = petColor(pet.name);

  return (
    <div style={{
      flex: solo ? "1 1 100%" : "1 1 300px",
      minWidth: 0,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "0.6rem 0.85rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{pet.name}</span>
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {points.length.toLocaleString()} samples
        </span>
      </div>

      <div style={{ position: "relative", aspectRatio: "16/9", background: "#080f1a", overflow: "hidden" }}>
        {bgUrl && (
          <img
            src={bgUrl}
            alt="Room background"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }}
          />
        )}
        {points.length === 0 ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", fontSize: "0.8rem",
          }}>
            No trajectory data
          </div>
        ) : (
          <TrajectoryCanvas points={points} color={color} />
        )}
      </div>

      {solo && points.length > 0 && (
        <div style={{
          padding: "0.55rem 0.85rem",
          borderTop: "1px solid var(--border)",
          display: "flex", gap: "1.25rem",
        }}>
          {[
            { color: "#22c55e", label: "Start" },
            { color: "#ef4444", label: "End" },
            { color, label: "Path" },
          ].map(({ color: c, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{
                width: label === "Path" ? 18 : 10,
                height: label === "Path" ? 3 : 10,
                borderRadius: label === "Path" ? 2 : "50%",
                background: c, display: "inline-block",
              }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrajectoriesView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [trajectories, setTrajectories] = useState<Record<string, TrajectoryPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    api.pets().then(setPets).catch(() => {});
    Promise.all([
      api.blinkCameras().catch(() => ({ cameras: [] as string[] })),
      api.clips(1, 0).catch(() => [] as Clip[]),
    ]).then(([cams, clips]) => {
      const camName = cams.cameras[0];
      if (camName) setBgUrl(`${api.blinkSnapshotUrl(camName)}?t=${Date.now()}`);
      else if (clips[0]) setBgUrl(api.clipThumbnailUrl(clips[0].id));
    });
  }, []);

  useEffect(() => {
    if (pets.length === 0) return;
    setLoading(true);
    const toLoad = selected ? [selected] : pets.map((p) => p.name);
    Promise.all(
      toLoad.map((name) =>
        api.trajectories(name)
          .then((r) => [name, r.points] as [string, TrajectoryPoint[]])
          .catch(() => [name, []] as [string, TrajectoryPoint[]])
      )
    ).then((results) => {
      setTrajectories((prev) => {
        const next = { ...prev };
        for (const [name, pts] of results) next[name] = pts;
        return next;
      });
    }).finally(() => setLoading(false));
  }, [pets, selected]);

  const shownPets = selected ? pets.filter((p) => p.name === selected) : pets;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Motion track</h1>
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
          <option value="">All</option>
          {pets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        {loading && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading…</span>}
      </div>

      {!loading && pets.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2.5rem 1rem",
          textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem",
        }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📍</div>
          No pets configured. Add pets in Settings.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {shownPets.map((pet) => (
            <PetTrajectoryCard
              key={pet.name}
              pet={pet}
              points={trajectories[pet.name] ?? []}
              bgUrl={bgUrl}
              solo={shownPets.length === 1}
            />
          ))}
        </div>
      )}

      {!loading && shownPets.length === 1 && (trajectories[shownPets[0]?.name ?? ""] ?? []).length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
          Ground-plane coordinates (bottom-centre of bounding box) from processed footage.
          Each sample is one frame; density indicates frequent areas.
        </p>
      )}
    </div>
  );
}
