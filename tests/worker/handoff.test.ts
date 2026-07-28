import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../../src/api";
import { createApp } from "../../src/app";
import type { Authorizer, OwnershipGrant } from "../../src/authorizer";
import app from "../../src/index";
import { D1R2Store } from "../../src/store";

// A canManage=true authorizer so owner-only surfaces (Handoff/Live toggle
// buttons) render in tests. The default app (defaultAuthorizer) returns
// canManage=false, exercising the viewer (no-button) path.
function ownerAuthorizer(): Authorizer {
  const grant: OwnershipGrant = {
    ownerId: "u1",
    orgId: null,
    visibility: "public",
  };
  return {
    authorizeCreate: async () => grant,
    authorizeView: async () => true,
    authorizeWrite: async () => true,
    canManage: async () => true,
  };
}
const ownerApp = createApp(ownerAuthorizer());

// Handoff recording is OPT-IN: a deploy sets OPEN_ARTIFACTS_HANDOFF=1. Without
// it the host page renders no Handoff button, the /handoffs* routes 404, and the
// frame carries no handoff shim. This pins the deploy-toggle contract the same
// way live.test.ts pins LIVE_DO: a self-host without the flag keeps today's
// viewer byte-for-byte. Browser-only surfaces (getUserMedia/MediaRecorder) are
// asserted structurally - the shim scripts and bridge message names - not by
// exercising a real capture, mirroring how live tests assert the picker script.

const BASE = "http://artifacts.test";

const ON: Bindings = { ...env, OPEN_ARTIFACTS_HANDOFF: "1" };
const OFF: Bindings = { ...env, OPEN_ARTIFACTS_HANDOFF: "" };

async function fetchWith(
  request: Request,
  environment: Bindings,
): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await app.fetch(request, environment, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

// Owner-mode fetch: uses an authorizer whose canManage is true, so the
// owner-only toggle buttons render.
async function ownerFetchWith(
  request: Request,
  environment: Bindings,
): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await ownerApp.fetch(request, environment, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

interface CreateResult {
  id: string;
  writeToken: string;
}

async function createArtifact(
  environment: Bindings,
  overrides: Record<string, unknown> = {},
): Promise<CreateResult> {
  const res = await fetchWith(
    jsonRequest("POST", "/api/artifacts", {
      content: "<h1>Hello</h1>",
      title: "Handoff Test",
      favicon: "🎬",
      ...overrides,
    }),
    environment,
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string; writeToken: string };
  return { id: body.id, writeToken: body.writeToken };
}

function handoffPostRequest(
  id: string,
  writeToken: string,
  media: { bytes: string; type: string } = {
    bytes: "fake-webm-bytes",
    type: "video/webm",
  },
  events: unknown[] = [{ t: 0, kind: "move", x: 10, y: 20 }],
  meta: Record<string, unknown> = {
    durationMs: 1000,
    hasVideo: true,
    hasAudio: true,
    author: "recorder",
  },
): Request {
  const fd = new FormData();
  fd.append(
    "media",
    new Blob([media.bytes], { type: media.type }),
    "media.webm",
  );
  fd.append("events", JSON.stringify(events));
  fd.append("meta", JSON.stringify(meta));
  return new Request(`${BASE}/api/artifacts/${id}/handoffs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${writeToken}` },
    body: fd,
  });
}

