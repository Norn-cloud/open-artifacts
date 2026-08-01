import type { Context } from "hono";
import { Hono } from "hono";
import { type AppContext, authorizeWrite, bearerToken, storeFrom } from "./api";
import type { Visibility } from "./authorizer";
import { contentByteLength } from "./domain";
import type { ArtifactRecord } from "./store";
import { generateWriteToken, sha256Hex, timingSafeEqual } from "./tokens";

// Handoff recording routes. All 404 when the deploy did not set
// OPEN_ARTIFACTS_HANDOFF=1 - the engine stays usable without it.
//
//   GET    /api/artifacts/:id/handoffs              list (view auth)
//   POST   /api/artifacts/:id/handoffs              create (write auth, multipart)
//   GET    /api/artifacts/:id/handoffs/:hid/media   stream media (view auth)
//   GET    /api/artifacts/:id/handoffs/:hid/events  events JSON (view auth)
//   DELETE /api/artifacts/:id/handoffs/:hid         author delete-token OR owner
//
// Auth mirrors comments: reads are view-gated (collapse to 404 so a private
// artifact's handoffs cannot be probed); create + owner-delete are write-gated;
// author-delete uses the handoff's own delete token (returned once at create).

export const handoffApi = new Hono<AppContext>();

function handoffEnabled(c: Context<AppContext>): boolean {
  return c.env.OPEN_ARTIFACTS_HANDOFF === "1";
}

// 64 MiB media ceiling - bounds R2 abuse on a public instance. The client also
// stops MediaRecorder at this threshold. events JSON is capped separately so a
// runaway client cannot bypass the media cap with a giant events blob.
const MAX_HANDOFF_MEDIA_BYTES = 64 * 1024 * 1024;
const MAX_HANDOFF_EVENTS_BYTES = 8 * 1024 * 1024;
const MAX_HANDOFF_AUTHOR_LENGTH = 200;
const MAX_HANDOFF_DURATION_MS = 24 * 60 * 60 * 1000;

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stableMediaType(type: string): string {
  const base = type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return /^(?:video|audio)\/[a-z0-9!#$&^_.+-]+$/i.test(base)
    ? base
    : "application/octet-stream";
}

// View auth that collapses missing + denied to the same null, matching /raw and
// the live routes: a private artifact's handoff existence is never confirmed.
// Returns the record on success so callers can branch cache policy on visibility.
async function viewAuthRecord(
  c: Context<AppContext>,
  id: string,
): Promise<ArtifactRecord | null> {
  const store = storeFrom(c);
  const record = await store.get(id);
  if (record === null) return null;
  if (!(await c.get("authorizer").authorizeView(c, record))) return null;
  return record;
}

// media/events are cacheable only for public artifacts; a private/org artifact's
// handoff must never sit in a shared cache (no Vary: Cookie on a Worker). Mirror
// /raw's no-cache for the non-public case. CSP default-src 'none' so a direct
// navigation to the media URL cannot run scripts in the origin even if the
// create-time allowlist was bypassed - the artifact body is sandboxed for the
// same reason, and handoff media must not undo it.
function readHeaders(visibility: Visibility): Record<string, string> {
  const cacheControl =
    visibility === "public"
      ? "public, max-age=3600"
      : "private, no-cache, no-store";
  return {
    "cache-control": cacheControl,
    "content-security-policy": "default-src 'none'",
    "x-content-type-options": "nosniff",
  };
}

handoffApi.get("/artifacts/:id/handoffs", async (c) => {
  if (!handoffEnabled(c)) return c.text("not found", 404);
  const record = await viewAuthRecord(c, c.req.param("id"));
  if (!record) return c.text("not found", 404);
  const store = storeFrom(c);
  const handoffs = await store.listHandoffs(record.id);
  return c.json({ handoffs });
});

handoffApi.post("/artifacts/:id/handoffs", async (c) => {
  if (!handoffEnabled(c)) return c.text("not found", 404);
  const store = storeFrom(c);
  const id = c.req.param("id");
  const auth = await authorizeWrite(c, store, id);
  if (!auth.ok) return auth.response;

  const declaredLength = Number(c.req.header("content-length") ?? "0");
  if (declaredLength > MAX_HANDOFF_MEDIA_BYTES + 64 * 1024) {
    return c.json({ error: "request body too large" }, 413);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "request body must be multipart/form-data" }, 400);
  }

  const media = form.get("media");
  if (!(media instanceof File)) {
    return c.json({ error: "media file is required" }, 400);
  }
  if (media.size === 0) {
    return c.json({ error: "media file is empty" }, 400);
  }
  if (media.size > MAX_HANDOFF_MEDIA_BYTES) {
    return c.json({ error: "media exceeds the 64 MiB limit" }, 413);
  }

  const eventsRaw = form.get("events");
  if (typeof eventsRaw !== "string") {
    return c.json({ error: "events JSON is required" }, 400);
  }
  if (contentByteLength(eventsRaw) > MAX_HANDOFF_EVENTS_BYTES) {
    return c.json({ error: "events exceeds the 8 MiB limit" }, 413);
  }
  if (!Array.isArray(tryParseJson(eventsRaw))) {
    return c.json({ error: "events must be a JSON array" }, 400);
  }

  const metaRaw = form.get("meta");
  const meta = typeof metaRaw === "string" ? tryParseJson(metaRaw) : null;
  if (meta === null || typeof meta !== "object") {
    return c.json({ error: "meta JSON is required" }, 400);
  }
  const m = meta as Record<string, unknown>;
  const version =
    typeof m.version === "number" &&
    Number.isInteger(m.version) &&
    m.version >= 1
      ? Math.min(m.version, auth.record.currentVersion)
      : auth.record.currentVersion;
  const durationMs =
    typeof m.durationMs === "number" && m.durationMs >= 0
      ? Math.min(m.durationMs, MAX_HANDOFF_DURATION_MS)
      : 0;
  const hasVideo = m.hasVideo !== false;
  const hasAudio = m.hasAudio !== false;
  const hasBlur = m.hasBlur === true;
  const author =
    typeof m.author === "string"
      ? m.author.slice(0, MAX_HANDOFF_AUTHOR_LENGTH)
      : null;
  // Store a stable base type rather than MediaRecorder's codec parameter.
  // Unquoted comma-separated codecs are truncated by Fetch when the response
  // becomes a Blob, which can make Chromium reject an otherwise valid WebM.
  // The allowlist also prevents script-bearing same-origin media responses.
  const mediaType = stableMediaType(media.type);

  // One-handoff-per-artifact is enforced at the store layer: createHandoff
  // derives a stable id from the artifact id and UPSERTs in place, so a
  // re-record overwrites the same D1 row + R2 keys (no list/delete window, no
  // race between concurrent POSTs).
  const deleteToken = generateWriteToken();
  const handoff = await store.createHandoff(
    auth.record.id,
    { version, durationMs, mediaType, hasVideo, hasAudio, hasBlur, author },
    { body: media, size: media.size },
    { json: eventsRaw, size: contentByteLength(eventsRaw) },
    await sha256Hex(deleteToken),
  );
  return c.json({ ...handoff, deleteToken }, 201);
});

