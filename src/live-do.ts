import { DurableObject } from "cloudflare:workers";

// LiveObject — the per-artifact coordination point for live editing.
//
// One LiveObject instance per artifact id (keyed by getByName(artifactId)). It
// holds the WebSocket channel to the viewing browser (host chrome, outside the
// sandboxed iframe) and the long-poll queue the authoring agent CLI drains.
//
// The three-party loop (one-shot edit-and-reload):
//   Browser (host) ── ws.send(generate/exit) ──▶ LiveObject
//   Agent (CLI)    ── rpc.poll()  ──▶ drains pendingEvents (blocks)
//   Agent          ◀── rpc.poll() returns one event (generate)
//   Agent          ── rpc.reply(id, ack)  ──▶ LiveObject broadcasts ack
//   Agent          ── rpc.reply(id, done) ──▶ LiveObject broadcasts done
//   LiveObject     ── ws.send(ack/done) ──▶ Browser (broadcasts)
//
// Persistence: the pending queue lives in the DO's SQLite storage
// (ctx.storage), so events survive hibernation. A user who submits `generate`
// while no agent is polling won't lose the event — it sits in SQLite until the
// agent connects or the entry ages out (GC). waiters and nextSeq stay
// in-memory (a missed wake after hibernation just means the agent re-polls).
//
// Hibernatable WebSockets: acceptWebSocket keeps the DO cheap when idle; a
// message wakes it. webSocketMessage/webSocketClose are the hibernation handlers.

export type LiveEvent = {
  type: "generate" | "exit" | "comment" | "ack" | "done" | "error";
  id: string;
  [key: string]: unknown;
};

// Priority: terminal user actions first (a late exit shouldn't sit behind a
// generate), then generate, then everything else.
function eventPriority(type: LiveEvent["type"]): number {
  if (type === "exit") return 0;
  if (type === "generate") return 1;
  return 2;
}

type QueueRow = {
  id: string;
  type: string;
  payload: string; // JSON
  seq: number;
  leased_until: number;
  created_at: number;
};