describe("handoff routes without OPEN_ARTIFACTS_HANDOFF", () => {
  it("GET /api/artifacts/:id/handoffs returns 404", async () => {
    const { id } = await createArtifact(OFF);
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/artifacts/:id/handoffs returns 404", async () => {
    const { id, writeToken } = await createArtifact(OFF);
    const res = await fetchWith(handoffPostRequest(id, writeToken), OFF);
    expect(res.status).toBe(404);
  });

  it("GET /api/artifacts/:id/handoffs/:hid/media returns 404", async () => {
    const { id } = await createArtifact(OFF);
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/any/media`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("the host page renders no Handoff button", async () => {
    const { id } = await createArtifact(OFF);
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), OFF);
    const html = await res.text();
    expect(html).not.toContain("oa-handoff-toggle");
    expect(html).not.toContain("oa-handoff-data");
  });

  it("the frame document carries no handoff shim", async () => {
    const { id } = await createArtifact(OFF);
    const res = await fetchWith(new Request(`${BASE}/a/${id}/frame`), OFF);
    const html = await res.text();
    expect(html).not.toContain("oa:handoff:record:arm");
    expect(html).not.toContain("oa:handoff:play");
  });
});

describe("handoff chrome with OPEN_ARTIFACTS_HANDOFF=1", () => {
  it("an owner sees the Handoff toggle button", async () => {
    const { id } = await createArtifact(ON);
    const res = await ownerFetchWith(new Request(`${BASE}/a/${id}`), ON);
    const html = await res.text();
    expect(html).toContain('<button class="oa-handoff-toggle"');
    expect(html).toContain("oa-handoff-root");
    expect(html).toContain("window.__oaCanManage=true");
  });

  it("a non-owner viewer sees no Handoff toggle button", async () => {
    const { id } = await createArtifact(ON);
    // default authorizer -> canManage=false.
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), ON);
    const html = await res.text();
    expect(html).not.toContain('<button class="oa-handoff-toggle"');
    expect(html).toContain("window.__oaCanManage=false");
  });

  it("the frame document carries the inert handoff shim", async () => {
    const { id } = await createArtifact(ON);
    const res = await fetchWith(new Request(`${BASE}/a/${id}/frame`), ON);
    const html = await res.text();
    expect(html).toContain("oa:handoff:record:arm");
    expect(html).toContain("oa:handoff:play");
  });

  it("inlines the single handoff at serve time", async () => {
    const { id, writeToken } = await createArtifact(ON);
    await fetchWith(handoffPostRequest(id, writeToken), ON);
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), ON);
    const html = await res.text();
    expect(html).toContain("oa-handoff-data");
  });
});

describe("one handoff per artifact+version", () => {
  it("a second POST for the SAME version overwrites in place - same id, no orphan", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const first = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "first-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 10, y: 20 }],
        {
          durationMs: 1000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 1,
        },
      ),
      ON,
    );
    const firstBody = (await first.json()) as { id: string };
    expect(first.status).toBe(201);

    const second = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "second-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 10, y: 20 }],
        {
          durationMs: 1000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 1,
        },
      ),
      ON,
    );
    const secondBody = (await second.json()) as { id: string };
    expect(second.status).toBe(201);

    // The id is derived from the artifact id + version, so a re-record of the
    // same version reuses it - no race window, no orphaned R2 under a
    // discarded id.
    expect(secondBody.id).toBe(firstBody.id);

    // Exactly one row for this version, at the same id.
    const listRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`),
      ON,
    );
    const list = (await listRes.json()) as { handoffs: { id: string }[] };
    expect(list.handoffs).toHaveLength(1);
    expect(list.handoffs[0]?.id).toBe(secondBody.id);

    // The media at that id is now the SECOND blob (overwritten in place,
    // not orphaned). The first media is gone at the same key.
    const mediaRes = await fetchWith(
      new Request(
        `${BASE}/api/artifacts/${id}/handoffs/${secondBody.id}/media`,
      ),
      ON,
    );
    expect(mediaRes.status).toBe(200);
    expect(new TextDecoder().decode(await mediaRes.arrayBuffer())).toBe(
      "second-media",
    );
  });

  it("POSTs for DIFFERENT versions keep both handoffs under distinct ids", async () => {
    const { id, writeToken } = await createArtifact(ON);
    // v1 recording (explicit version: 1).
    const v1 = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "v1-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 0, y: 0 }],
        {
          durationMs: 1000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 1,
        },
      ),
      ON,
    );
    const v1Body = (await v1.json()) as { id: string; version: number };
    expect(v1.status).toBe(201);
    expect(v1Body.version).toBe(1);

    // Publish a second version of the artifact so version 2 exists.
    const updateRes = await fetchWith(
      jsonRequest(
        "PUT",
        `/api/artifacts/${id}`,
        {
          content: "<h1>Hello v2</h1>",
        },
        { Authorization: `Bearer ${writeToken}` },
      ),
      ON,
    );
    expect(updateRes.status).toBe(200);

    // v2 recording (explicit version: 2).
    const v2 = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "v2-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 0, y: 0 }],
        {
          durationMs: 1000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 2,
        },
      ),
      ON,
    );
    const v2Body = (await v2.json()) as { id: string; version: number };
    expect(v2.status).toBe(201);
    expect(v2Body.version).toBe(2);

    // Distinct ids (version-scoped), both rows survive.
    expect(v2Body.id).not.toBe(v1Body.id);
    const listRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`),
      ON,
    );
    const list = (await listRes.json()) as {
      handoffs: { id: string; version: number }[];
    };
    expect(list.handoffs).toHaveLength(2);
    expect(list.handoffs.map((h) => h.version).sort()).toEqual([1, 2]);

    // Each version's media is its own - v1 was NOT overwritten by the v2 POST.
    const v1Media = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${v1Body.id}/media`),
      ON,
    );
    expect(new TextDecoder().decode(await v1Media.arrayBuffer())).toBe(
      "v1-media",
    );
    const v2Media = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${v2Body.id}/media`),
      ON,
    );
    expect(new TextDecoder().decode(await v2Media.arrayBuffer())).toBe(
      "v2-media",
    );
  });

  it("the host page inlines the recording matching the viewed version", async () => {
    const { id, writeToken } = await createArtifact(ON);
    // Record at v1.
    await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "v1-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 0, y: 0 }],
        {
          durationMs: 1000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 1,
        },
      ),
      ON,
    );
    // Publish v2 with different content.
    await fetchWith(
      jsonRequest(
        "PUT",
        `/api/artifacts/${id}`,
        {
          content: "<h1>Hello v2</h1>",
        },
        { Authorization: `Bearer ${writeToken}` },
      ),
      ON,
    );
    // Record at v2.
    const v2Post = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "v2-media",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 0, y: 0 }],
        {
          durationMs: 2000,
          hasVideo: true,
          hasAudio: true,
          author: "recorder",
          version: 2,
        },
      ),
      ON,
    );
    const v2Body = (await v2Post.json()) as { id: string };

    // Viewing v1 inlines the v1 recording (durationMs 1000), not v2.
    const v1Host = await fetchWith(new Request(`${BASE}/a/${id}?v=1`), ON);
    const v1Html = await v1Host.text();
    expect(v1Html).toContain('"durationMs":1000');
    expect(v1Html).not.toContain('"durationMs":2000');

    // Viewing v2 inlines the v2 recording (durationMs 2000), not v1.
    const v2Host = await fetchWith(new Request(`${BASE}/a/${id}?v=2`), ON);
    const v2Html = await v2Host.text();
    expect(v2Html).toContain('"durationMs":2000');
    expect(v2Html).not.toContain('"durationMs":1000');
    expect(v2Html).toContain(v2Body.id);
  });
});

describe("handoff recording is write-gated", () => {
  it("POST without a write token is 401", async () => {
    const { id } = await createArtifact(ON);
    const fd = new FormData();
    fd.append("media", new Blob(["x"], { type: "video/webm" }), "m.webm");
    fd.append("events", "[]");
    fd.append("meta", JSON.stringify({ durationMs: 1 }));
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`, {
        method: "POST",
        body: fd,
      }),
      ON,
    );
    expect(res.status).toBe(401);
  });

  it("POST with a wrong token is 403", async () => {
    const { id } = await createArtifact(ON);
    const res = await fetchWith(handoffPostRequest(id, "not-a-real-token"), ON);
    expect(res.status).toBe(403);
  });
});

