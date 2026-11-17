# 6. Generic user-defined pet identity

## Status

Accepted

## Context

Pet identity is currently coupled to a per-household custom-trained YOLO model.
Identity is read off custom detector classes (`0=Branca`, `1=Marrie`) declared in
`configs/app.yaml`, and the tracker resolves identity by class lookup in
`tracker._to_result`. This hardcodes a single household into the pipeline and has
two structural problems:

- **It does not scale.** Every new household (a different set of pets, different
  names, a different count per species) requires collecting a labeled dataset and
  retraining the detector. A user cannot simply describe their pets and start.
- **It conflates detection with identity.** A general dog/cat detector already
  exists in COCO (class 16 = dog, 15 = cat). Training custom classes to encode
  *which* dog only to recover a name is wasted effort and couples two concerns
  that should be separate: "is this a dog or a cat?" (detection) and "which of my
  pets is it?" (identity).

We want any household to work out of the box: one dog, one dog plus two cats, and
so on, with identity driven by user-entered data plus reference photos rather than
by a retrained model.

## Decision

Replace class-based identity with **generic COCO detection (dog/cat) plus a
per-household appearance re-identification (re-ID) step**, and make pets
user-defined data rather than model classes.

1. **Data model.** Introduce two tables:
   - `pets(id, name, species CHECK(dog|cat), color, breed, notes, active,
     trained_override, created_at, updated_at)` — the user's declared pets, with
     a nullable `trained_override` for the optional per-pet trained model.
   - `pet_references(id, pet_id FK CASCADE, image_path, embedding BLOB,
     embedding_model, source CHECK(upload|auto_crop), created_at)` — a reference
     image gallery per pet, with a cached appearance embedding.

   A one-time, idempotent migration seeds `pets` from the existing `app.yaml`
   `pets` list when the table is empty. `tracks.pet_id` and
   `activity_events.pet_id` are unchanged and keep working once the resolver
   returns the new `pets.id`.

2. **Tiered identity resolver**, replacing the class lookup in the tracker:
   - **Tier 0 — species.** Map COCO class to species (16 -> dog, 15 -> cat). No
     candidate species -> `Unknown`.
   - **Tier 1 — unique species.** Exactly one active pet of that species in the
     household -> assign directly, no embedding needed.
   - **Tier 2 — appearance re-ID.** Two or more pets share the species -> embed
     3-5 representative crops of the track, L2-normalise the mean, and take the
     max cosine similarity over the pet's reference embeddings. Accept only when
     `score >= 0.62` **and** `(best - second) >= 0.08` margin; otherwise
     `Unknown`. These defaults are configuration-tunable; final values are tuned
     against a small labeled multi-pet validation set built as a parallel task
     (implementation is not blocked on it).
   - **Trained override (precedence over tiers).** A pet may carry an optional
     trained-model override. When present, it takes precedence over the tiered
     species/embedding path; otherwise the tiers above apply. This keeps the
     precision of a custom-trained model available per pet without forcing a
     retrain on any household.

3. **Embedding backbone.** A CPU-friendly backbone (MobileNetV3-small or ResNet18,
   exported to ONNX), producing L2-normalised embeddings cached in
   `pet_references.embedding`.

4. **Detector.** Revert to generic COCO weights for dog/cat detection; species —
   not a hardcoded class filter — drives `filter_classes` dynamically. The
   detector also supports a per-pet trained-override path for pets that carry one.

5. **Settings UI.** A new `/settings` -> "Pets" screen for pet CRUD plus
   reference-image upload. Archiving is a soft delete (`active=0`) so historical
   tracks stay valid. API surface: `GET/POST/PUT/DELETE /pets`,
   `POST /pets/{id}/references`, `DELETE /references/{id}`.

### Resolved decisions

- **Trained override:** hybrid, not embedding-only. A pet may have an optional
  trained-model override; the resolver uses it when present and otherwise falls
  back to the tiered species/embedding re-ID. A nullable override column is added
  to `pets` and the detector path supports it.
- **Gallery limit and retention:** maximum 10 reference images per pet; kept while
  the pet is active and cascade-deleted with the pet (already in the DDL). The 10
  cap is enforced in both the API and the UI.
- **Thresholds:** build now with defaults `score >= 0.62` and `margin >= 0.08`,
  exposed as configuration. A small labeled multi-pet validation set is created as
  a parallel task; final tuning happens once it exists. Implementation is not
  blocked on it.

## Consequences

**Easier:**
- Any household works without collecting data or retraining a model; onboarding
  becomes "describe your pets and upload a few photos".
- Detection and identity are decoupled; the detector is a stable, generic COCO
  model shared by every user.
- Adding, renaming, or archiving a pet is a data operation, not an ML operation.

**More difficult / new costs:**
- A new appearance-embedding component and its CPU inference path must be built,
  validated, and kept reproducible.
- Re-ID introduces a tunable accuracy/abstention trade-off; distinguishing
  same-species pets depends on reference-photo quality and threshold tuning.
- New storage and retention concerns for the user-uploaded reference gallery.
- A single-household deployment that previously relied on a custom-trained model
  gives up that model's precision unless the per-pet trained-override path (open
  question) is retained.

The change is additive and backward-compatible at the storage layer
(`CREATE TABLE IF NOT EXISTS`, existing `pet_id` columns unchanged), so
version impact is a MINOR, non-breaking capability.