type PollWaiter = {
  resolve: (e: LiveEvent | { type: "timeout" }) => void;
  types: Set<LiveEvent["type"]> | null; // null = any
  skip: Set<string>; // event ids this poller must not be offered
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_POLL_TIMEOUT_MS = 270_000; // under undici's 300s header ceiling
const LEASE_MS = 30_000; // a poll holds an event for 30s before re-offering it
const GC_AGE_MS = 3600_000; // drop undelivered events after 1h
// A watcher heartbeats roughly every 20s; an agent that has not been seen
// within this window is treated as offline (the viewer's Live dot drops).
const AGENT_ACTIVE_WINDOW_MS = 60_000;

export class LiveObject extends DurableObject<Record<string, unknown>> {
  // In-memory only; a missed wake after hibernation just re-polls.
  private waiters: PollWaiter[] = [];
  private schemaReady = false;

  // --- WebSocket (browser host chrome) ---

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let msg: LiveEvent;
    try {
      msg = JSON.parse(
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message),
      ) as LiveEvent;
    } catch {
      return; // ignore malformed
    }
    if (!msg?.type || !msg?.id) return;

    if (msg.type === "exit") {
      // Browser session ended — drop the connection; agent will see exit.
      await this.enqueue(msg);
      try {
        ws.close();
      } catch {
        // already closed
      }
      return;
    }
    await this.enqueue(msg);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ) {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  // --- Agent (CLI) RPC ---

  // Block until a matching event arrives or timeout. Lease prevents
  // double-delivery: the row is marked leased for LEASE_MS; if the agent
  // never replies, a later poll can re-acquire it. excludeIds are ids the
  // watcher has already delivered this session — a lease-expired, unreplied
  // event must not be re-offered ahead of newer ones (the watch loop passes
  // its grow-only delivered set).
  async rpcPoll(
    types: LiveEvent["type"][] | null,
    timeoutMs: number = DEFAULT_POLL_TIMEOUT_MS,
    excludeIds: string[] = [],
  ): Promise<LiveEvent | { type: "timeout" }> {
    await this.ensureSchema();
    const want = types ? new Set(types) : null;
    const skip = new Set(excludeIds);
    const available = await this.pickAvailable(want, Date.now(), skip);
    if (available) return available;

    return new Promise<LiveEvent | { type: "timeout" }>((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve({ type: "timeout" });
      }, timeoutMs);
      const waiter: PollWaiter = { resolve, types: want, skip, timer };
      this.waiters.push(waiter);
    });
  }

  // Agent replies to an event: `ack` = "picked up, working" (broadcast but
  // keep the row); `done` = "finished, republished" (broadcast + drop the row).
  async rpcReply(
    id: string,
    type: LiveEvent["type"],
    payload: Record<string, unknown> = {},
  ) {
    if (type === "done" || type === "error") {
      await this.acknowledge(id);
    }
    this.broadcast({ type, id, ...payload } as LiveEvent);
  }

  // Snapshot of the pending queue for ack-status polling. The agent CLI drains
  // this via GET /live/status to wait for its own `done` reply to clear an
  // event before polling the next (see waitForEventAck in artifact.mjs).
  // agentActive/lastAgentSeen are the watcher's presence: the watch loop
  // heartbeats (rpcHeartbeat) so the viewer's Live toggle can show whether an
  // agent is online before the user starts picking.
  async rpcStatus(): Promise<{
    pendingEvents: {
      id: string;
      type: string;
      leased_until: number;
      created_at: number;
    }[];
    agentActive: boolean;
    lastAgentSeen: number | null;
  }> {
    await this.ensureSchema();
    const rows = this.ctx.storage.sql
      .exec<{
        id: string;
        type: string;
        leased_until: number;
        created_at: number;
      }>(
        `SELECT id, type, leased_until, created_at FROM pending ORDER BY seq ASC`,
      )
      .toArray();
    const lastAgentSeen =
      (await this.ctx.storage.get<number>("lastAgentSeen")) ?? null;
    return {
      pendingEvents: rows,
      agentActive:
        lastAgentSeen !== null &&
        Date.now() - lastAgentSeen <= AGENT_ACTIVE_WINDOW_MS,
      lastAgentSeen,
    };
  }

  // Watcher presence: the CLI's `--watch` loop POSTs /live/heartbeat on a
  // fixed interval so the viewer can show an "agent connected" state. The
  // timestamp lives in DO KV storage, so it survives hibernation.
  async rpcHeartbeat(): Promise<void> {
    await this.ctx.storage.put("lastAgentSeen", Date.now());
  }

  // Drop queued exit rows so a stale exit from a prior session can't poison a
  // new --watch (pollOnce would otherwise re-offer it for up to the 1h GC).
  // Called by the agent CLI when it observes an exit (via pollOnce or the
  // /status ack-wait). Safe vs. the done-races-exit case: acknowledge (done/
  // error) still preserves exits - only an explicit consume clears them, and
  // only after the watcher has already seen one.
  async rpcConsumeExit(): Promise<void> {
    await this.ensureSchema();
    await this.ctx.storage.sql.exec(`DELETE FROM pending WHERE type = 'exit'`);
  }

  // --- internals ---

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    const sql = this.ctx.storage.sql;
    sql.exec(
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
    sql.exec(`CREATE INDEX IF NOT EXISTS pending_seq ON pending(seq)`);
    this.schemaReady = true;
  }

  private async enqueue(event: LiveEvent): Promise<void> {
    await this.ensureSchema();
    // GC old undelivered events so a forgotten submit doesn't live forever.
    const cutoff = Date.now() - GC_AGE_MS;
    await this.ctx.storage.sql.exec(
      `DELETE FROM pending WHERE created_at < ?`,
      cutoff,
    );
    // Dedupe by id+type.
    const exists =
      this.ctx.storage.sql
        .exec<{ c: number }>(
          `SELECT COUNT(*) AS c FROM pending WHERE id = ? AND type = ?`,
          event.id,
          event.type,
        )
        .toArray()[0]?.c ?? 0;
    if (exists > 0) return;
    const seq = Date.now(); // monotonic-ish; ties broken by created_at
    await this.ctx.storage.sql.exec(
      `INSERT INTO pending (id, type, payload, seq, leased_until, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
      event.id,
      event.type,
      JSON.stringify(event),
      seq,
      Date.now(),
    );
    await this.flushWaiters();
  }

  // Acknowledge a `done`/`error` reply: drop the fulfilled event row(s) for
  // this id, but preserve any queued `exit` — the agent's watch loop only
  // terminates on `exit`, and a `done` that races a user's Exit click must not
  // strand it (the row would sit until GC, the watcher hanging up to 1h).
  private async acknowledge(id: string): Promise<void> {
    await this.ctx.storage.sql.exec(
      `DELETE FROM pending WHERE id = ? AND type != 'exit'`,
      id,
    );
  }

  private async pickAvailable(
    want: Set<LiveEvent["type"]> | null,
    now: number,
    skip: Set<string> = new Set(),
  ): Promise<LiveEvent | null> {
    await this.ensureSchema();
    const rows = this.ctx.storage.sql
      .exec<QueueRow>(
        `SELECT id, type, payload, seq, leased_until, created_at FROM pending WHERE leased_until <= ? ORDER BY seq ASC`,
        now,
      )
      .toArray();
    // Sort in JS by priority then seq (priority is small; SQL ORDER BY can't
    // see the JS function). Terminal types (exit) first, then generate.
    const sorted = rows.sort(
      (a, b) =>
        eventPriority(a.type as LiveEvent["type"]) -
          eventPriority(b.type as LiveEvent["type"]) || a.seq - b.seq,
    );
    const winner = sorted.find(
      (r) =>
        (want === null || want.has(r.type as LiveEvent["type"])) &&
        !skip.has(r.id),
    );
    if (!winner) return null;
    await this.ctx.storage.sql.exec(
      `UPDATE pending SET leased_until = ? WHERE id = ? AND type = ?`,
      now + LEASE_MS,
      winner.id,
      winner.type,
    );
    try {
      return JSON.parse(winner.payload) as LiveEvent;
    } catch {
      // corrupted row — drop it so it doesn't block the queue
      await this.ctx.storage.sql.exec(
        `DELETE FROM pending WHERE id = ? AND type = ?`,
        winner.id,
        winner.type,
      );
      return null;
    }
  }

  private async flushWaiters(): Promise<void> {
    if (this.waiters.length === 0) return;
    const now = Date.now();
    for (const waiter of [...this.waiters]) {
      const evt = await this.pickAvailable(waiter.types, now, waiter.skip);
      if (evt) {
        clearTimeout(waiter.timer);
        this.waiters = this.waiters.filter((w) => w !== waiter);
        waiter.resolve(evt);
      }
    }
  }

  private broadcast(msg: LiveEvent) {
    const data = JSON.stringify(msg);
    // ctx.getWebSockets() is runtime-tracked and survives hibernation (an
    // in-memory Set would reset and miss post-hibernate connections).
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // send failed; the runtime prunes dead sockets from getWebSockets()
      }
    }
  }
}
