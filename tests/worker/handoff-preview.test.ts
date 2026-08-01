import { describe, expect, it } from "vitest";
import { HANDOFF_SVGS } from "../../src/handoff";
import { del } from "../../src/handoff/del";
import { playback } from "../../src/handoff/playback";
import { preview } from "../../src/handoff/preview";
import { record } from "../../src/handoff/record";
import { state as stateScript } from "../../src/handoff/state";
import { HANDOFF_CSS } from "../../src/handoff/styles";
import { upload } from "../../src/handoff/upload";

interface TrackStub {
  stopped: boolean;
  stop(): void;
}

interface StreamStub {
  getTracks(): TrackStub[];
}

interface CameraStub {
  hidden: boolean;
  muted: boolean;
  srcObject: StreamStub | null;
  hasAttribute(name: string): boolean;
  pause(): void;
  play(): Promise<void>;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

function createStream(): { stream: StreamStub; tracks: TrackStub[] } {
  const tracks = [
    {
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
    {
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
  ];
  return { stream: { getTracks: () => tracks }, tracks };
}

function createCamera(): CameraStub {
  const attributes = new Set<string>();
  return {
    hidden: true,
    muted: false,
    srcObject: null,
    hasAttribute: (name) => attributes.has(name),
    pause: () => {},
    play: async () => {},
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name) => attributes.add(name),
  };
}

function createPreviewHarness(getUserMedia: () => Promise<StreamStub>) {
  const camera = createCamera();
  const root = { hidden: false };
  let draggableCalls = 0;
  let displayCalls = 0;
  let status = "";
  // The production module is inline JavaScript, so execute the exact source
  // against a deliberately small browser contract.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const runtime = new Function(
    "navigator",
    "root",
    "cam",
    "canManage",
    "state",
    "stream",
    "segCanvas",
    "setStatus",
    "makeCamDraggable",
    "applyCamPos",
    "syncCamDisplay",
    "stopSeg",
    `${preview(HANDOFF_SVGS)}
      return {
        requestPreview: requestPreview,
        stopPreview: stopPreview,
        getStream: function(){ return stream; }
      };
    `,
  )(
    { mediaDevices: { getUserMedia } },
    root,
    camera,
    true,
    "IDLE",
    null,
    null,
    (value: string) => {
      status = value;
    },
    () => {
      draggableCalls += 1;
    },
    () => {},
    () => {
      displayCalls += 1;
    },
    () => {},
  ) as {
    getStream(): StreamStub | null;
    requestPreview(): Promise<StreamStub | null>;
    stopPreview(): void;
  };
  return {
    camera,
    root,
    runtime,
    displayCalls: () => displayCalls,
    draggableCalls: () => draggableCalls,
    status: () => status,
  };
}

describe("handoff live camera preview", () => {
  it("starts one neutral preview and releases every track on close", async () => {
    const media = createStream();
    let requests = 0;
    const harness = createPreviewHarness(async () => {
      requests += 1;
      return media.stream;
    });

    await harness.runtime.requestPreview();
    await harness.runtime.requestPreview();

    expect(requests).toBe(1);
    expect(harness.camera.srcObject).toBe(media.stream);
    expect(harness.camera.hidden).toBe(false);
    expect(harness.camera.muted).toBe(true);
    expect(harness.camera.hasAttribute("data-mirror")).toBe(true);
    expect(harness.camera.hasAttribute("data-rec")).toBe(false);
    expect(harness.draggableCalls()).toBeGreaterThan(0);
    expect(harness.displayCalls()).toBeGreaterThan(0);
    expect(harness.status()).toBe("");

    harness.runtime.stopPreview();

    expect(media.tracks.every((track) => track.stopped)).toBe(true);
    expect(harness.runtime.getStream()).toBeNull();
    expect(harness.camera.srcObject).toBeNull();
    expect(harness.camera.hidden).toBe(true);
    expect(harness.camera.hasAttribute("data-mirror")).toBe(false);
  });

  it("stops a late permission result after the dock has closed", async () => {
    const media = createStream();
    let resolvePermission: ((stream: StreamStub) => void) | undefined;
    const permission = new Promise<StreamStub>((resolve) => {
      resolvePermission = resolve;
    });
    const harness = createPreviewHarness(() => permission);

    const pending = harness.runtime.requestPreview();
    harness.root.hidden = true;
    harness.runtime.stopPreview();
    resolvePermission?.(media.stream);
    await pending;

    expect(media.tracks.every((track) => track.stopped)).toBe(true);
    expect(harness.runtime.getStream()).toBeNull();
    expect(harness.camera.srcObject).toBeNull();
  });

  it("does not let an old permission result clear a newer request", async () => {
    const first = createStream();
    const second = createStream();
    const resolvers: Array<(stream: StreamStub) => void> = [];
    let requests = 0;
    const harness = createPreviewHarness(() => {
      requests += 1;
      return new Promise<StreamStub>((resolve) => resolvers.push(resolve));
    });

    const staleRequest = harness.runtime.requestPreview();
    harness.root.hidden = true;
    harness.runtime.stopPreview();
    harness.root.hidden = false;
    const currentRequest = harness.runtime.requestPreview();
    resolvers[0]?.(first.stream);
    await staleRequest;

    const deduplicatedRequest = harness.runtime.requestPreview();
    expect(requests).toBe(2);
    expect(deduplicatedRequest).toBe(currentRequest);

    resolvers[1]?.(second.stream);
    await currentRequest;
    expect(first.tracks.every((track) => track.stopped)).toBe(true);
    expect(harness.camera.srcObject).toBe(second.stream);
  });

  it("auto-opens recorded handoffs without starting the camera", () => {
    const dock = stateScript(HANDOFF_SVGS);
    const recorder = record(HANDOFF_SVGS);
    const player = playback(HANDOFF_SVGS);
    const uploader = upload(HANDOFF_SVGS);
    const remover = del(HANDOFF_SVGS);

    expect(dock).toContain("render();\n    syncIdlePreview();");
    expect(dock).toContain(
      "if(handoff){ if(window.__oaDock&&canManage)window.__oaDock.open('handoff'); else openDock(); }",
    );
    expect(dock).not.toContain("if(!canManage && handoff)");
    expect(dock).toContain("stopPreview();\n    root.hidden=true;");
    expect(recorder).toContain("requestPreview().then(function(s)");
    expect(recorder).toContain("setRecordingIndicator(true);");
    expect(player).toContain("if(recordStarting)return;");
    expect(player).not.toContain("requestPreview();");
    expect(uploader).not.toContain("requestPreview();");
    expect(remover).toContain("render(); syncIdlePreview();");
  });

  it("mirrors preview without styling it as an active recording", () => {
    expect(HANDOFF_CSS).toContain(
      "#oa-handoff-cam[data-mirror]{--oa-cam-mirror:-1}",
    );
    expect(HANDOFF_CSS).toContain("#oa-handoff-cam[data-rec]{border-color:");
    expect(HANDOFF_CSS).not.toContain(
      "#oa-handoff-cam[data-rec]{--oa-cam-mirror:-1",
    );
    expect(HANDOFF_CSS).toContain(".oa-handoff-speed{min-height:28px;");
    expect(HANDOFF_CSS).toContain("background-image:linear-gradient(");
    expect(HANDOFF_CSS).toContain("transition:background-color .15s");
    expect(HANDOFF_CSS).not.toContain(".oa-handoff-speed:active{transform:");
  });
});
