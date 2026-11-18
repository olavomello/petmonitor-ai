import { useEffect, useState } from "react";
import { api, type Clip, type HeatmapResponse, type Pet } from "../api";

function thermalColor(ratio: number): string {
  const r = Math.round(ratio < 0.5 ? 0 : (ratio - 0.5) / 0.5 * 255);
  const g = Math.round(
    ratio < 0.25 ? ratio / 0.25 * 255
    : ratio < 0.75 ? 255
    : (1 - ratio) / 0.25 * 255
  );
  const b = Math.round(ratio < 0.5 ? (0.5 - ratio) / 0.5 * 255 : 0);
  const alpha = 0.08 + ratio * 0.75;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function HeatmapOverlay({ grid, gridW, gridH }: { grid: number[][]; gridW: number; gridH: number }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <svg
      viewBox={`0 0 ${gridW} ${gridH}`}
      width="100%" height="100%"
      style={{ position: "absolute", inset: 0, display: "block" }}
      preserveAspectRatio="none"
    >
      {grid.map((row, r) =>
        row.map((count, c) => {
          if (count === 0) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c} y={r} width={1} height={1}
              fill={thermalColor(count / max)}
            />
          );
        })
      )}
    </svg>
  );
}

function PetHeatmapCard({
  pet, data, bgUrl, solo,
}: {
  pet: Pet; data: HeatmapResponse | null; bgUrl: string | null; solo: boolean;
}) {
  const color = pet.name === "Branca" ? "#00b4d8" : pet.name === "Marrie" ? "#a78bfa" : "var(--text-secondary)";

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
        {data && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {data.point_count.toLocaleString()} samples · {data.grid_w}×{data.grid_h}
          </span>
        )}
      </div>

      <div style={{ position: "relative", aspectRatio: "16/9", background: "#080f1a", overflow: "hidden" }}>
        {bgUrl && (
          <img
            src={bgUrl}
            alt="Room background"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
          />
        )}
        {data ? (
          <HeatmapOverlay grid={data.grid} gridW={data.grid_w} gridH={data.grid_h} />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", fontSize: "0.8rem",
          }}>
            No heatmap data
          </div>
        )}
      </div>

      {solo && (
        <div style={{ padding: "0.55rem 0.85rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ height: 8, width: 120, background: "linear-gradient(to right, rgba(0,0,255,0.6), rgba(0,255,0,0.7), rgba(255,165,0,0.9), rgba(255,0,0,0.95))", borderRadius: 4 }} />
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Low → High frequency</span>
          </div>
          {data?.note && (
            <p style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>{data.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HeatmapView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [heatmaps, setHeatmaps] = useState<Record<string, HeatmapResponse>>({});
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    const toLoad = selected ? [selected] : pets.map((p) => p.name);
    Promise.all(
      toLoad.map((name) =>
        api.heatmap(name)
          .then((r) => [name, r] as [string, HeatmapResponse])
          .catch(() => null)
      )
    ).then((results) => {
      setHeatmaps((prev) => {
        const next = { ...prev };
        for (const item of results) {
          if (item) next[item[0]] = item[1];
        }
        return next;
      });
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [pets, selected]);

  const shownPets = selected ? pets.filter((p) => p.name === selected) : pets;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Heatmap</h1>
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

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {!loading && pets.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2.5rem 1rem",
          textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem",
        }}>
          No pets configured. Add pets in Settings.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {shownPets.map((pet) => (
            <PetHeatmapCard
              key={pet.name}
              pet={pet}
              data={heatmaps[pet.name] ?? null}
              bgUrl={bgUrl}
              solo={shownPets.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
