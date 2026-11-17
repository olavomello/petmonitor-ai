import { useEffect, useState } from "react";
import { api, type HeatmapResponse, type Pet } from "../api";
import HeatmapGrid from "../components/HeatmapGrid";

export default function HeatmapView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    api.heatmap(selected)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          {pets.length === 0 && <option value="">No pets configured</option>}
          {pets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Pet</div>
              <div style={{ fontWeight: 700, color: "var(--teal)" }}>{data.identity}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Samples</div>
              <div style={{ fontWeight: 700 }}>{data.point_count}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Grid</div>
              <div style={{ fontWeight: 700 }}>{data.grid_w}×{data.grid_h}</div>
            </div>
          </div>

          <HeatmapGrid grid={data.grid} width={500} height={350} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <div style={{ height: 10, width: 120, background: "linear-gradient(to right, rgba(0,180,216,0.1), rgba(255,100,0,0.95))", borderRadius: 4 }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Low → High frequency</span>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>{data.note}</p>
        </div>
      )}

      {!loading && !data && !error && selected && (
        <p style={{ color: "var(--text-muted)" }}>Select a pet to view the heatmap.</p>
      )}
    </div>
  );
}
