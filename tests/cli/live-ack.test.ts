import { describe, expect, it } from "vitest";
import {
  hasExit,
  hasNewEvent,
  isEventPending,
  waitForEventAck,
} from "../../skills/using-open-artifacts/scripts/lib/live-ack.mjs";

const ev = (id: string, type: string) => ({
  id,
  type,
  leased_until: 0,
  created_at: 0,
});

describe("live-ack: isEventPending / hasExit / hasNewEvent", () => {
  it("isEventPending matches by id", () => {
    const status = { pendingEvents: [ev("ev1", "generate")] };
    expect(isEventPending(status, "ev1")).toBe(true);
    expect(isEventPending(status, "ev2")).toBe(false);
    expect(isEventPending(undefined, "ev1")).toBe(false);
    expect(isEventPending({ pendingEvents: [] }, "ev1")).toBe(false);
  });

  it("hasExit detects an exit event", () => {
    expect(hasExit({ pendingEvents: [ev("e", "exit")] })).toBe(true);
    expect(hasExit({ pendingEvents: [ev("ev1", "generate")] })).toBe(false);
    expect(hasExit(undefined)).toBe(false);
  });

  it("hasNewEvent detects a generate the watcher has not delivered yet", () => {
    const known = new Set(["ev1"]);
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("ev2", "generate")],
    };
    expect(hasNewEvent(status, known)).toBe(true);
    // An in-flight event (already delivered, waiting on its own ack) is not new.
    expect(hasNewEvent(status, new Set(["ev1", "ev2"]))).toBe(false);
    // Without a knownIds set (standalone --wait-ack), no new-event detection.
    expect(hasNewEvent(status, null)).toBe(false);
    expect(hasNewEvent({ pendingEvents: [] }, known)).toBe(false);
  });

  it("hasNewEvent treats a streamed comment as a new event", () => {
    const known = new Set(["ev1"]);
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("c1", "comment")],
    };
    expect(hasNewEvent(status, known)).toBe(true);
    // An already-delivered comment is not new.
    expect(hasNewEvent(status, new Set(["ev1", "c1"]))).toBe(false);
  });

  it("hasNewEvent treats a committed edit as a new event", () => {
    const known = new Set(["ev1"]);
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("e1", "edit")],
    };
    expect(hasNewEvent(status, known)).toBe(true);
    // An already-delivered edit is not new.
    expect(hasNewEvent(status, new Set(["ev1", "e1"]))).toBe(false);
  });
});

describe("live-ack: waitForEventAck", () => {
  it("returns cleared when the event leaves the pending queue", async () => {
    const seq = [
      { pendingEvents: [ev("ev1", "generate")] },
      { pendingEvents: [] },
    ];
    let i = 0;
    const fetchStatus = async () => seq[Math.min(i++, seq.length - 1)];
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 1000,
    });
    expect(result).toBe("cleared");
    expect(i).toBe(2);
  });

  it("returns exit when an exit appears, even if the target is still pending", async () => {
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("ev9", "exit")],
    };
    const fetchStatus = async () => status;
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 1000,
    });
    expect(result).toBe("exit");
  });

  it("returns timeout when the deadline passes with the event still pending", async () => {
    const status = { pendingEvents: [ev("ev1", "generate")] };
    const fetchStatus = async () => status;
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 20,
    });
    expect(result).toBe("timeout");
  });

  it("maxWaitMs=0 probes once and times out if still pending", async () => {
    const status = { pendingEvents: [ev("ev1", "generate")] };
    let calls = 0;
    const fetchStatus = async () => {
      calls++;
      return status;
    };
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 0,
    });
    expect(result).toBe("timeout");
    expect(calls).toBe(1);
  });

  it("swallows a transient fetchStatus error and still resolves cleared", async () => {
    const empty = { pendingEvents: [] };
    let i = 0;
    const fetchStatus = async () => {
      i++;
      if (i === 1) throw new Error("502 bad gateway");
      return empty;
    };
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 1000,
    });
    expect(result).toBe("cleared");
    expect(i).toBe(2);
  });

  it("returns new when a newer generate appears while the target is still pending", async () => {
    const known = new Set(["ev1"]);
    const seq = [
      { pendingEvents: [ev("ev1", "generate"), ev("ev2", "generate")] },
    ];
    const fetchStatus = async () => seq[0];
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 1000,
      knownIds: known,
    });
    expect(result).toBe("new");
  });

  it("does not return new for already-delivered in-flight events", async () => {
    const known = new Set(["ev1", "ev2"]);
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("ev2", "generate")],
    };
    const fetchStatus = async () => status;
    const result = await waitForEventAck(fetchStatus, "ev2", {
      pollIntervalMs: 5,
      maxWaitMs: 20,
      knownIds: known,
    });
    // No undelivered generate exists — waits out the deadline like before.
    expect(result).toBe("timeout");
  });

  it("new-event detection is off without knownIds (standalone --wait-ack)", async () => {
    const status = {
      pendingEvents: [ev("ev1", "generate"), ev("ev2", "generate")],
    };
    const fetchStatus = async () => status;
    const result = await waitForEventAck(fetchStatus, "ev1", {
      pollIntervalMs: 5,
      maxWaitMs: 20,
    });
    expect(result).toBe("timeout");
  });
});
