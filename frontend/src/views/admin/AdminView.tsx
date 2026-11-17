import { useState } from "react";
import DatasetView from "./DatasetView";
import ClipsView from "./ClipsView";
import TrainingView from "./TrainingView";

type Tab = "dataset" | "clips" | "training";

const TABS: { id: Tab; label: string }[] = [
  { id: "dataset", label: "Dataset" },
  { id: "clips", label: "Clips & Sync" },
  { id: "training", label: "Treinamento" },
];

export default function AdminView() {
  const [tab, setTab] = useState<Tab>("dataset");

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0.25rem",
          gap: "0.2rem",
          marginBottom: "1.5rem",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            style={{
              padding: "0.4rem 1.1rem",
              borderRadius: "var(--radius-sm)",
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
              background: tab === t.id ? "var(--bg-surface)" : "transparent",
              fontSize: "0.88rem",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dataset" && <DatasetView />}
      {tab === "clips" && <ClipsView />}
      {tab === "training" && <TrainingView />}
    </div>
  );
}