describe("a recorded handoff is stored and round-trips", () => {
  it("POST returns 201 with id + deleteToken and stores media+events+row", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const res = await fetchWith(handoffPostRequest(id, writeToken), ON);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; deleteToken: string };
    expect(body.id).toBeTruthy();
    expect(body.deleteToken).toBeTruthy();

    // Listed.
    const listRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`),
      ON,
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { handoffs: { id: string }[] };
    expect(list.handoffs.map((h) => h.id)).toContain(body.id);

    // Media round-trips with the recorded content-type.
    const mediaRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${body.id}/media`),
      ON,
    );
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("content-type")).toBe("video/webm");
    expect(new TextDecoder().decode(await mediaRes.arrayBuffer())).toBe(
      "fake-webm-bytes",
    );

    // Events round-trip.
    const eventsRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${body.id}/events`),
      ON,
    );
    expect(eventsRes.status).toBe(200);
    const events = (await eventsRes.json()) as { t: number; kind: string }[];
    expect(events[0]?.kind).toBe("move");
  });

  it("stored directly in R2 at handoff/<id>/<hid>/media and /events", async () => {
    const store = new D1R2Store(env.DB, env.CONTENT);
    const { id, writeToken } = await createArtifact(ON);
    const res = await fetchWith(handoffPostRequest(id, writeToken), ON);
    const body = (await res.json()) as { id: string };
    const media = await env.CONTENT.get(`handoff/${id}/${body.id}/media`);
    const events = await env.CONTENT.get(`handoff/${id}/${body.id}/events`);
    expect(media).not.toBeNull();
    expect(events).not.toBeNull();
    expect(await store.listHandoffs(id)).toHaveLength(1);
  });
});

describe("portrait-blur hasBlur flag round-trips", () => {
  it("POST with meta.hasBlur=true stores and returns hasBlur", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const res = await fetchWith(
      handoffPostRequest(
        id,
        writeToken,
        {
          bytes: "blur-on-webm",
          type: "video/webm",
        },
        [{ t: 0, kind: "move", x: 0, y: 0 }],
        {
          durationMs: 500,
          hasVideo: true,
          hasAudio: true,
          hasBlur: true,
          author: "blurred",
        },
      ),
      ON,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { hasBlur: boolean; id: string };
    expect(body.hasBlur).toBe(true);

    const listRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`),
      ON,
    );
    const list = (await listRes.json()) as {
      handoffs: { hasBlur: boolean }[];
    };
    expect(list.handoffs[0]?.hasBlur).toBe(true);

    // The host page inlines hasBlur so playback can skip re-compositing.
    const hostRes = await fetchWith(new Request(`${BASE}/a/${id}`), ON);
    const html = await hostRes.text();
    expect(html).toContain("oa-handoff-cam-canvas");
    expect(html).toContain('"hasBlur":true');
  });

  it("POST without hasBlur defaults to false", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const res = await fetchWith(handoffPostRequest(id, writeToken), ON);
    const body = (await res.json()) as { hasBlur: boolean };
    expect(body.hasBlur).toBe(false);
  });
});

