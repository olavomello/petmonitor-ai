"""Activity state classification, trajectory extraction and heatmap generation.

Activity states (four canonical values — no ad-hoc extensions without an ADR):
  moving      — pet's bounding box center displaced > threshold between first and last detection.
  stationary  — pet detected but center displacement ≤ threshold.
  not_visible — no detections for a known pet in a clip.
  unknown     — clip not yet processed.

Observed-duration denominators are ALWAYS stated as "X frames of processed footage", never
claimed as calendar time, so as not to overstate actual monitoring coverage.
"""

from __future__ import annotations

import math

STATE_MOVING = "moving"
STATE_STATIONARY = "stationary"
STATE_NOT_VISIBLE = "not_visible"
STATE_UNKNOWN = "unknown"

_DEFAULT_MOVEMENT_THRESHOLD_PX = 30.0
_HEATMAP_GRID_W = 50
_HEATMAP_GRID_H = 50


def classify_track_state(
    detections: list[dict],
    movement_threshold_px: float = _DEFAULT_MOVEMENT_THRESHOLD_PX,
) -> str:
    """Return 'moving' or 'stationary' based on bbox center displacement.

    Uses the displacement of the bbox center from the FIRST to the LAST
    detection in the track, not individual frame steps.
    """
    if len(detections) < 2:
        return STATE_STATIONARY

    first = detections[0]
    last = detections[-1]
    dx = (last["bbox_x"] + last["bbox_w"] / 2) - (first["bbox_x"] + first["bbox_w"] / 2)
    dy = (last["bbox_y"] + last["bbox_h"] / 2) - (first["bbox_y"] + first["bbox_h"] / 2)
    return STATE_MOVING if math.hypot(dx, dy) >= movement_threshold_px else STATE_STATIONARY


def extract_trajectory(detections: list[dict]) -> list[dict]:
    """Return bottom-center ground points for each detection.

    The ground point is the bottom-centre of the bounding box — the best
    proxy for the animal's position on the floor plane.  Values are raw
    pixel coordinates; normalisation requires frame dimensions, which are
    not stored and must be supplied by the caller when needed.
    """
    return [
        {
            "frame_index": d["frame_index"],
            "x_px": d["bbox_x"] + d["bbox_w"] / 2.0,
            "y_px": d["bbox_y"] + d["bbox_h"],
        }
        for d in detections
    ]


def compute_heatmap(
    trajectory_points: list[dict],
    grid_w: int = _HEATMAP_GRID_W,
    grid_h: int = _HEATMAP_GRID_H,
) -> list[list[int]]:
    """Accumulate trajectory points into a 2-D density grid.

    Returns a list-of-lists grid[row][col] where each cell counts how many
    ground-point samples landed there.  The grid is normalised to the data's
    bounding box, so it adapts to any frame size.
    """
    grid = [[0] * grid_w for _ in range(grid_h)]
    if not trajectory_points:
        return grid

    xs = [p["x_px"] for p in trajectory_points]
    ys = [p["y_px"] for p in trajectory_points]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    x_range = max(x_max - x_min, 1.0)
    y_range = max(y_max - y_min, 1.0)

    for p in trajectory_points:
        col = min(int((p["x_px"] - x_min) / x_range * grid_w), grid_w - 1)
        row = min(int((p["y_px"] - y_min) / y_range * grid_h), grid_h - 1)
        grid[row][col] += 1

    return grid


def get_activity_summary(events: list[dict]) -> dict:
    """Aggregate activity event counts by identity and state.

    Returns {identity: {state: count}} for each identity that has events.
    Counts reflect individual track events, not calendar time — the caller
    must note the denominator ("X track events from N clips of footage").
    """
    summary: dict[str, dict[str, int]] = {}
    for ev in events:
        identity = ev["identity"]
        state = ev["state"]
        if identity not in summary:
            summary[identity] = {
                STATE_MOVING: 0,
                STATE_STATIONARY: 0,
                STATE_NOT_VISIBLE: 0,
            }
        summary[identity][state] = summary[identity].get(state, 0) + 1
    return summary
