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
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.25rem",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "var(--teal)" : "var(--text-secondary)",
              background: tab === t.id ? "var(--bg-surface)" : "transparent",
              borderBottom: tab === t.id ? "2px solid var(--teal)" : "2px solid transparent",
              marginBottom: -1,
              fontSize: "0.9rem",
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
