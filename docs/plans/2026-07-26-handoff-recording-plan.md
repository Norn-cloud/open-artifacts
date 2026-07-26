# Handoff recording mode

## Goal

After an artifact is created, a user with write access clicks **Record** to
capture webcam + mic + in-artifact interactions (mouse moves, clicks, scroll).
The recording is stored and any viewer can click **Play** to replay the full
demonstration: the creator's webcam/mic plays in a corner overlay while a
synthetic cursor, click ripples, and scroll reproduce the walkthrough inside the
artifact.

## Decisions (defaults chosen after the clarifying question timed out)

- **Capture scope: full** - webcam video + mic audio + mouse trajectory + clicks
  + scroll. The record bar offers mic/cam toggles so a user can drop the camera
  for a lighter clip, but the default is both on. (User asked for 音视频 + mouse
  + clicks + scroll explicitly.)
- **Opt-in per deploy** via `OPEN_ARTIFACTS_HANDOFF=1`, mirroring
  `OPEN_ARTIFACTS_WEB_FONTS` and the `LIVE_DO` precedent. Off = no button, handoff
  routes 404, frame carries no handoff shim. coda0 enables with one env var.
- **Recording is write-gated** (`authorizeWrite` = write-token / `canManage`),
  matching "after creating the artifact" and bounding R2 abuse on public
  instances. Playback is view-gated (`authorizeView`), like reading the artifact.
- **Replay is visual-only** - a synthetic cursor + click ripples + scroll driven
  by the recorded event stream, with the webcam `<video>` in a corner overlay. No
  real DOM events are dispatched, so replay can never navigate away or trigger
  destructive actions. This is the Loom / rrweb model.

## The hard constraint (already verified against the code)

The artifact frame is `sandbox="allow-scripts ..."` with an **opaque origin** and
CSP `default-src 'none'; connect-src 'none'`. The host page (`/a/:id`) is
normal-origin with `connect-src 'self'; media-src data: blob:`. Consequences:

- **Webcam/mic must run in the host** - `getUserMedia`/`MediaRecorder` need a
  secure context and the host is the normal-origin doc. The sandboxed frame
  cannot call them.
- **In-artifact mouse/click/scroll must run in the frame** - the host cannot
  reach the opaque-origin frame's DOM. The frame captures its own events and
  `postMessage`s them out. This is exactly the `FRAME_LIVE_PICKER_SCRIPT`
  pattern.
- **Playback video plays in the host** - host `fetch`es the media from the
  same-origin route (allowed by `connect-src 'self'`), makes a `blob:` URL, and
  sets it on a `<video>` overlay (allowed by `media-src data: blob:`). The events
  JSON is fetched by the host and `postMessage`d into the frame, which draws the
  cursor/ripples/scroll. The frame never fetches (`connect-src 'none'`).
- **No CSP change is required** on either the host or the frame. All new shims
  are nonce'd inline scripts; postMessage is not a fetch and is not CSP-gated.

## Data model

### D1 (store.ts - SCHEMA + MIGRATIONS, idempotent `IF NOT EXISTS`)

```sql
CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL,          -- artifact version the recording was made against
  duration_ms INTEGER NOT NULL,
  media_type TEXT NOT NULL,          -- e.g. "video/webm"
  media_size INTEGER NOT NULL,
  events_size INTEGER NOT NULL,
  has_video INTEGER NOT NULL DEFAULT 1,
  has_audio INTEGER NOT NULL DEFAULT 1,
  author TEXT,
  delete_token_hash TEXT,            -- recorder can delete their own (comment idiom)
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_handoffs_artifact_created
  ON handoffs(artifact_id, created_at);
```

### R2 (CONTENT bucket)

- `handoff/${artifactId}/${recordingId}/media` - the WebM/MP4 blob
- `handoff/${artifactId}/${recordingId}/events` - the JSON event stream

`store.delete(id)` is extended to sweep the `handoff/${id}/` R2 prefix and
`DELETE FROM handoffs WHERE artifact_id = ?`, the same way it sweeps
`content/${id}/` and comments today.

