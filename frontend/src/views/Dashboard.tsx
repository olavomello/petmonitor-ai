import { useEffect, useState } from "react";
import { api, type BlinkCamerasResponse, type BlinkStatus, type Clip, type Pet, type StatusResponse } from "../api";
import type { View } from "../nav";

const PET_COLOR: Record<string, string> = {
  Branca: "var(--teal)",
  Marrie: "var(--purple)",
};

function petColor(name: string): string {
  return PET_COLOR[name] ?? "var(--text-secondary)";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

function PetCard({ pet, maxTracks }: { pet: Pet; maxTracks: number }) {
  const color = petColor(pet.name);
  const pct = maxTracks > 0 ? Math.min(100, Math.round((pet.track_count / maxTracks) * 100)) : 0;

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1.1rem",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />

      {/* Avatar + name + status */}
      <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", marginBottom: "0.9rem" }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: `color-mix(in srgb, ${color} 14%, var(--bg-elevated))`,
          border: `2px solid color-mix(in srgb, ${color} 40%, transparent)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.2rem", fontWeight: 700, color,
          flexShrink: 0,
        }}>
          {pet.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{pet.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: pet.clip_count > 0 ? "var(--moving)" : "var(--border)",
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              {pet.clip_count > 0 ? "Detected" : "No data"}
            </span>
          </div>
        </div>
      </div>

      {/* Big metric */}
      <div style={{ marginBottom: "0.55rem" }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, color, lineHeight: 1 }}>
          {pet.track_count || "—"}
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
          tracks · {pet.clip_count} clips
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        background: "var(--border)", borderRadius: 999, height: 4,
        marginBottom: "0.8rem", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 999, background: color,
          width: `${pct}%`, transition: "width 0.6s ease",
        }} />
      </div>

    </div>
  );
}

function CameraPanel({ clips, blinkConnected, cameraName }: { clips: Clip[]; blinkConnected: boolean; cameraName: string }) {
  const latest = clips[0];
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbUrl = latest ? api.clipThumbnailUrl(latest.id) : null;

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.8rem 1rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Camera</span>
          <span style={{
            fontSize: "0.62rem", padding: "0.12rem 0.45rem",
            borderRadius: 999,
            background: blinkConnected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: blinkConnected ? "#86efac" : "#fca5a5",
            fontWeight: 600,
          }}>{blinkConnected ? "Online" : "Offline"}</span>
        </div>
        {cameraName && <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{cameraName}</span>}
      </div>

      {/* Feed area — thumbnail of latest clip */}
      <div style={{
        flex: 1, background: "#080f1a",
        position: "relative",
        minHeight: 160,
        overflow: "hidden",
      }}>
        {thumbUrl && !thumbFailed ? (
          <img
            src={thumbUrl}
            alt="Latest clip"
            onError={() => setThumbFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 160 }}
          />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "1.75rem 1.25rem", gap: "0.6rem",
            height: "100%", minHeight: 160,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity={0.25}>
              <rect x="2" y="6" width="14" height="12" rx="2" stroke="#94a3b8" strokeWidth="1.5" />
              <path d="M16 10.5l6-3v9l-6-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
              {blinkConnected ? "Blink camera connected" : "Blink camera not connected"}
            </span>
          </div>
        )}
        {/* Overlay badge for detection count */}
        {latest && latest.detection_count > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(0,180,216,0.85)", color: "#fff",
            fontSize: "0.62rem", fontWeight: 700,
            padding: "0.1rem 0.4rem", borderRadius: 999,
          }}>
            {latest.detection_count} det.
          </div>
        )}
      </div>

      {/* Footer */}
      {latest && (
        <div style={{
          padding: "0.55rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.72rem",
          color: "var(--text-muted)",
        }}>
          <span>{latest.detection_count} detections · {latest.track_count} tracks</span>
          <span>{relativeTime(latest.capture_at ?? latest.ingested_at)}</span>
        </div>
      )}
    </div>
  );
}

const TIME_SLOTS = ["00h", "03h", "06h", "09h", "12h", "15h", "18h", "21h"];

function ActivityChart({ pets }: { pets: Pet[] }) {
  const byName: Record<string, Pet> = {};
  for (const p of pets) byName[p.name] = p;
  const branca = byName["Branca"];
  const marrie = byName["Marrie"];

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Daily Activity</span>
        <div style={{ display: "flex", gap: "0.65rem" }}>
          {branca && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--teal)", display: "inline-block" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Branca</span>
            </div>
          )}
          {marrie && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--purple)", display: "inline-block" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Marrie</span>
            </div>
          )}
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", flex: 1, minHeight: 72 }}>
        {TIME_SLOTS.map((slot) => (
          <div key={slot} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: 2, justifyContent: "center" }}>
              <div style={{ width: 7, height: 2, background: "var(--teal)", borderRadius: "2px 2px 0 0", opacity: 0.25 }} />
              <div style={{ width: 7, height: 2, background: "var(--purple)", borderRadius: "2px 2px 0 0", opacity: 0.25 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Time axis */}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
        {TIME_SLOTS.map((slot) => (
          <span key={slot} style={{ flex: 1, fontSize: "0.58rem", color: "var(--text-muted)", textAlign: "center" }}>{slot}</span>
        ))}
      </div>

      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
        Analytics available after processing clips
      </p>
    </div>
  );
}

function HeatmapPanel({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Movement Map</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", display: "inline-block" }} />
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Branca</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple)", display: "inline-block" }} />
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Marrie</span>
          </div>
        </div>
      </div>

      {/* Clickable heatmap area */}
      <div
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(); }}
        style={{
          flex: 1, minHeight: 120,
          background: "#080f1a",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          cursor: "pointer",
        }}
      >
        <svg width="48" height="36" viewBox="0 0 48 36" opacity={0.18}>
          <rect x="0.5" y="0.5" width="47" height="35" rx="2" stroke="#94a3b8" strokeWidth="0.5" fill="none" />
          {[12, 24, 36].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={36} stroke="#94a3b8" strokeWidth="0.5" />
          ))}
          {[9, 18, 27].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={48} y2={y} stroke="#94a3b8" strokeWidth="0.5" />
          ))}
        </svg>
        <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Open full heatmap →</span>
      </div>
    </div>
  );
}

function BlinkBanner({ blinkStatus, onConfigure }: { blinkStatus: BlinkStatus | null; onConfigure: () => void }) {
  if (!blinkStatus || blinkStatus.status === "configured") return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "var(--radius)",
      padding: "0.65rem 1rem",
      marginBottom: "1rem",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
          <path d="M7 4v3M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: "0.82rem", color: "#f87171" }}>
          {blinkStatus.status === "not_configured"
            ? "Blink camera not configured — no new clips will be downloaded"
            : "Blink credentials file is invalid"}
        </span>
      </div>
      <button
        onClick={onConfigure}
        style={{
          fontSize: "0.76rem", fontWeight: 600, color: "#f87171",
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "var(--radius-sm)", padding: "0.3rem 0.7rem", cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        Configure →
      </button>
    </div>
  );
}

function RecentEvents({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return (
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.1rem 1rem",
        marginBottom: "1rem",
      }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.65rem" }}>
          Recent Events
        </span>
        <p style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>
          No clips ingested yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem",
      marginBottom: "1rem",
    }}>
      <span style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.85rem" }}>
        Recent Events
      </span>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: "0.75rem",
      }}>
        {clips.slice(0, 5).map((clip) => {
          const name = clip.original_filename.split("\\").pop()?.split("/").pop() ?? clip.original_filename;
          const thumbUrl = api.clipThumbnailUrl(clip.id);
          return (
            <div key={clip.id} style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              overflow: "hidden",
              cursor: "pointer",
            }}>
              <div style={{ height: 76, background: "#080f1a", position: "relative", overflow: "hidden" }}>
                <img
                  src={thumbUrl}
                  alt={name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                {clip.detection_count > 0 && (
                  <div style={{
                    position: "absolute", top: 4, right: 4,
                    background: "rgba(0,0,0,0.7)", borderRadius: 999,
                    padding: "1px 6px", fontSize: "0.6rem", color: "var(--teal)", fontWeight: 700,
                  }}>
                    {clip.detection_count} det
                  </div>
                )}
              </div>
              <div style={{ padding: "0.55rem 0.65rem" }}>
                <div style={{
                  fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  marginBottom: "0.2rem",
                }}>
                  {name}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {clip.detection_count} det · {clip.track_count} tracks
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {relativeTime(clip.capture_at ?? clip.ingested_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DaySummary({ status }: { status: StatusResponse }) {
  const stats = [
    { label: "Processed Clips", value: status.clips.total },
    { label: "Detections", value: status.detections.total },
    { label: "Tracks", value: status.tracks.total },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {stats.map(({ label, value }) => (
        <div key={label} style={{
          flex: "1 1 130px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0.85rem 1rem",
        }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
            {label}
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [blinkStatus, setBlinkStatus] = useState<BlinkStatus | null>(null);
  const [cameras, setCameras] = useState<BlinkCamerasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.status(),
      api.pets(),
      api.clips(10),
      api.blinkStatus().catch(() => null),
      api.blinkCameras().catch(() => null),
    ])
      .then(([s, p, c, bs, cams]) => {
        setStatus(s); setPets(p); setClips(c);
        setBlinkStatus(bs); setCameras(cams);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  const maxTracks = Math.max(...pets.map((p) => p.track_count), 1);

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "5rem", color: "var(--text-muted)", fontSize: "0.9rem",
      }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "1.25rem",
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
      }}>
        <strong>Failed to connect to API:</strong> {error}
        <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Make sure <code style={{ color: "var(--teal)" }}>petmonitor-api</code> is running at 127.0.0.1:8000.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1 }}>Dashboard</h1>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.3rem", textTransform: "capitalize" }}>
          {today}
        </p>
      </div>

      {/* Blink offline banner */}
      <BlinkBanner blinkStatus={blinkStatus} onConfigure={() => onNavigate("settings")} />

      {/* Summary stats */}
      {status && <DaySummary status={status} />}

      {/* Top section: pet cards + camera */}
      <div className="db-top">
        {pets.length > 0
          ? pets.map((pet) => <PetCard key={pet.id} pet={pet} maxTracks={maxTracks} />)
          : (
            <>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "1.5rem",
                color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem",
              }}>
                No pets registered
              </div>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "1.5rem",
                color: "var(--text-muted)", textAlign: "center", fontSize: "0.85rem",
              }}>
                No pets registered
              </div>
            </>
          )
        }
        <div className="db-camera">
          <CameraPanel
            clips={clips}
            blinkConnected={status?.blink_connected ?? false}
            cameraName={cameras?.cameras[0] ?? ""}
          />
        </div>
      </div>

      {/* Mid section: activity + heatmap */}
      <div className="db-mid">
        <ActivityChart pets={pets} />
        <HeatmapPanel onNavigate={() => onNavigate("heatmap")} />
      </div>

      {/* Recent events */}
      <RecentEvents clips={clips} />
    </div>
  );
}
