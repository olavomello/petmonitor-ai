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

type SortKey = "newest" | "oldest" | "most_detections" | "most_tracks";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  most_detections: "Most detections",
  most_tracks: "Most tracks",
};

const PAGE_SIZE = 20;

function sortClips(clips: Clip[], sort: SortKey): Clip[] {
  const sorted = [...clips];
  if (sort === "newest") {
    sorted.sort((a, b) => {
      const ta = new Date(a.capture_at ?? a.ingested_at).getTime();
      const tb = new Date(b.capture_at ?? b.ingested_at).getTime();
      return tb - ta;
    });
  } else if (sort === "oldest") {
    sorted.sort((a, b) => {
      const ta = new Date(a.capture_at ?? a.ingested_at).getTime();
      const tb = new Date(b.capture_at ?? b.ingested_at).getTime();
      return ta - tb;
    });
  } else if (sort === "most_detections") {
    sorted.sort((a, b) => b.detection_count - a.detection_count);
  } else {
    sorted.sort((a, b) => b.track_count - a.track_count);
  }
  return sorted;
}

export default function EventsView() {
  const [allClips, setAllClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.clips(500, 0)
      .then(setAllClips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sorted = sortClips(allClips, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageClips = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSortChange(s: SortKey) {
    setSort(s);
    setPage(1);
  }

  return (
    <div>
      {/* Header + controls */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Events</h1>
        {!loading && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{allClips.length} clips</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Sort:</span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.76rem",
                fontWeight: sort === s ? 600 : 400,
                color: sort === s ? "var(--teal)" : "var(--text-secondary)",
                background: sort === s ? "rgba(0,180,216,0.1)" : "var(--bg-card)",
                border: `1px solid ${sort === s ? "var(--teal)" : "var(--border)"}`,
                cursor: "pointer",
              }}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.86rem" }}>Loading…</p>
      ) : allClips.length === 0 ? (
        <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem" }}>
          <div style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>📹</div>
          No clips yet. Use Camera to sync from Blink or run Sync in AI Models.
        </div>
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "0.85rem",
          }}>
            {pageClips.map((c) => (
              <ClipCard key={c.id} clip={c} onSelect={setSelected} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "0.5rem", marginTop: "1.5rem",
            }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  color: page === 1 ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page === 1 ? "default" : "pointer", fontSize: "0.82rem",
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  color: page === totalPages ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page === totalPages ? "default" : "pointer", fontSize: "0.82rem",
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {selected && <VideoModal clip={selected} onClose={() => setSelected(null)} />}

      <style>{`
        button:hover .play-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
