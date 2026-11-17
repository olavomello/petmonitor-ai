import { useState } from "react";
import NavBar from "./components/NavBar";
import Dashboard from "./views/Dashboard";
import Activity from "./views/Activity";
import HeatmapView from "./views/HeatmapView";

type View = "dashboard" | "activity" | "heatmap";

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <NavBar active={view} onNavigate={setView} />
      <main style={{ flex: 1, padding: "1rem", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {view === "dashboard" && <Dashboard />}
        {view === "activity" && <Activity />}
        {view === "heatmap" && <HeatmapView />}
      </main>
    </div>
  );
}