### Domain types (domain.ts)

`HandoffMeta` (id, artifactId, version, durationMs, mediaType, hasVideo,
hasAudio, author, createdAt) and `HandoffCreateInput`. No encryption surface -
handoffs are plain media (the artifact body is what may be encrypted; a handoff
is a walkthrough of a viewed artifact, not secret content).

### ArtifactStore interface (store.ts)

`listHandoffs`, `createHandoff`, `getHandoff`, `getHandoffMedia`,
`getHandoffEvents`, `deleteHandoff`. Interface lives in the consuming layer
alongside `D1R2Store` (matches the existing comment-method placement).

## API (new `src/handoff-api.ts`, mounted in app.ts like `liveApi`)

Every route 404s when `!handoffEnabled(c)`. Auth: `authorizeView` for reads,
`authorizeWrite` for create + owner-delete; author-delete via the handoff's
`delete_token_hash` (the comment idiom).

- `GET  /api/artifacts/:id/handoffs` -> `{ handoffs: HandoffMeta[] }` (view)
- `POST /api/artifacts/:id/handoffs` -> multipart (`media` blob, `events` JSON,
  `meta` JSON: durationMs/hasVideo/hasAudio/author/version). Returns
  `{ id, deleteToken }` 201. (write) Declared-body cap 64 MiB -> 413 over.
- `GET  /api/artifacts/:id/handoffs/:hid/media` -> media bytes, correct
  `content-type`, `cache-control: public, max-age=3600`, nosniff. (view)
- `GET  /api/artifacts/:id/handoffs/:hid/events` -> events JSON. (view)
- `DELETE /api/artifacts/:id/handoffs/:hid` -> author delete-token OR owner
  write-token; else 403. Sweeps R2 + D1.

Multipart via `c.req.parseBody()`; `R2Bucket.put(key, file, {customMetadata})`.
Client enforces a 10-minute / ~64 MiB ceiling (stops MediaRecorder at the limit).

`Bindings` (api.ts) gains `OPEN_ARTIFACTS_HANDOFF?: string`. Helpers
`handoffEnabled`, `handoffMediaUrl`, `handoffEventsUrl` mirror `liveWsUrl`.

## Viewer chrome (wrap.ts - mirrors the Live toggle)

- `headerHtml` gains `handoffEnabled`; renders a Handoff (record) glyph button
  beside the Live/comments toggles. Tokens-only, both themes, visible focus ring,
  keyboard-first - per PRODUCT.md / tokens.css.
- `hostShell` gains `handoffEnabled` + `handoffs: HandoffMeta[]`. The list is
  **inlined at serve time** as `<script type="application/json" id="oa-handoff-data">`
  (the comments/version-picker pattern) so the play UI knows what exists without
  a round-trip.
- New `HANDOFF_CSS`, `HANDOFF_RECORD_SCRIPT` (host), `HANDOFF_PLAY_SCRIPT`
  (host), `FRAME_HANDOFF_RECORD_SCRIPT` (frame), `FRAME_HANDOFF_PLAY_SCRIPT`
  (frame), and a record glyph SVG.
- `frameDocument` gains `handoffEnabled?: boolean`. When true it injects the
  record + play frame shims - **inert until armed via postMessage**, exactly as
  `FRAME_LIVE_PICKER_SCRIPT` is always present and unarmed. No frame reload is
  needed to enter record or play mode; the host arms/disarms over the bridge.

### Record flow

1. Host: Record click -> `getUserMedia({video, audio})` (toggles honored) ->
   `MediaRecorder` on the combined stream; show a small record bar (timer,
   stop, cancel) and a webcam preview (`video.srcObject = stream`).
2. Host: `__oaToFrame({type:"oa:handoff:record:arm"})` -> frame starts listening.
3. Frame: throttled (rAF) `mousemove`, `click`, `scroll`, `resize` ->
   `__oaSend({type:"oa:handoff:event", t, kind, x, y, sx, sy})` where `t` is ms
   since arm. Coordinates are `clientX/clientY` + `scrollX/scrollY` in the frame
   document.
