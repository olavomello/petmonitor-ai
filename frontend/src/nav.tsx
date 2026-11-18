export type View = "dashboard" | "activity" | "events" | "trajectories" | "heatmap" | "camera" | "admin" | "settings";

export type NavItem = {
  id: View | null;
  label: string;
  iconKey: keyof typeof NavIcons;
  available: boolean;
};

export const NavIcons = {
  dashboard: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  activity: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="8" width="3" height="6.5" rx="0.75" fill="currentColor" opacity="0.7" />
      <rect x="6.5" y="4" width="3" height="10.5" rx="0.75" fill="currentColor" opacity="0.85" />
      <rect x="11.5" y="1.5" width="3" height="13" rx="0.75" fill="currentColor" />
    </svg>
  ),
  events: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5a4 4 0 00-4 4v4l-1.5 2h11L12 9.5v-4a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  trajectories: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="3.5" cy="12.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="3.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 11L11 5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 2" />
    </svg>
  ),
  heatmap: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 1v14M11 1v14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  camera: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 7.5l4-2.5v6L11 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  models: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.1 4.1L6.5 6.5M9.5 6.5L11.9 4.1M4.1 11.9L6.5 9.5M9.5 9.5L11.9 11.9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  settings: (size: number) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.24 1.24M11.36 11.36l1.24 1.24M3.4 12.6l1.24-1.24M11.36 4.64l1.24-1.24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

export const NAV_SIDEBAR: NavItem[] = [
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard", available: true },
  { id: "activity", label: "Activities", iconKey: "activity", available: true },
  { id: "events", label: "Events", iconKey: "events", available: true },
  { id: "trajectories", label: "Trajectories", iconKey: "trajectories", available: true },
  { id: "heatmap", label: "Heatmap", iconKey: "heatmap", available: true },
  { id: "camera", label: "Camera", iconKey: "camera", available: true },
  { id: "admin", label: "AI Models", iconKey: "models", available: true },
  { id: "settings", label: "Settings", iconKey: "settings", available: true },
];

export const NAV_BOTTOM: NavItem[] = [
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard", available: true },
  { id: "activity", label: "Activities", iconKey: "activity", available: true },
  { id: "events", label: "Events", iconKey: "events", available: true },
  { id: "camera", label: "Camera", iconKey: "camera", available: true },
  { id: "admin", label: "Models", iconKey: "models", available: true },
];
