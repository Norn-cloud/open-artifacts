import { describe, expect, it } from "vitest";
import {
  FRAME_HANDOFF_PLAY_SCRIPT,
  FRAME_HANDOFF_RECORD_SCRIPT,
} from "../../src/wrap";

interface MessageEventStub {
  data: { type: string; events?: unknown[] };
  source: object;
}

function executeRecordShim(scrollX = 0, scrollY = 0) {
  const sent: Record<string, unknown>[] = [];
  const parent = {};
  const messageListeners: Array<(event: MessageEventStub) => void> = [];
  const frameListeners = new Map<string, () => void>();
  const windowStub = {
    __oaSend: (message: Record<string, unknown>) => sent.push(message),
    addEventListener: (
      type: string,
      listener: (event: MessageEventStub) => void,
    ) => {
      if (type === "message") messageListeners.push(listener);
      else frameListeners.set(type, listener as () => void);
    },
    parent,
    removeEventListener: () => {},
    scrollX,
    scrollY,
  };
  const documentStub = {
    addEventListener: () => {},
    documentElement: { classList: { add: () => {}, remove: () => {} } },
    removeEventListener: () => {},
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(
    "window",
    "document",
    "performance",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    FRAME_HANDOFF_RECORD_SCRIPT,
  )(
    windowStub,
    documentStub,
    { now: () => 100 },
    () => 1,
    () => {},
  );
  return {
    arm: () =>
      messageListeners[0]?.({
        data: { type: "oa:handoff:record:arm" },
        source: parent,
      }),
    fireScroll: () => frameListeners.get("scroll")?.(),
    sent,
    windowStub,
  };
}

function executePlayShim() {
  const parent = {};
  const messageListeners: Array<(event: MessageEventStub) => void> = [];
  const scrolls: Array<[number, number]> = [];
  const makeElement = () => ({
    appendChild: () => {},
    className: "",
    id: "",
    parentNode: null,
    style: {} as Record<string, string>,
  });
  const documentStub = {
    addEventListener: () => {},
    body: { appendChild: () => {} },
    createElement: makeElement,
    documentElement: {
      appendChild: () => {},
      style: {} as Record<string, string>,
    },
    head: { appendChild: () => {} },
    removeEventListener: () => {},
  };
  const windowStub = {
    __oaSend: () => {},
    addEventListener: (
      type: string,
      listener: (event: MessageEventStub) => void,
    ) => {
      if (type === "message") messageListeners.push(listener);
    },
    parent,
    scrollTo: (x: number, y: number) => scrolls.push([x, y]),
  };
  // Keep rAF pending: the assertion proves the reset happens before the first
  // playback frame rather than eventually inside the event loop.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(
    "window",
    "document",
    "performance",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "setTimeout",
    FRAME_HANDOFF_PLAY_SCRIPT,
  )(
    windowStub,
    documentStub,
    { now: () => 100 },
    () => 1,
    () => {},
    () => 1,
  );
  return {
    play: (events: unknown[]) =>
      messageListeners[0]?.({
        data: { type: "oa:handoff:play", events },
        source: parent,
      }),
    scrolls,
  };
}

describe("handoff scroll timeline", () => {
  it("records the viewport position as the first t=0 event", () => {
    const harness = executeRecordShim(48, 920);

    harness.arm();

    expect(harness.sent[0]).toEqual({
      type: "oa:handoff:event",
      t: 0,
      kind: "scroll",
      x: 0,
      y: 0,
      sx: 48,
      sy: 920,
    });
  });

  it("keeps recording later page scroll positions", () => {
    const harness = executeRecordShim(0, 120);
    harness.arm();
    harness.windowStub.scrollX = 20;
    harness.windowStub.scrollY = 640;

    harness.fireScroll();

    expect(harness.sent).toContainEqual(
      expect.objectContaining({ kind: "scroll", sx: 20, sy: 640 }),
    );
  });

  it("resets to the recorded start before the first playback frame", () => {
    const harness = executePlayShim();

    harness.play([
      { t: 0, kind: "scroll", sx: 32, sy: 760 },
      { t: 500, kind: "scroll", sx: 32, sy: 1100 },
    ]);

    expect(harness.scrolls[0]).toEqual([32, 760]);
  });

  it("uses the earliest scroll as a best-effort start for old recordings", () => {
    const harness = executePlayShim();

    harness.play([
      { t: 100, kind: "move", x: 10, y: 20 },
      { t: 450, kind: "scroll", sx: 0, sy: 480 },
    ]);

    expect(harness.scrolls[0]).toEqual([0, 480]);
  });
});
