import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type BBox, type Frame } from "../../api";

const CLASS_NAMES = ["Branca", "Marrie"];
const CLASS_COLORS = ["#00b4d8", "#a78bfa"];

interface Props {
  frames: Frame[];
  initialIndex: number;
  onClose: () => void;
  onFrameUpdated: (frame: Frame) => void;
}

export default function LabelModal({ frames, initialIndex, onClose, onFrameUpdated }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [labels, setLabels] = useState<BBox[]>([]);
  const [selectedClass, setSelectedClass] = useState(0);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<BBox | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = frames[index];

  // Load labels when frame changes
  useEffect(() => {
    setLabels([]);
    setDraft(null);
    setMsg(null);
    adminApi.frameLabels(frame.id).then((r) => setLabels(r.labels)).catch(() => {});
  }, [frame.id]);

  // Redraw canvas whenever labels or draft change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawBox = (b: BBox, dashed = false) => {
      const x = (b.cx - b.w / 2) * W;
      const y = (b.cy - b.h / 2) * H;
      const w = b.w * W;
      const h = b.h * H;
      ctx.strokeStyle = CLASS_COLORS[b.class_id] ?? "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash(dashed ? [6, 3] : []);
      ctx.strokeRect(x, y, w, h);
      if (!dashed) {
        ctx.fillStyle = CLASS_COLORS[b.class_id] ?? "#fff";
        ctx.font = "bold 12px monospace";
        ctx.fillText(CLASS_NAMES[b.class_id] ?? String(b.class_id), x + 3, y + 13);
      }
    };

    for (const b of labels) drawBox(b);
    if (draft) drawBox(draft, true);
  }, [labels, draft]);

  useEffect(() => { redraw(); }, [redraw]);

  function syncCanvas() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    if (canvas.width !== img.clientWidth || canvas.height !== img.clientHeight) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    }
    redraw();
  }

  function toNorm(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 2) {
      // right-click: delete the topmost bbox under cursor
      const { x, y } = toNorm(e);
      setLabels((prev) => {
        const hit = [...prev].reverse().findIndex(
          (b) => x >= b.cx - b.w / 2 && x <= b.cx + b.w / 2
               && y >= b.cy - b.h / 2 && y <= b.cy + b.h / 2,
        );
        if (hit === -1) return prev;
        const realIdx = prev.length - 1 - hit;
        return prev.filter((_, i) => i !== realIdx);
      });
      return;
    }
    setDrawStart(toNorm(e));
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawStart) return;
    const { x, y } = toNorm(e);
    const cx = (drawStart.x + x) / 2;
    const cy = (drawStart.y + y) / 2;
    const w = Math.abs(x - drawStart.x);
    const h = Math.abs(y - drawStart.y);
    setDraft(w > 0.005 && h > 0.005 ? { class_id: selectedClass, cx, cy, w, h } : null);
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 2) return;
    if (draft) {
      setLabels((prev) => [...prev, draft]);
      setDraft(null);
    }
    setDrawStart(null);
  }

  async function doSave(): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await adminApi.saveFrameLabels(frame.id, labels);
      onFrameUpdated(updated);
      setMsg(`${labels.length} label(s) salvo(s).`);
      return true;
    } catch (err) {
      setMsg(String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndNext() {
    const ok = await doSave();
    if (ok && index < frames.length - 1) setIndex((i) => i + 1);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "b" || e.key === "B") setSelectedClass(0);
      if (e.key === "m" || e.key === "M") setSelectedClass(1);
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, frames.length - 1));
      if (e.key === "ArrowLeft")  setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, frames.length]);

  const btnBase: React.CSSProperties = {
    padding: "0.4rem 0.9rem",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "0.85rem",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.88)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "0.6rem", padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Info row */}
      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", textAlign: "center" }}>
        Frame {index + 1} / {frames.length} — clip {frame.clip_id} · f{frame.frame_index}
        <span style={{ marginLeft: "1rem" }}>
          ← → navegar · <kbd>B</kbd>/<kbd>M</kbd> classe · clique direito para apagar bbox · Esc fechar
        </span>
      </div>

      {/* Class selector */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {CLASS_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => setSelectedClass(i)}
            style={{
              padding: "0.3rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: `2px solid ${CLASS_COLORS[i]}`,
              background: selectedClass === i ? CLASS_COLORS[i] : "transparent",
              color: selectedClass === i ? "#fff" : CLASS_COLORS[i],
              fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            {name} ({i === 0 ? "B" : "M"})
          </button>
        ))}
      </div>

      {/* Image + canvas */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <img
          ref={imgRef}
          src={`/api/v1/admin/frames/${frame.id}/image`}
          alt="frame para labeling"
          onLoad={syncCanvas}
          draggable={false}
          style={{
            display: "block",
            maxWidth: "85vw",
            maxHeight: "62vh",
            userSelect: "none",
          }}
        />
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ position: "absolute", top: 0, left: 0, cursor: "crosshair" }}
        />
      </div>

      {/* Labels chips */}
      {labels.length > 0 && (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", maxWidth: "85vw" }}>
          {labels.map((b, i) => (
            <span
              key={i}
              onClick={() => setLabels((prev) => prev.filter((_, j) => j !== i))}
              title="Clique para remover"
              style={{
                padding: "0.15rem 0.5rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
                background: (CLASS_COLORS[b.class_id] ?? "#888") + "33",
                border: `1px solid ${CLASS_COLORS[b.class_id] ?? "#888"}`,
                color: CLASS_COLORS[b.class_id] ?? "#888",
                cursor: "pointer",
              }}
            >
              {CLASS_NAMES[b.class_id] ?? `cls${b.class_id}`}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} style={btnBase}>
          ← Anterior
        </button>
        <button
          onClick={doSave}
          disabled={saving}
          style={{ ...btnBase, background: "var(--bg-elevated)", color: "var(--text-primary)", fontWeight: 600 }}
        >
          Salvar
        </button>
        <button
          onClick={handleSaveAndNext}
          disabled={saving || index >= frames.length - 1}
          style={{ ...btnBase, background: "var(--teal)", border: "none", color: "#fff", fontWeight: 600 }}
        >
          Salvar e próximo →
        </button>
        <button onClick={onClose} style={btnBase}>Fechar</button>
        {msg && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{msg}</span>}
      </div>
    </div>
  );
}
