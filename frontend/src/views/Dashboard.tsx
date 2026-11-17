import { useEffect, useState } from "react";
import { api, type Clip, type Pet, type StatusResponse } from "../api";
import StatCard from "../components/StatCard";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function PetRow({ pet }: { pet: Pet }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>{pet.name}</td>
      <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", textAlign: "right" }}>{pet.track_count}</td>
      <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", textAlign: "right" }}>{pet.clip_count}</td>
    </tr>
  );
}

function ClipRow({ clip }: { clip: Clip }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-secondary)" }}>#{clip.id}</td>
      <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.85rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {clip.original_filename}
      </td>
      <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "var(--text-secondary)" }}>{clip.detection_count}</td>
      <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "var(--text-secondary)" }}>{clip.track_count}</td>
      <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        {formatDate(clip.capture_at ?? clip.ingested_at)}
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.status(), api.pets(), api.clips(10)])
      .then(([s, p, c]) => { setStatus(s); setPets(p); setClips(c); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
        <strong>Erro ao conectar com a API:</strong> {error}
        <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Verifique se <code style={{ color: "var(--teal)" }}>petmonitor-api</code> está em execução em 127.0.0.1:8000.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>Visão Geral</h1>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <StatCard label="Clipes" value={status?.clips.total ?? 0} />
          <StatCard label="Detecções" value={status?.detections.total ?? 0} />
          <StatCard label="Tracks" value={status?.tracks.total ?? 0} />
          <StatCard label="Versão API" value={status?.version ?? "—"} color="var(--teal)" />
        </div>
      </div>

      {pets.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Pets</h2>
          <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>Nome</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>Tracks</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>Clipes</th>
                </tr>
              </thead>
              <tbody>{pets.map((p) => <PetRow key={p.id} pet={p} />)}</tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Clipes Recentes</h2>
        {clips.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Nenhum clipe ingerido ainda.</p>
        ) : (
          <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  {["#", "Arquivo", "Det.", "Tracks", "Captura"].map((h, i) => (
                    <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: i > 1 && i < 4 ? "right" : "left", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{clips.map((c) => <ClipRow key={c.id} clip={c} />)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
