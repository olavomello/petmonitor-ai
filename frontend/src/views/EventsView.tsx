import { useEffect, useRef, useState } from "react";
import { api, type Clip } from "../api";

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

function ClipCard({ clip, onSelect }: { clip: Clip; onSelect: (c: Clip) => void }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbUrl = api.clipThumbnailUrl(clip.id);
  return (
    <button
      onClick={() => onSelect(clip)}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
        cursor: "pointer", textAlign: "left", padding: 0,
        transition: "border-color 0.12s",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "var(--bg-elevated)" }}>
        {!thumbFailed ? (
          <img
            src={thumbUrl}
            alt=""
            onError={() => setThumbFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem",
          }}>
            No preview
          </div>
        )}
        {clip.detection_count > 0 && (
          <span style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(0,180,216,0.85)", color: "#fff",
            fontSize: "0.62rem", fontWeight: 700,
            padding: "0.1rem 0.4rem", borderRadius: 999,
          }}>
            {clip.detection_count} det.
          </span>
        )}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          opacity: 0, transition: "opacity 0.15s",
        }}
          className="play-overlay"
        >
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <path d="M4 2l9 5-9 5V2z" />
            </svg>
          </div>
        </div>
      </div>
      <div style={{ padding: "0.6rem 0.75rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-primary)", fontWeight: 600, marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {clip.original_filename || `clip-${clip.id}`}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
          {formatDate(clip.capture_at || clip.ingested_at)}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
          {clip.track_count > 0 ? `${clip.track_count} tracks` : "No tracks"}
          {" · "}{clip.source_type}
        </div>
      </div>
    </button>
  );
}

function VideoModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = api.clipVideoUrl(clip.id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", borderRadius: "var(--radius)",
          overflow: "hidden", maxWidth: 720, width: "100%",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          style={{ width: "100%", display: "block", maxHeight: "60vh" }}
        />
        <div style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
              {clip.original_filename || `clip-${clip.id}`}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
              {formatDate(clip.capture_at || clip.ingested_at)}
              {" · "}{clip.detection_count} detections · {clip.track_count} tracks
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none",
              color: "var(--text-secondary)", cursor: "pointer",
              fontSize: "1.2rem", lineHeight: 1, padding: "0.1rem 0.3rem",
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventsView() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Clip | null>(null);

  useEffect(() => {
    api.clips(100, 0)
      .then(setClips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Events</h1>
        {!loading && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{clips.length} clips</span>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.86rem" }}>Loading…</p>
      ) : clips.length === 0 ? (
        <div style={{
          padding: "2.5rem 1rem", textAlign: "center",
          color: "var(--text-muted)", fontSize: "0.86rem",
        }}>
          <div style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>📹</div>
          No clips yet. Use Camera to sync from Blink or run Sync in AI Models.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "0.85rem",
        }}>
          {clips.map((c) => (
            <ClipCard key={c.id} clip={c} onSelect={setSelected} />
          ))}
        </div>
      )}

      {selected && <VideoModal clip={selected} onClose={() => setSelected(null)} />}

      <style>{`
        button:hover .play-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
