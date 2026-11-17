interface Props {
  grid: number[][];
  width?: number;
  height?: number;
}

function cellColor(count: number, max: number): string {
  if (max === 0 || count === 0) return "rgba(0,180,216,0.04)";
  const ratio = count / max;
  const a = 0.1 + ratio * 0.85;
  const r = Math.round(ratio * 255);
  const g = Math.round((1 - ratio) * 180);
  const b = Math.round(216 * (1 - ratio * 0.5));
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

export default function HeatmapGrid({ grid, width = 400, height = 300 }: Props) {
  if (!grid || grid.length === 0) {
    return (
      <div style={{ color: "var(--text-muted)", padding: "2rem", textAlign: "center" }}>
        Sem dados de trajetória disponíveis.
      </div>
    );
  }

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const max = Math.max(1, ...grid.flat());

  const cellW = width / cols;
  const cellH = height / rows;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: "block", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", maxWidth: width }}
      aria-label="Mapa de calor de trajetória"
    >
      {grid.map((row, r) =>
        row.map((count, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cellW}
            y={r * cellH}
            width={cellW}
            height={cellH}
            fill={cellColor(count, max)}
          />
        ))
      )}
    </svg>
  );
}
