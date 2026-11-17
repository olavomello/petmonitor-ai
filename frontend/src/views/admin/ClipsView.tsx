import { useEffect, useState } from "react";
import { adminApi, type Clip } from "../../api";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ClipsView() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.clips();
      setClips(data as Clip[]);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function triggerSync() {
    setMsg(null);
    try {
      const r = await adminApi.sync();
      setMsg(`Sync iniciado (PID ${r.pid}) — acompanhe o terminal.`);
    } catch (e) {
      setMsg(`Erro: ${e}`);
    }
  }

  async function triggerExtract() {
    setMsg(null);
    try {
      const r = await adminApi.extract();
      setMsg(`Extração iniciada (PID ${r.pid}) — acompanhe o terminal.`);
    } catch (e) {
      setMsg(`Erro: ${e}`);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={triggerSync}
          style={{
            padding: "0.5rem 1.1rem",
            background: "var(--teal)",
            color: "#fff",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Sync agora
        </button>
        <button
          onClick={triggerExtract}
          style={{
            padding: "0.5rem 1.1rem",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Extrair frames
        </button>
        <button
          onClick={load}
          style={{
            padding: "0.5rem 1.1rem",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.9rem",
          }}
        >
          Recarregar
        </button>
      </div>
      {msg && (
        <p
          style={{
            padding: "0.6rem 0.9rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "1rem",
          }}
        >
          {msg}
        </p>
      )}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>#</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Arquivo</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Fonte</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Detecções</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Capturas</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {c.id}
                  </td>
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.original_filename}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>
                    {c.source_type}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{c.detection_count}</td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{c.track_count}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {formatDate(c.capture_at ?? c.ingested_at)}
                  </td>
                </tr>
              ))}
              {clips.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: "1rem", color: "var(--text-muted)", textAlign: "center" }}
                  >
                    Nenhum clip encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