describe("handoff reads are view-gated", () => {
  it("unauthorized media/events reads collapse to 404", async () => {
    // defaultAuthorizer.authorizeView is always true, so exercise the gate via
    // a missing artifact: a nonexistent artifact's handoff routes 404 the same
    // way /raw does, never confirming existence.
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/nope/handoffs/any/media`),
      ON,
    );
    expect(res.status).toBe(404);
  });
});

describe("handoff media cannot become a script-bearing document", () => {
  it("coerces a non-media content-type to octet-stream at create", async () => {
    const { id, writeToken } = await createArtifact(ON);
    // An owner tries to store text/html as the media blob.
    const fd = new FormData();
    fd.append(
      "media",
      new Blob(
        ["<script>fetch('/api/artifacts',{credentials:'include'})</script>"],
        {
          type: "text/html",
        },
      ),
      "media.html",
    );
    fd.append("events", "[]");
    fd.append("meta", JSON.stringify({ durationMs: 1 }));
    const postRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${writeToken}` },
        body: fd,
      }),
      ON,
    );
    expect(postRes.status).toBe(201);
    const { id: hid } = (await postRes.json()) as { id: string };

    // The stored/served content-type is octet-stream, never text/html, so a
    // direct navigation renders the bytes instead of executing them.
    const mediaRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}/media`),
      ON,
    );
    expect(mediaRes.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
  });

  it("serves media with a default-src 'none' CSP + nosniff", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const postRes = await fetchWith(
      handoffPostRequest(id, writeToken, {
        bytes: "fake-webm",
        type: "video/webm",
      }),
      ON,
    );
    const { id: hid } = (await postRes.json()) as { id: string };
    const mediaRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}/media`),
      ON,
    );
    const csp = mediaRes.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(mediaRes.headers.get("x-content-type-options")).toBe("nosniff");
    // A public artifact's media is cacheable; the branch is exercised here.
    expect(mediaRes.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});

