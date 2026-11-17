const BASE = "/api/v1";

export interface Frame {
  id: number;
  clip_id: number;
  frame_index: number;
  file_path: string;
  status: "pending" | "keep" | "discard" | "labeled";
  split: "train" | "val" | "test" | null;
  created_at: string;
}

export interface FrameStats {
  total: number;
  pending?: number;
  keep?: number;
  discard?: number;
  labeled?: number;
}

export interface FramesResponse {
  frames: Frame[];
  total: number;
}

export interface BBox {
  class_id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface LabelsResponse {
  labels: BBox[];
}

export interface TrainingRun {
  name: string;
  has_best_weights: boolean;
  has_metrics: boolean;
  last_epoch?: Record<string, string>;
}

export interface StatusResponse {
  version: string;
  clips: { total: number };
  detections: { total: number };
  tracks: { total: number };
  blink_connected?: boolean;
}

export interface BlinkStatus {
  status: "not_configured" | "configured" | "file_invalid";
  has_pending_2fa: boolean;
}

export interface PipelineResult {
  status: string;
  pid?: number;
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

async function apiFetch<T>(
  method: string,
  path: string,
  options?: { body?: unknown; params?: Record<string, string | number> },
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const { body } = options ?? {};
  const res = await fetch(url.toString(), {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  return apiFetch<T>("GET", path, { params });
}

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(method, path, { body });
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
  blinkStatus: () => get<BlinkStatus>("/blink/status"),
  blinkAuthStart: (email: string, password: string) =>
    request<{ status: string }>("POST", "/blink/auth/start", { email, password }),
  blinkAuthVerify: (code: string) =>
    request<{ status: string }>("POST", "/blink/auth/verify", { code }),
  clipThumbnailUrl: (clipId: number) => `${BASE}/clips/${clipId}/thumbnail`,
  clipVideoUrl: (clipId: number) => `${BASE}/clips/${clipId}/video`,
};

export const adminApi = {
  frames: (limit = 100, offset = 0, status?: string) =>
    get<FramesResponse>("/admin/frames", {
      limit,
      offset,
      ...(status ? { status } : {}),
    }),
  frameStats: () => get<FrameStats>("/admin/frames/stats"),
  scanFrames: () => request<{ registered: number; total: number }>("POST", "/admin/frames/scan"),
  updateFrame: (id: number, status: string) =>
    request<Frame>("PATCH", `/admin/frames/${id}`, { status }),
  splitDataset: (train_ratio = 0.8, seed = 42) =>
    request<{ message: string; ok: boolean }>("POST", `/admin/dataset/split?train_ratio=${train_ratio}&seed=${seed}`),
  frameLabels: (id: number) => get<LabelsResponse>(`/admin/frames/${id}/labels`),
  saveFrameLabels: (id: number, labels: BBox[]) =>
    request<Frame>("POST", `/admin/frames/${id}/labels`, { labels }),
  clips: (limit = 50, offset = 0) => get<Clip[]>("/admin/clips", { limit, offset }),
  sync: () => request<PipelineResult>("POST", "/admin/sync"),
  extract: () => request<PipelineResult>("POST", "/admin/extract"),
  detect: () => request<PipelineResult>("POST", "/admin/detect"),
  track: () => request<PipelineResult>("POST", "/admin/track"),
  analyse: () => request<PipelineResult>("POST", "/admin/analyse"),
  runs: () => get<TrainingRun[]>("/admin/runs"),
  train: () => request<PipelineResult>("POST", "/admin/train"),
  bulkUpdateFrames: (ids: number[], status: string) =>
    request<{ updated: number; frames: Frame[] }>("POST", "/admin/frames/bulk-status", { ids, status }),
};
