import { useEffect, useState, useCallback } from "react";
import { adminApi, type Frame, type FrameStats } from "../../api";
import LabelModal from "./LabelModal";

type Filter = "all" | "pending" | "keep" | "discard" | "labeled";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--text-muted)",
  keep: "var(--teal)",
  discard: "#e05252",
  labeled: "#a78bfa",
};

const PAGE_SIZE = 100;

function StatsBar({ stats }: { stats: FrameStats }) {
  const items = [
    { label: "Total", value: stats.total, color: "var(--text-primary)" },
    { label: "Pending", value: stats.pending ?? 0, color: STATUS_COLORS.pending },
    { label: "Keep", value: stats.keep ?? 0, color: STATUS_COLORS.keep },
    { label: "Discard", value: stats.discard ?? 0, color: STATUS_COLORS.discard },
    { label: "Labeled", value: stats.labeled ?? 0, color: STATUS_COLORS.labeled },
  ];
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {items.map((i) => (
        <div
          key={i.label}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.4rem 0.9rem",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>{i.label} </span>
          <strong style={{ color: i.color }}>{i.value}</strong>
        </div>
      ))}
    </div>
  );
}

function FrameCard({
  frame,
  onMark,
  onLabel,
}: {
  frame: Frame;
  onMark: (id: number, status: string) => void;
  onLabel: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: `2px solid ${STATUS_COLORS[frame.status] ?? "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <img
        src={`/api/v1/admin/frames/${frame.id}/image`}
        alt={`clip ${frame.clip_id} frame ${frame.frame_index}`}
        loading="lazy"
        onClick={onLabel}
        style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", cursor: "pointer" }}
      />
      <div style={{ padding: "0.4rem 0.5rem" }}>
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            marginBottom: "0.35rem",
            fontFamily: "monospace",
          }}
        >
          clip {frame.clip_id} · f{frame.frame_index}
        </div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <button
            onClick={() => onMark(frame.id, "keep")}
            aria-pressed={frame.status === "keep"}
            style={{
              flex: 1,
              padding: "0.25rem 0",
              fontSize: "0.75rem",
              borderRadius: "var(--radius-sm)",
              background: frame.status === "keep" ? "var(--teal)" : "transparent",
              color: frame.status === "keep" ? "#fff" : "var(--teal)",
              border: `1px solid var(--teal)`,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✓
          </button>
          <button
            onClick={() => onMark(frame.id, "discard")}
            aria-pressed={frame.status === "discard"}
            style={{
              flex: 1,
              padding: "0.25rem 0",
              fontSize: "0.75rem",
              borderRadius: "var(--radius-sm)",
              background: frame.status === "discard" ? "#e05252" : "transparent",
              color: frame.status === "discard" ? "#fff" : "#e05252",
              border: "1px solid #e05252",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✗
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DatasetView() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [stats, setStats] = useState<FrameStats>({ total: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [labelIdx, setLabelIdx] = useState<number | null>(null);

  const load = useCallback(async (f: Filter, o: number) => {
    setLoading(true);
    try {
      const status = f === "all" ? undefined : f;
      const [data, s] = await Promise.all([
        adminApi.frames(PAGE_SIZE, o, status),
        adminApi.frameStats(),
      ]);
      setFrames(data.frames);
      setTotal(data.total);
      setStats(s);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter, offset); }, [filter, offset, load]);

  async function handleScan() {
    setMsg(null);
    try {
      const r = await adminApi.scanFrames();
      setMsg(`Scan completo: ${r.registered} frames registrados, ${r.total} no total.`);
      await load(filter, offset);
    } catch (e) {
      setMsg(String(e));
    }
  }

  async function handleSplit() {
    setMsg(null);
    try {
      const r = await adminApi.splitDataset();
      setMsg(r.message ?? "Split concluído.");
    } catch (e) {
      setMsg(String(e));
    }
  }

  async function handleMark(id: number, status: string) {
    try {
      const updated = await adminApi.updateFrame(id, status);
      setFrames((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setStats((prev) => ({ ...prev }));
      await adminApi.frameStats().then(setStats);
    } catch (e) {
      setMsg(String(e));
    }
  }

  function handleFrameUpdated(updated: Frame) {
    setFrames((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    adminApi.frameStats().then(setStats).catch(() => {});
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "pending", label: "Pending" },
    { id: "keep", label: "Keep" },
    { id: "discard", label: "Discard" },
    { id: "labeled", label: "Labeled" },
  ];

  return (
    <>
    {labelIdx !== null && (
      <LabelModal
        frames={frames}
        initialIndex={labelIdx}
        onClose={() => setLabelIdx(null)}
        onFrameUpdated={handleFrameUpdated}
      />
    )}
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={handleScan}
          style={{
            padding: "0.5rem 1.1rem",
            background: "var(--teal)",
            color: "#fff",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Scan frames
        </button>
        <button
          onClick={handleSplit}
          style={{
            padding: "0.5rem 1.1rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Split dataset
        </button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Message */}
      {msg && (
        <p
          style={{
            padding: "0.6rem 0.9rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "0.75rem",
          }}
        >
          {msg}
        </p>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setOffset(0); }}
            style={{
              padding: "0.3rem 0.8rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              fontWeight: filter === f.id ? 600 : 400,
              background: filter === f.id ? "rgba(0,180,216,0.12)" : "transparent",
              color: filter === f.id ? "var(--teal)" : "var(--text-secondary)",
              border: `1px solid ${filter === f.id ? "var(--teal)" : "var(--border)"}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
      ) : frames.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          Nenhum frame encontrado.{" "}
          {stats.total === 0 && 'Clique em "Scan frames" para registrar.'}
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.6rem",
              marginBottom: "1rem",
            }}
          >
            {frames.map((f, i) => (
              <FrameCard key={f.id} frame={f} onMark={handleMark} onLabel={() => setLabelIdx(i)} />
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "center" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
