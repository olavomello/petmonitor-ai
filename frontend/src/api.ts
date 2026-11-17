const BASE = "/api/v1";

export interface StatusResponse {
  version: string;
  clips: { total: number };
  detections: { total: number };
  tracks: { total: number };
}

export interface Clip {
  id: number;
  sha256: string;
  local_path: string;
  source_type: string;
  original_filename: string;
  capture_at: string | null;
  ingested_at: string;
  detection_count: number;
  track_count: number;
}

export interface Pet {
  id: number;
  name: string;
  class_id: number;
  track_count: number;
  clip_count: number;
}

export interface ActivityEvent {
  id: number;
  clip_id: number;
  track_id: number;
  identity: string;
  state: "moving" | "stationary" | "not_visible" | "unknown";
  frame_start: number;
  frame_end: number;
}

export interface ActivityResponse {
  events: ActivityEvent[];
  summary: Record<string, Record<string, number>>;
  note: string;
}

export interface HeatmapResponse {
  identity: string;
  grid_w: number;
  grid_h: number;
  point_count: number;
  grid: number[][];
  note: string;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => get<StatusResponse>("/status"),
  clips: (limit = 50, offset = 0) => get<Clip[]>("/clips", { limit, offset }),
  clip: (id: number) => get<Clip>(`/clips/${id}`),
  pets: () => get<Pet[]>("/pets"),
  activity: (identity?: string) =>
    get<ActivityResponse>("/activity", identity ? { identity } : undefined),
  heatmap: (identity: string, grid_w = 50, grid_h = 50) =>
    get<HeatmapResponse>(`/heatmap/${encodeURIComponent(identity)}`, { grid_w, grid_h }),
};
