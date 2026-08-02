import { describe, expect, it } from "vitest";
import {
  FRAME_HANDOFF_PLAY_SCRIPT,
  FRAME_HANDOFF_RECORD_SCRIPT,
} from "../../src/wrap";

interface MessageEventStub {
  data: { type: string; events?: unknown[] };
  source: object;
}

interface ViewportOptions {
  height?: number;
  scrollHeight?: number;
  scrollWidth?: number;
  width?: number;
}

function executeRecordShim(
  scrollX = 0,
  scrollY = 0,
  options: ViewportOptions = {},
) {
  const sent: Record<string, unknown>[] = [];
  const parent = {};
  const messageListeners: Array<(event: MessageEventStub) => void> = [];
  const frameListeners = new Map<string, (event?: unknown) => void>();
  const documentListeners = new Map<
    string,
    (event: Record<string, number>) => void
  >();
  const width = options.width ?? 1440;
  const height = options.height ?? 900;
  const scrollWidth = options.scrollWidth ?? width;
  const scrollHeight = options.scrollHeight ?? height;
  const windowStub = {
    __oaSend: (message: Record<string, unknown>) => sent.push(message),
    addEventListener: (
      type: string,
      listener: (event: MessageEventStub) => void,
    ) => {
      if (type === "message") messageListeners.push(listener);
      else
        frameListeners.set(
          type,
          listener as unknown as (event?: unknown) => void,
        );
    },
    innerHeight: height,
    innerWidth: width,
    parent,
    removeEventListener: () => {},
    scrollX,
    scrollY,
  };
  const documentStub = {
    addEventListener: (
      type: string,
      listener: (event: Record<string, number>) => void,
    ) => documentListeners.set(type, listener),
    body: { scrollHeight, scrollWidth },
    documentElement: {
      classList: { add: () => {}, remove: () => {} },
      clientHeight: height,
      clientWidth: width,
      scrollHeight,
      scrollWidth,
    },
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
    fireClick: (x: number, y: number) =>
      documentListeners.get("click")?.({ clientX: x, clientY: y }),
    fireScroll: () => frameListeners.get("scroll")?.(),
    sent,
    windowStub,
  };
}

function executePlayShim(options: ViewportOptions = {}) {
  const parent = {};
  const messageListeners: Array<(event: MessageEventStub) => void> = [];
  const scrolls: Array<[number, number]> = [];
  const elements: Array<{
    className: string;
    id: string;
    style: Record<string, string>;
  }> = [];
  let pendingFrame: (() => void) | null = null;
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const scrollWidth = options.scrollWidth ?? width;
  const scrollHeight = options.scrollHeight ?? 2000;
  const makeElement = () => {
    const element = {
      appendChild: () => {},
      className: "",
      id: "",
      parentNode: null,
      style: {} as Record<string, string>,
    };
    elements.push(element);
    return element;
  };
  const frame = (callback: () => void) => {
    pendingFrame = callback;
    return 1;
  };
  const documentBody = {
    appendChild: (element: (typeof elements)[number]) => {
      if (!elements.includes(element)) elements.push(element);
    },
  };
  const documentElement = {
    appendChild: () => {},
    clientHeight: height,
    clientWidth: width,
    scrollHeight,
    scrollWidth,
    style: {} as Record<string, string>,
  };
  const documentStub = {
    addEventListener: () => {},
    body: documentBody,
    createElement: makeElement,
    documentElement,
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
    innerHeight: height,
    innerWidth: width,
    parent,
    scrollTo: (x: number, y: number) => scrolls.push([x, y]),
  };
  // Keep the media timeline pending until the test explicitly advances it.
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
    frame,
    () => {},
    () => 1,
  );
  return {
    advance: () => {
      const callback = pendingFrame;
      pendingFrame = null;
      callback?.();
    },
    elements,
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
    const harness = executeRecordShim(48, 920, {
      height: 900,
      scrollHeight: 2820,
      scrollWidth: 2880,
      width: 1440,
    });

    harness.arm();

    expect(harness.sent[0]).toMatchObject({
      type: "oa:handoff:event",
      t: 0,
      kind: "scroll",
      nx: 0,
      ny: 0,
      nsx: 48 / 1440,
      nsy: 920 / 1920,
      sx: 48,
      sy: 920,
      sxMax: 1440,
      syMax: 1920,
      vh: 900,
      vw: 1440,
    });
  });

  it("records normalized pointer and scroll coordinates for each interaction", () => {
    const harness = executeRecordShim(100, 400, {
      height: 900,
      scrollHeight: 2700,
      scrollWidth: 3200,
      width: 1600,
    });

    harness.arm();
    harness.fireClick(1200, 450);

    expect(harness.sent).toContainEqual(
      expect.objectContaining({
        kind: "click",
        nx: 0.75,
        ny: 0.5,
        nsx: 100 / 1600,
        nsy: 400 / 1800,
        sxMax: 1600,
        syMax: 1800,
        vw: 1600,
        vh: 900,
      }),
    );
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

  it("maps normalized pointer and scroll positions to a different viewport", () => {
    const harness = executePlayShim({
      height: 844,
      scrollHeight: 3844,
      scrollWidth: 780,
      width: 390,
    });

    harness.play([
      {
        t: 0,
        kind: "scroll",
        nsx: 0.5,
        nsy: 1500 / 2700,
        sx: 720,
        sy: 1500,
        sxMax: 1440,
        syMax: 2700,
        vw: 1440,
        vh: 900,
      },
      {
        t: 0,
        kind: "move",
        nx: 0.75,
        ny: 0.5,
        x: 1080,
        y: 450,
        vw: 1440,
        vh: 900,
      },
    ]);
    harness.advance();

    expect(harness.scrolls[0]).toEqual([195, (3000 * 1500) / 2700]);
    expect(
      harness.elements.find((element) => element.id === "oa-handoff-cursor")
        ?.style.transform,
    ).toBe("translate(292.5px,422px)");
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
