import {
  createExecutionContext,
  runInDurableObject,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../../src/api";
import { createApp } from "../../src/app";
import type { Authorizer, OwnershipGrant } from "../../src/authorizer";
import app from "../../src/index";

// Live editing is OPT-IN: when the deploy did not bind a LIVE_DO Durable
// Object (the engine's default), the /live* routes 404 and the viewer renders
// no Live button. The pool binds LIVE_DO (vitest.config.ts miniflare option,
// mirroring wrangler.dev.jsonc), so the no-binding contract is pinned here by
// passing an explicit { ...env, LIVE_DO: undefined } env — the same way
// handoff.test.ts pins OPEN_ARTIFACTS_HANDOFF off. A self-host without LIVE_DO
// keeps today's viewer byte-for-byte.

// A canManage=true authorizer so owner-only surfaces (the Live toggle) render
// in tests. The default app (defaultAuthorizer) returns canManage=false,
// exercising the viewer (no-button) path.
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

const BASE = "http://artifacts.test";

const ON: Bindings = { ...env };
const OFF: Bindings = { ...env, LIVE_DO: undefined };

async function fetchWith(
  request: Request,
  environment: Bindings,
  useOwner = false,
): Promise<Response> {
  const ctx = createExecutionContext();
  const res = (useOwner ? ownerApp : app).fetch(request, environment, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function create(
  body: Record<string, unknown>,
  environment: Bindings = ON,
): Promise<{ id: string; liveSupported?: boolean }> {
  const res = await fetchWith(
    new Request(`${BASE}/api/artifacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Live Test",
        favicon: "🎯",
        ...body,
      }),
    }),
    environment,
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; liveSupported?: boolean };
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

// DO stub for an artifact id (mirrors live-api.ts stubFor). Indirect access:
// worker-configuration.d.ts derives from wrangler.jsonc, which has no LIVE_DO
// (the pool binding is a test-time addition), so the type lacks the key.
function liveStub(id: string): DurableObjectStub {
  const ns = (env as unknown as { LIVE_DO: DurableObjectNamespace }).LIVE_DO;
  type LiveNs = {
    idFromName(name: string): DurableObjectId;
    get(name: string | DurableObjectId): DurableObjectStub;
  };
  const liveNs = ns as unknown as LiveNs;
  return liveNs.get(liveNs.idFromName(id));
}

// Insert a pending event row directly into the DO's SQLite (deterministic
// version of the browser-WS enqueue path; avoids the message round-trip race).
// The DO creates the table lazily on first use, so warm the schema first —
// the same CREATE TABLE IF NOT EXISTS the DO's ensureSchema runs.
async function enqueueRaw(
  id: string,
  evt: Record<string, unknown>,
): Promise<void> {
  const stub = liveStub(id);
  await runInDurableObject(stub, async (_instance, state) => {
    await state.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS pending (
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        seq INTEGER NOT NULL,
        leased_until INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (id, type)
      )`,
    );
    await state.storage.sql.exec(
      `INSERT INTO pending (id, type, payload, seq, leased_until, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
      evt.id,
      evt.type,
      JSON.stringify(evt),
      Date.now(),
      Date.now(),
    );
  });
}

const SK_BEARER = { authorization: `Bearer sk_${"a".repeat(40)}` };

describe("live routes without LIVE_DO binding", () => {
  it("GET /api/artifacts/:id/live returns 404 (no WebSocket upgrade)", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live`, {
        headers: { Upgrade: "websocket" },
      }),
      OFF,
    );
    // The route exists (mounted) but 404s because env.LIVE_DO is undefined.
    expect(res.status).toBe(404);
  });

  it("GET /api/artifacts/:id/live/poll returns 404", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/poll`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/artifacts/:id/live/reply returns 404", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      jsonRequest("POST", `/api/artifacts/${id}/live/reply`, {
        id: "ev1",
        type: "done",
      }),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/artifacts/:id/live/status returns 404", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/artifacts/:id/live/heartbeat returns 404", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      jsonRequest("POST", `/api/artifacts/${id}/live/heartbeat`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/artifacts/:id/live/consume-exit returns 404", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      jsonRequest("POST", `/api/artifacts/${id}/live/consume-exit`),
      OFF,
    );
    expect(res.status).toBe(404);
  });

  it("PUT /api/artifacts/:id/live returns 404 without LIVE_DO", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(
      jsonRequest("PUT", `/api/artifacts/${id}/live`, {
        content: "<p>live</p>",
        baseVersion: 1,
      }),
      OFF,
      true,
    );
    expect(res.status).toBe(404);
  });

  it("the viewer host page renders no Live button without the binding", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), OFF, true);
    const html = await res.text();
    expect(html).not.toContain("oa-live-toggle");
    expect(html).not.toContain("oa-live-root");
    // The frame still works — the iframe is present.
    expect(html).toContain('id="oa-frame"');
  });

  it("the frame document carries the picker script tag (harmless when unarmed)", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    const res = await fetchWith(new Request(`${BASE}/a/${id}/frame`), OFF);
    const html = await res.text();
    // The picker script is always injected into the frame (it no-ops until
    // armed by a host oa:live:pick:arm message); confirm it is present but
    // does not auto-arm.
    expect(html).toContain("__oaSend");
  });
});

describe("live routes with LIVE_DO bound", () => {
  it("an owner sees the Live toggle button, live chrome, and the annot bridge", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), ON, true);
    const html = await res.text();
    expect(html).toContain("oa-live-toggle");
    expect(html).toContain("oa-live-root");
    expect(html).toContain("oa-live-config");
    expect(html).toContain("oa-live-connection");
    expect(html).toContain("Copy start prompt");
    expect(html).toContain("navigator.clipboard.writeText");
    // Offline guidance must not block the Live toggle from opening the picker.
    expect(html).toContain(
      "if(root.hidden&&agentOnline===false)showGuide();else hideGuide();",
    );
    // If the first arm message races the iframe load, oa:ready re-arms it
    // while the newly opened dock is still in PICKING.
    expect(html).toContain(
      "else if(!root.hidden&&state==='PICKING'&&!draft){ toFrame({type:'oa:live:pick:arm'});",
    );
    // The annotation pipeline: the host arms the frame picker AND enables the
    // annot overlay, and collects the frame's annotations before submit.
    expect(html).toContain("oa:live:annot:enable");
    expect(html).toContain("oa:live:annot:collect");
    // Regression: the exit event gets its own id — send() would otherwise
    // stamp the last generate's sessionId, and the watcher's exclude set
    // would hide the exit row forever (the watcher would never exit).
    expect(html).toContain("{type:'exit', id:genId()");
    // The comments chrome bridges posted comments onto the live channel: the
    // live script exposes the push hook, and the comments submit calls it.
    expect(html).toContain("__oaLivePush");
    expect(html).toContain('__oaLivePush({type:"comment"');
  });

  it("locks element picking while the selected element prompt is open", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), ON, true);
    const html = await res.text();

    const hostPickStart = html.indexOf("if(d.type==='oa:element:picked')");
    expect(hostPickStart).toBeGreaterThanOrEqual(0);
    expect(html.slice(hostPickStart, hostPickStart + 300)).toContain(
      "oa:live:pick:lock",
    );

    const frameRes = await fetchWith(new Request(`${BASE}/a/${id}/frame`), ON);
    const frameHtml = await frameRes.text();
    const framePickStart = frameHtml.indexOf("picked=hovered;");
    expect(framePickStart).toBeGreaterThanOrEqual(0);
    expect(frameHtml.slice(framePickStart, framePickStart + 300)).toContain(
      "lock();",
    );
  });

  it("replaces the current version for a Live edit", async () => {
    const { id } = await create({ content: "<p>v1</p>", format: "html" });
    let res = await fetchWith(
      jsonRequest("PUT", `/api/artifacts/${id}`, { content: "<p>v2</p>" }),
      ON,
      true,
    );
    expect(res.status).toBe(200);

    res = await fetchWith(
      jsonRequest("PUT", `/api/artifacts/${id}/live`, {
        content: "<p>live v2</p>",
        baseVersion: 2,
      }),
      ON,
      true,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, version: 2 });

    const metaRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}`),
      ON,
      true,
    );
    const meta = (await metaRes.json()) as {
      version: number;
      versions: { version: number }[];
    };
    expect(meta.version).toBe(2);
    expect(meta.versions.map((item) => item.version)).toEqual([1, 2]);

    const frame = await fetchWith(
      new Request(`${BASE}/a/${id}/frame`),
      ON,
      true,
    );
    expect(await frame.text()).toContain("live v2");

    res = await fetchWith(
      jsonRequest("PUT", `/api/artifacts/${id}`, {
        content: "<p>v3</p>",
        baseVersion: 2,
      }),
      ON,
      true,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, version: 3 });

    const latestMetaRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}`),
      ON,
      true,
    );
    const latestMeta = (await latestMetaRes.json()) as {
      version: number;
      versions: { version: number }[];
    };
    expect(latestMeta.version).toBe(3);
    expect(latestMeta.versions.map((item) => item.version)).toEqual([1, 2, 3]);
  });

  it("a non-owner viewer sees no Live toggle even when LIVE_DO is bound", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await fetchWith(new Request(`${BASE}/a/${id}`), ON, false);
    const html = await res.text();
    expect(html).not.toContain('class="oa-live-toggle"');
  });

  it("the frame document carries the annot data reply handler", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await fetchWith(new Request(`${BASE}/a/${id}/frame`), ON);
    const html = await res.text();
    expect(html).toContain("oa:live:annot:data");
  });

  it("POST /live/heartbeat records presence and GET /live/status reports it", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    // Before any heartbeat: not active.
    let res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    expect(res.status).toBe(200);
    let status = (await res.json()) as {
      pendingEvents: unknown[];
      agentActive: boolean;
      lastAgentSeen: number | null;
    };
    expect(status.agentActive).toBe(false);
    expect(status.lastAgentSeen).toBe(null);
    expect(Array.isArray(status.pendingEvents)).toBe(true);

    // After a heartbeat: active with a timestamp.
    res = await fetchWith(
      jsonRequest(
        "POST",
        `/api/artifacts/${id}/live/heartbeat`,
        undefined,
        SK_BEARER,
      ),
      ON,
      true,
    );
    expect(res.status).toBe(200);
    res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    status = (await res.json()) as {
      pendingEvents: unknown[];
      agentActive: boolean;
      lastAgentSeen: number | null;
    };
    expect(status.agentActive).toBe(true);
    expect(typeof status.lastAgentSeen).toBe("number");
  });

  it("GET /live/status and POST /live/heartbeat use the artifact view gate", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await fetchWith(
      jsonRequest(
        "POST",
        `/api/artifacts/${id}/live/heartbeat`,
        undefined,
        SK_BEARER,
      ),
      ON,
      false,
    );
    expect(res.status).toBe(200);
    const res2 = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      false,
    );
    expect(res2.status).toBe(200);
  });

  it("agentActive goes false once lastAgentSeen falls outside the window", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    await fetchWith(
      jsonRequest(
        "POST",
        `/api/artifacts/${id}/live/heartbeat`,
        undefined,
        SK_BEARER,
      ),
      ON,
      true,
    );
    // Backdate presence past the 60s window.
    await runInDurableObject(liveStub(id), async (_instance, state) => {
      await state.storage.put("lastAgentSeen", Date.now() - 120_000);
    });
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    const status = (await res.json()) as { agentActive: boolean };
    expect(status.agentActive).toBe(false);
  });

  it("GET /live/status reports queued generate events in pendingEvents", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    await enqueueRaw(id, { type: "generate", id: "ev1", items: [] });
    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    const status = (await res.json()) as {
      pendingEvents: { id: string; type: string }[];
    };
    expect(status.pendingEvents.some((e) => e.id === "ev1")).toBe(true);
  });

  it("a hosted sk watcher can poll through the artifact view gate", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    await enqueueRaw(id, {
      type: "comment",
      id: "c_sk_view1",
      body: "hosted watcher can receive this",
    });

    const res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/poll?timeout=1000`, {
        headers: SK_BEARER,
      }),
      ON,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      type: "comment",
      id: "c_sk_view1",
    });
  });

  it("browser WebSocket generate and comment events reach pendingEvents (the real enqueue path)", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await liveStub(id).fetch(
      new Request(`${BASE}/api/artifacts/${id}/live`, {
        headers: { Upgrade: "websocket" },
      }),
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket in upgrade response");
    ws.accept();
    ws.send(JSON.stringify({ type: "generate", id: "ev_ws1", items: [] }));
    ws.send(
      JSON.stringify({
        type: "comment",
        id: "c_ws1",
        body: "make the header sticky",
        anchor: { mode: "point", x: 10, y: 20 },
      }),
    );
    // The DO processes the WS messages asynchronously; poll status until both
    // events land (bounded — the DO enqueue is fast, this is just a guard).
    let seen = 0;
    for (let i = 0; i < 20 && seen < 2; i++) {
      const statusRes = await fetchWith(
        new Request(`${BASE}/api/artifacts/${id}/live/status`, {
          headers: SK_BEARER,
        }),
        ON,
        true,
      );
      const status = (await statusRes.json()) as {
        pendingEvents: { id: string }[];
      };
      seen = status.pendingEvents.filter(
        (e) => e.id === "ev_ws1" || e.id === "c_ws1",
      ).length;
      if (seen < 2) await new Promise((r) => setTimeout(r, 100));
    }
    ws.close();
    expect(seen).toBe(2);
  });

  it("polling a comment returns its payload and consumes the queued event", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    const res = await liveStub(id).fetch(
      new Request(`${BASE}/api/artifacts/${id}/live`, {
        headers: { Upgrade: "websocket" },
      }),
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket in upgrade response");
    ws.accept();
    ws.send(
      JSON.stringify({
        type: "comment",
        id: "c_consume1",
        body: "remove the stale comment",
        author: "reviewer",
        createdAt: "2026-08-02T10:00:00.000Z",
      }),
    );

    const pollRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/poll?timeout=1000`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    expect(await pollRes.json()).toMatchObject({
      type: "comment",
      id: "c_consume1",
      body: "remove the stale comment",
    });

    const statusRes = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    const status = (await statusRes.json()) as {
      pendingEvents: { id: string }[];
    };
    expect(
      status.pendingEvents.some((event) => event.id === "c_consume1"),
    ).toBe(false);
    ws.close();
  });

  it("GET /live/poll honors exclude so in-flight events are never re-delivered", async () => {
    const { id } = await create({ content: "<p>hi</p>", format: "html" });
    // Warm the schema, then queue two events with ev1's lease expired.
    await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/status`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    await enqueueRaw(id, { type: "generate", id: "ev1", items: [] });
    await enqueueRaw(id, { type: "generate", id: "ev2", items: [] });
    await runInDurableObject(liveStub(id), async (_instance, state) => {
      await state.storage.sql.exec(
        `UPDATE pending SET leased_until = 0 WHERE id = 'ev1'`,
      );
    });

    // Without exclude the oldest eligible event is delivered.
    let res = await fetchWith(
      new Request(`${BASE}/api/artifacts/${id}/live/poll?timeout=1000`, {
        headers: SK_BEARER,
      }),
      ON,
      true,
    );
    let evt = (await res.json()) as { type: string; id: string };
    expect(evt.id).toBe("ev1");

    // With exclude=ev1 the next poll must skip it (not re-deliver).
    res = await fetchWith(
      new Request(
        `${BASE}/api/artifacts/${id}/live/poll?timeout=1000&exclude=ev1`,
        { headers: SK_BEARER },
      ),
      ON,
      true,
    );
    evt = (await res.json()) as { type: string; id: string };
    expect(evt.id).toBe("ev2");
  });

  it("POST /api/artifacts returns liveSupported true when LIVE_DO is bound and false when not", async () => {
    const on = await create({ content: "<p>hi</p>", format: "html" }, ON);
    const off = await create({ content: "<p>hi</p>", format: "html" }, OFF);
    expect(on.liveSupported).toBe(true);
    expect(off.liveSupported).toBe(false);
  });
});