4. Host buffers events; on Stop, stops MediaRecorder, assembles one Blob, POSTs
   multipart (`media` + `events` JSON + `meta`), then disarms the frame and
   reloads it to exit record mode.

### Play flow

1. Host: Play click (handoff list inlined at serve time) -> fetch
   `/api/.../handoffs/:hid/media` -> `blob:` URL -> corner `<video>` overlay;
   fetch `/api/.../handoffs/:hid/events`.
2. Host pins the frame to the recorded version (`frame.src =
   /a/:id/frame?v=<handoff.version>`) so layout matches the captured coords,
   waits for load, then `__oaToFrame({type:"oa:handoff:play", events,
   durationMs})` and `video.play()` in the same tick (shared t=0).
3. Frame play shim: rAF clock from t=0; draws a cursor `<div>` at each
   `mousemove` point, a ripple at each `click`, and `window.scrollTo` on scroll
   events. `oa:handoff:stop` clears the overlay.
4. Host controls: play/pause, scrub (sends `oa:handoff:seek`), exit. Drift
   between video and event clock is acceptable for v1 (both start at t=0; scrub
   re-bases both).

## BDD (CLAUDE.md: feature -> RED -> GREEN -> REFACTOR)

`tests/features/handoff.feature` scenarios:
1. No `OPEN_ARTIFACTS_HANDOFF`: no button, routes 404, frame has no handoff shim.
2. Flag on: button renders, frame carries the (inert) shim.
3. POST requires write auth (no token -> 401/403).
4. POST multipart stores media+events in R2 + metadata in D1, returns
   `{id, deleteToken}`.
5. GET list / GET media (right MIME) / GET events round-trip.
6. Media/events routes are view-gated (unauthorized -> 404, matching /raw).
7. DELETE by author delete-token OR owner write-token; 403 otherwise.
8. Deleting the artifact sweeps its handoffs (R2 + D1).

`tests/worker/handoff.test.ts` mirrors `live.test.ts`. Browser-only surfaces
(`getUserMedia`/`MediaRecorder`) are tested **structurally** (script-tag
presence, bridge message names), the way Live tests assert the picker script
exists without exercising a real pick. Both opt-in and opt-out paths are covered
by passing a custom env via `app.fetch(req, env, ctx)` (the
branding/authorizer/api test pattern).

## Files

- `src/domain.ts` - `HandoffMeta`, `HandoffCreateInput`.
- `src/store.ts` - `handoffs` schema/migrations, `ArtifactStore` methods,
  `D1R2Store` impls, extend `delete()`.
- `src/handoff-api.ts` (new) - routes; mounted in `app.ts`.
- `src/api.ts` - `OPEN_ARTIFACTS_HANDOFF` binding, `handoffEnabled` + URL helpers.
- `src/app.ts` - mount `handoffApi`; pass `handoffEnabled` + inlined `handoffs`
  to `hostShell`; pass `handoffEnabled` to `frameDocument` via the frame route.
- `src/wrap.ts` - header button, host record/play scripts + CSS, frame record/play
  shims, record glyph.
- `tests/features/handoff.feature` (new), `tests/worker/handoff.test.ts` (new).
- `wrangler.jsonc` - add `OPEN_ARTIFACTS_HANDOFF: "1"` to `vars` (this deploy is
  coda0-leaning and already sets `OPEN_ARTIFACTS_WEB_FONTS: "1"`), with a comment
  that self-hosters omit it.

## Out of scope (v1)

Live fan-out of new recordings to already-open viewers (Phase 2, like comments);
trimming/editing; transcription/captions; real-click replay; mobile-specific
camera UI (works, just desktop-first).

## Verification

`pnpm typecheck` (both tsconfigs), `pnpm test` (worker), `pnpm check` (biome);
then `/code-review` + a fresh no-context agent audit per CLAUDE.md.
