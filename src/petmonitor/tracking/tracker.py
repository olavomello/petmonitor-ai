"""IoU-based multi-object tracker with majority-vote pet identity resolution."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field


@dataclass
class TrackResult:
    """Final summary of one tracked object in a clip."""

    track_id: int
    clip_id: int
    identity: str        # 'Branca', 'Marrie', or 'Unknown'
    confidence: float    # vote_ratio × avg_detection_confidence
    frame_start: int
    frame_end: int
    pet_id: int | None   # None when identity is Unknown


def _iou(
    ax: float, ay: float, aw: float, ah: float,
    bx: float, by: float, bw: float, bh: float,
) -> float:
    """Intersection-over-Union for two axis-aligned bounding boxes (x,y,w,h)."""
    ix1 = max(ax, bx)
    iy1 = max(ay, by)
    ix2 = min(ax + aw, bx + bw)
    iy2 = min(ay + ah, by + bh)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    inter = (ix2 - ix1) * (iy2 - iy1)
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


@dataclass
class _ActiveTrack:
    track_id: int
    bbox: tuple[float, float, float, float]
    class_votes: Counter = field(default_factory=Counter)
    conf_sum: float = 0.0
    vote_count: int = 0
    frame_start: int = 0
    last_frame: int = 0


class Tracker:
    """IoU-based multi-object tracker.

    Associates detections across frames by greedy IoU matching, then resolves
    each track's pet identity via majority vote over its class detections.
    """

    def __init__(
        self,
        iou_threshold: float = 0.3,
        max_missed: int = 10,
        identity_map: dict[int, tuple[str, int]] | None = None,
        identity_confidence_threshold: float = 0.5,
    ) -> None:
        self._iou_threshold = iou_threshold
        self._max_missed = max_missed
        self._identity_map: dict[int, tuple[str, int]] = identity_map or {}
        self._conf_threshold = identity_confidence_threshold

    @classmethod
    def from_config(cls, cfg: dict) -> "Tracker":
        """Build a Tracker from app.yaml config (reads the ``pets`` list)."""
        pets = cfg.get("pets", [])
        identity_map = {p["class_id"]: (p["name"], p["id"]) for p in pets}
        return cls(identity_map=identity_map)

    def track_clip(self, clip_id: int, detections: list) -> list[TrackResult]:
        """Group per-frame detections into tracks and resolve pet identity.

        Args:
            clip_id: DB clip id written into every TrackResult.
            detections: Any objects with frame_index, pet_class, confidence,
                        bbox_x, bbox_y, bbox_w, bbox_h attributes.

        Returns list of TrackResult, one per closed track (empty if no detections).
        """
        if not detections:
            return []

        frames: dict[int, list] = {}
        for det in detections:
            frames.setdefault(det.frame_index, []).append(det)

        active: list[_ActiveTrack] = []
        closed: list[_ActiveTrack] = []
        next_id = 0

        for frame_idx in sorted(frames):
            # Close tracks whose last-seen frame is too far back (by index gap).
            still_active: list[_ActiveTrack] = []
            for track in active:
                if frame_idx - track.last_frame > self._max_missed:
                    closed.append(track)
                else:
                    still_active.append(track)
            active = still_active

            frame_dets = frames[frame_idx]
            matched_tracks: set[int] = set()
            matched_dets: set[int] = set()

            scores: list[tuple[float, int, int]] = []
            for ti, track in enumerate(active):
                for di, det in enumerate(frame_dets):
                    score = _iou(*track.bbox, det.bbox_x, det.bbox_y, det.bbox_w, det.bbox_h)
                    if score >= self._iou_threshold:
                        scores.append((score, ti, di))
            scores.sort(reverse=True)

            for _, ti, di in scores:
                if ti in matched_tracks or di in matched_dets:
                    continue
                det = frame_dets[di]
                track = active[ti]
                track.bbox = (det.bbox_x, det.bbox_y, det.bbox_w, det.bbox_h)
                track.class_votes[det.pet_class] += 1
                track.conf_sum += det.confidence
                track.vote_count += 1
                track.last_frame = frame_idx
                matched_tracks.add(ti)
                matched_dets.add(di)

            for di, det in enumerate(frame_dets):
                if di not in matched_dets:
                    t = _ActiveTrack(
                        track_id=next_id,
                        bbox=(det.bbox_x, det.bbox_y, det.bbox_w, det.bbox_h),
                        frame_start=frame_idx,
                        last_frame=frame_idx,
                    )
                    t.class_votes[det.pet_class] += 1
                    t.conf_sum += det.confidence
                    t.vote_count += 1
                    active.append(t)
                    next_id += 1

        closed.extend(active)
        return [self._to_result(t, clip_id) for t in closed if t.vote_count > 0]

    def _to_result(self, track: _ActiveTrack, clip_id: int) -> TrackResult:
        if not track.class_votes:
            return TrackResult(
                track_id=track.track_id, clip_id=clip_id,
                identity="Unknown", confidence=0.0,
                frame_start=track.frame_start, frame_end=track.last_frame,
                pet_id=None,
            )
        top_class, top_votes = track.class_votes.most_common(1)[0]
        vote_ratio = top_votes / track.vote_count
        avg_conf = track.conf_sum / track.vote_count
        if top_class in self._identity_map and vote_ratio >= self._conf_threshold:
            name, pet_id = self._identity_map[top_class]
            return TrackResult(
                track_id=track.track_id, clip_id=clip_id,
                identity=name, confidence=round(vote_ratio * avg_conf, 4),
                frame_start=track.frame_start, frame_end=track.last_frame,
                pet_id=pet_id,
            )
        return TrackResult(
            track_id=track.track_id, clip_id=clip_id,
            identity="Unknown", confidence=0.0,
            frame_start=track.frame_start, frame_end=track.last_frame,
            pet_id=None,
        )