describe("handoff deletion authorization", () => {
  it("delete by author delete-token succeeds; stranger is rejected", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const postRes = await fetchWith(handoffPostRequest(id, writeToken), ON);
    const { id: hid, deleteToken } = (await postRes.json()) as {
      id: string;
      deleteToken: string;
    };

    // Stranger, no token -> 401.
    const noTok = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}`, {
        method: "DELETE",
      }),
      ON,
    );
    expect(noTok.status).toBe(401);

    // Stranger, wrong token -> 403.
    const wrongTok = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer wrong" },
      }),
      ON,
    );
    expect(wrongTok.status).toBe(403);

    // Author delete-token -> 200, media gone.
    const ok = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${deleteToken}` },
      }),
      ON,
    );
    expect(ok.status).toBe(200);
    const after = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}/media`),
      ON,
    );
    expect(after.status).toBe(404);
  });

  it("the owner write-token also deletes", async () => {
    const { id, writeToken } = await createArtifact(ON);
    const postRes = await fetchWith(handoffPostRequest(id, writeToken), ON);
    const { id: hid } = (await postRes.json()) as { id: string };
    const ok = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/handoffs/${hid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${writeToken}` },
      }),
      ON,
    );
    expect(ok.status).toBe(200);
  });
});

describe("deleting the artifact sweeps its handoffs", () => {
  it("removes handoff media, events, and D1 rows", async () => {
    const store = new D1R2Store(env.DB, env.CONTENT);
    const { id, writeToken } = await createArtifact(ON);
    const postRes = await fetchWith(handoffPostRequest(id, writeToken), ON);
    const { id: hid } = (await postRes.json()) as { id: string };
    expect(await store.listHandoffs(id)).toHaveLength(1);

    await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${writeToken}` },
      }),
      ON,
    );

    expect(await store.listHandoffs(id)).toHaveLength(0);
    expect(await env.CONTENT.get(`handoff/${id}/${hid}/media`)).toBeNull();
    expect(await env.CONTENT.get(`handoff/${id}/${hid}/events`)).toBeNull();
  });
});

// Keeps the default-env contract honest: exports.default.fetch (no custom env)
// honors whatever wrangler.jsonc declares for OPEN_ARTIFACTS_HANDOFF.
describe("default env honors wrangler vars", () => {
  it("the host page reflects the configured flag (viewer sees no toggle)", async () => {
    const { id } = await createArtifact(ON);
    // exports.default uses defaultAuthorizer (canManage=false) - the flag is on
    // (frame carries the shim, no toggle button for non-owners).
    const res = await exports.default.fetch(new Request(`${BASE}/a/${id}`));
    const html = await res.text();
    expect(html).not.toContain('<button class="oa-handoff-toggle"');
    expect(html).toContain("oa-handoff-cam-canvas"); // shim present regardless
  });
});
