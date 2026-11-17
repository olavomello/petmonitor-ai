import { useEffect, useState } from "react";
import { api, type ActivityEvent, type ActivityResponse, type Pet } from "../api";

const STATE_COLORS: Record<string, string> = {
  moving: "var(--moving)",
  stationary: "var(--stationary)",
  not_visible: "var(--not-visible)",
  unknown: "var(--text-muted)",
};

const STATE_LABELS: Record<string, string> = {
  moving: "Em movimento",
  stationary: "Parado",
  not_visible: "Não visível",
  unknown: "Desconhecido",
};

function Badge({ state }: { state: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "0.2rem 0.5rem",
      borderRadius: 4,
      fontSize: "0.75rem",
      fontWeight: 600,
      color: STATE_COLORS[state] ?? "var(--text-muted)",
      background: `${STATE_COLORS[state] ?? "var(--text-muted)"}22`,
    }}>
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

function SummaryBar({ summary }: { summary: Record<string, Record<string, number>> }) {
  if (Object.keys(summary).length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Object.entries(summary).map(([identity, counts]) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return (
          <div key={identity} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{identity}</div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {Object.entries(counts).map(([state, count]) => (
                <div key={state} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: STATE_COLORS[state] }}>{count}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{STATE_LABELS[state] ?? state}</span>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-secondary)" }}>{total}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>total</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Activity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.pets().then(setPets).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.activity(selected || undefined)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Atividade</h1>
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
          <option value="">Todos os pets</option>
          {pets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)" }}>Carregando…</p>}

      {!loading && data && (
        <>
          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Resumo</h2>
            {Object.keys(data.summary).length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Nenhum evento processado ainda.</p>
              : <SummaryBar summary={data.summary} />
            }
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>{data.note}</p>
          </section>

          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Eventos <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({data.events.length})</span>
            </h2>
            {data.events.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Sem eventos para exibir.</p>
              : (
                <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-surface)" }}>
                        {["Clipe", "Track", "Pet", "Estado", "Frames"].map((h) => (
                          <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((ev: ActivityEvent) => (
                        <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>#{ev.clip_id}</td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>{ev.track_id}</td>
                          <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>{ev.identity}</td>
                          <td style={{ padding: "0.6rem 0.75rem" }}><Badge state={ev.state} /></td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>{ev.frame_start}–{ev.frame_end}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </section>
        </>
      )}
    </div>
  );
}