handoffApi.get("/artifacts/:id/handoffs/:hid/media", async (c) => {
  if (!handoffEnabled(c)) return c.text("not found", 404);
  const id = c.req.param("id");
  const record = await viewAuthRecord(c, id);
  if (!record) return c.text("not found", 404);
  const store = storeFrom(c);
  const media = await store.getHandoffMedia(record.id, c.req.param("hid"));
  if (media === null) return c.text("not found", 404);
  return new Response(media.body, {
    headers: {
      "content-type": stableMediaType(media.mediaType),
      ...readHeaders(record.visibility),
    },
  });
});

handoffApi.get("/artifacts/:id/handoffs/:hid/events", async (c) => {
  if (!handoffEnabled(c)) return c.text("not found", 404);
  const id = c.req.param("id");
  const record = await viewAuthRecord(c, id);
  if (!record) return c.text("not found", 404);
  const store = storeFrom(c);
  const events = await store.getHandoffEvents(record.id, c.req.param("hid"));
  if (events === null) return c.text("not found", 404);
  return new Response(events, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...readHeaders(record.visibility),
    },
  });
});

// Authorize a handoff delete: the handoff's own delete token (the recorder,
// from this browser) or the artifact's write/channel token (owner moderation).
// Mirrors authorizeCommentMutation. 404 before auth so a missing handoff is
// indistinguishable from a denied one.
handoffApi.delete("/artifacts/:id/handoffs/:hid", async (c) => {
  if (!handoffEnabled(c)) return c.text("not found", 404);
  const store = storeFrom(c);
  const id = c.req.param("id");
  const hid = c.req.param("hid");
  const authRow = await store.getHandoffAuth(id, hid);
  if (authRow === null) return c.text("not found", 404);

  const token = bearerToken(c);
  if (token === null) return c.text("missing bearer token", 401);
  const tokenHash = await sha256Hex(token);
  const authorMatch =
    authRow.deleteTokenHash !== null &&
    timingSafeEqual(tokenHash, authRow.deleteTokenHash);
  if (authorMatch || (await authorizeWrite(c, store, id)).ok) {
    await store.deleteHandoff(id, hid);
    return c.json({ ok: true });
  }
  return c.text("not authorized for this handoff", 403);
});
