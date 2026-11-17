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

const STATUS_BG: Record<string, string> = {
  pending: "var(--bg-elevated)",
  keep: "color-mix(in srgb, var(--teal) 12%, var(--bg-elevated))",
  discard: "color-mix(in srgb, #e05252 12%, var(--bg-elevated))",
  labeled: "color-mix(in srgb, #a78bfa 12%, var(--bg-elevated))",
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
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {items.map((i) => (
        <div
          key={i.label}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.32rem 0.75rem",
            fontSize: "0.82rem",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>{i.label} </span>
          <strong style={{ color: i.color }}>{i.value}</strong>
        </div>
      ))}
    </div>
  );
}

function BulkBar({
  count,
  onKeep,
  onDiscard,
  onClear,
}: {
  count: number;
  onKeep: () => void;
  onDiscard: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--teal)",
        borderRadius: "var(--radius-sm)",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        marginBottom: "0.6rem",
        boxShadow: "0 2px 12px rgba(0,180,216,0.12)",
      }}
    >
      <span style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600, color: "var(--teal)" }}>
        {count} selected
      </span>
      <button
        onClick={onKeep}
        style={{
          padding: "0.3rem 0.9rem",
          borderRadius: "var(--radius-sm)",
          background: "var(--teal)",
          color: "#fff",
          fontSize: "0.82rem",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Keep
      </button>
      <button
        onClick={onDiscard}
        style={{
          padding: "0.3rem 0.9rem",
          borderRadius: "var(--radius-sm)",
          background: "#e05252",
          color: "#fff",
          fontSize: "0.82rem",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Discard
      </button>
      <button
        onClick={onClear}
        style={{
          padding: "0.3rem 0.8rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: "0.82rem",
          cursor: "pointer",
        }}
      >
        Clear
      </button>
    </div>
  );
}

function FrameCard({
  frame,
  selected,
  onToggleSelect,
  onMark,
  onLabel,
}: {
  frame: Frame;
  selected: boolean;
  onToggleSelect: () => void;
  onMark: (id: number, status: string) => void;
  onLabel: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        background: selected
          ? "color-mix(in srgb, var(--teal) 18%, var(--bg-elevated))"
          : (STATUS_BG[frame.status] ?? "var(--bg-elevated)"),
        border: `2px solid ${selected ? "var(--teal)" : STATUS_COLORS[frame.status] ?? "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={`/api/v1/admin/frames/${frame.id}/image`}
        alt={`clip ${frame.clip_id} frame ${frame.frame_index}`}
        loading="lazy"
        onClick={onLabel}
        style={{
          width: "100%",
          aspectRatio: "4/3",
          objectFit: "cover",
          display: "block",
          cursor: "pointer",
        }}
      />

      {/* Status dot — always visible */}
      <div
        style={{
          position: "absolute",
          top: "0.4rem",
          right: "0.4rem",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: STATUS_COLORS[frame.status] ?? "var(--border)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.45)",
          pointerEvents: "none",
        }}
      />

      {/* Checkbox — hover or selected */}
      {(hovered || selected) && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          style={{
            position: "absolute",
            top: "0.35rem",
            left: "0.35rem",
            width: "20px",
            height: "20px",
            borderRadius: "4px",
            border: `2px solid ${selected ? "var(--teal)" : "rgba(255,255,255,0.75)"}`,
            background: selected ? "var(--teal)" : "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          {selected ? "✓" : ""}
        </button>
      )}

      {/* Bottom action overlay — hover only */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(10, 20, 35, 0.9)",
            padding: "0.38rem 0.4rem",
            display: "flex",
            gap: "0.28rem",
            alignItems: "center",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: "0.62rem",
              color: "var(--text-muted)",
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            c{frame.clip_id}·f{frame.frame_index}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onMark(frame.id, "keep"); }}
            style={{
              padding: "0.2rem 0.45rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.72rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              background: frame.status === "keep" ? "var(--teal)" : "rgba(0,180,216,0.2)",
              color: "var(--teal)",
            }}
          >
            ✓
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMark(frame.id, "discard"); }}
            style={{
              padding: "0.2rem 0.45rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.72rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              background: frame.status === "discard" ? "#e05252" : "rgba(224,82,82,0.2)",
              color: "#e05252",
            }}
          >
            ✗
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLabel(); }}
            style={{
              padding: "0.2rem 0.45rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.72rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              background: "rgba(167,139,250,0.2)",
              color: "#a78bfa",
            }}
          >
            ✏
          </button>
        </div>
      )}
    </div>
  );
}

function PaginationBar({
  offset,
  total,
  pageSize,
  onOffset,
}: {
  offset: number;
  total: number;
  pageSize: number;
  onOffset: (o: number) => void;
}) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  const [gotoVal, setGotoVal] = useState(String(currentPage));

  useEffect(() => { setGotoVal(String(currentPage)); }, [currentPage]);

  function handleGoto() {
    const p = parseInt(gotoVal, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onOffset((p - 1) * pageSize);
    }
  }

  if (total === 0) return null;

  const btn = {
    padding: "0.32rem 0.75rem",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "0.82rem",
    cursor: "pointer",
  } as const;

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
      <button onClick={() => onOffset(Math.max(0, offset - pageSize))} disabled={offset === 0} style={btn}>
        ← Previous
      </button>
      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", minWidth: "7rem", textAlign: "center" }}>
        {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
      </span>
      <button onClick={() => onOffset(offset + pageSize)} disabled={offset + pageSize >= total} style={btn}>
        Next →
      </button>
      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", marginLeft: "0.5rem" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={gotoVal}
          onChange={(e) => setGotoVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGoto()}
          style={{
            width: "3rem",
            padding: "0.2rem 0.3rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            textAlign: "center",
          }}
        />
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>/ {totalPages}</span>
        <button onClick={handleGoto} style={{ ...btn, padding: "0.2rem 0.5rem" }}>↵</button>
      </div>
    </div>
  );
}

export default function DatasetView() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [stats, setStats] = useState<FrameStats>({ total: 0 });
  const [filter, setFilter] = useState<Filter>("pending");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [labelIdx, setLabelIdx] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
  useEffect(() => { setSelectedIds(new Set()); }, [filter, offset]);

  async function handleScan() {
    setMsg(null);
    try {
      const r = await adminApi.scanFrames();
      setMsg(`Scan: ${r.registered} new, ${r.total} total.`);
      await load(filter, offset);
    } catch (e) { setMsg(String(e)); }
  }

  async function handleSplit() {
    setMsg(null);
    try {
      const r = await adminApi.splitDataset();
      setMsg(r.message ?? "Split done.");
    } catch (e) { setMsg(String(e)); }
  }

  async function handleMark(id: number, status: string) {
    try {
      const updated = await adminApi.updateFrame(id, status);
      setFrames((prev) => prev.map((f) => (f.id === id ? updated : f)));
      await adminApi.frameStats().then(setStats);
    } catch (e) { setMsg(String(e)); }
  }

  async function handleBulkMark(status: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await adminApi.bulkUpdateFrames(ids, status);
      setSelectedIds(new Set());
      await load(filter, offset);
    } catch (e) { setMsg(String(e)); }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (frames.length > 0 && frames.every((f) => selectedIds.has(f.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(frames.map((f) => f.id)));
    }
  }

  function handleFrameUpdated(updated: Frame) {
    setFrames((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    adminApi.frameStats().then(setStats).catch(() => {});
  }

  const FILTERS: { id: Filter; label: string; color?: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending", color: STATUS_COLORS.pending },
    { id: "keep", label: "Keep", color: STATUS_COLORS.keep },
    { id: "discard", label: "Discard", color: STATUS_COLORS.discard },
    { id: "labeled", label: "Labeled", color: "#a78bfa" },
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
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={handleScan}
            style={{
              padding: "0.42rem 1rem",
              background: "var(--teal)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: "0.88rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Scan frames
          </button>
          <button
            onClick={handleSplit}
            style={{
              padding: "0.42rem 1rem",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            Split dataset
          </button>
          {msg && (
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{msg}</span>
          )}
        </div>

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setOffset(0); }}
              style={{
                padding: "0.26rem 0.75rem",
                borderRadius: "999px",
                fontSize: "0.82rem",
                fontWeight: filter === f.id ? 600 : 400,
                background: filter === f.id ? "rgba(0,180,216,0.12)" : "transparent",
                color: filter === f.id ? (f.color ?? "var(--teal)") : "var(--text-secondary)",
                border: `1px solid ${filter === f.id ? (f.color ?? "var(--teal)") : "var(--border)"}`,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
          {frames.length > 0 && (
            <button
              onClick={toggleSelectAll}
              style={{
                marginLeft: "auto",
                padding: "0.26rem 0.75rem",
                borderRadius: "999px",
                fontSize: "0.82rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {frames.every((f) => selectedIds.has(f.id)) ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : frames.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            No frames found.{" "}
            {stats.total === 0 && 'Click "Scan frames" to register.'}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: "0.5rem" }}>
              <PaginationBar offset={offset} total={total} pageSize={PAGE_SIZE} onOffset={setOffset} />
            </div>
            <BulkBar
              count={selectedIds.size}
              onKeep={() => handleBulkMark("keep")}
              onDiscard={() => handleBulkMark("discard")}
              onClear={() => setSelectedIds(new Set())}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
                gap: "0.5rem",
                margin: "0.75rem 0 1rem",
              }}
            >
              {frames.map((f, i) => (
                <FrameCard
                  key={f.id}
                  frame={f}
                  selected={selectedIds.has(f.id)}
                  onToggleSelect={() => toggleSelect(f.id)}
                  onMark={handleMark}
                  onLabel={() => setLabelIdx(i)}
                />
              ))}
            </div>
            <PaginationBar offset={offset} total={total} pageSize={PAGE_SIZE} onOffset={setOffset} />
          </>
        )}
      </div>
    </>
  );
}
