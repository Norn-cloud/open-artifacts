import { describe, expect, it } from "vitest";
import { HANDOFF_SVGS } from "../../src/handoff";
import { playback } from "../../src/handoff/playback";

interface PlaybackCamera {
  currentTime: number;
  hidden: boolean;
  loadCalls: number;
  muted: boolean;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  onloadedmetadata: (() => void) | null;
  ontimeupdate: (() => void) | null;
  paused: boolean;
  playCalls: number;
  playbackRate: number;
  src: string;
  srcObject: null;
  volume: number;
  load(): void;
  play(): Promise<void>;
}

function createCamera(): PlaybackCamera {
  return {
    currentTime: 0,
    hidden: true,
    loadCalls: 0,
    muted: false,
    onended: null,
    onerror: null,
    onloadedmetadata: null,
    ontimeupdate: null,
    paused: true,
    playCalls: 0,
    playbackRate: 1,
    src: "",
    srcObject: null,
    volume: 1,
    load() {
      this.loadCalls += 1;
    },
    async play() {
      this.playCalls += 1;
      this.paused = false;
    },
  };
}

function createPlaybackHarness() {
  const camera = createCamera();
  const createdMediaTypes: string[] = [];
  const fetchRequests: { cache?: string; url: string }[] = [];
  const frameMessages: unknown[] = [];
  const fetchMedia = (input: string, init?: RequestInit) => {
    fetchRequests.push({ cache: init?.cache, url: input });
    if (input.includes("/events?")) {
      return Promise.resolve(Response.json([]));
    }
    return Promise.resolve(
      new Response(
        new Blob(["valid-webm"], {
          type: "video/webm;codecs=vp8,opus",
        }),
      ),
    );
  };
  // Playback ships as inline browser JavaScript, so exercise the exact source
  // with the smallest media-element contract needed by startPlay.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const runtime = new Function(
    "handoff",
    "recordStarting",
    "stopPreview",
    "state",
    "playDur",
    "scrubbing",
    "render",
    "setStatus",
    "window",
    "frame",
    "fetch",
    "playUrl",
    "URL",
    "document",
    "cam",
    "setBubbleFlag",
    "setRecordingIndicator",
    "makeCamDraggable",
    "applyCamPos",
    "camBlur",
    "startSeg",
    "stopSeg",
    "loadSpeed",
    "controls",
    "toFrame",
    "clearPreviewElement",
    "syncIdlePreview",
    "el",
    "fmt",
    "normalizeMediaBlob",
    "ID",
    `${playback(HANDOFF_SVGS)}
      return { startPlay: startPlay };
    `,
  )(
    {
      durationMs: 1000,
      createdAt: "2026-08-01T08:00:00.000Z",
      hasAudio: true,
      hasBlur: false,
      id: "h1",
      mediaType: "video/webm;codecs=vp8,opus",
      version: 1,
    },
    false,
    () => {},
    "IDLE",
    0,
    false,
    () => {},
    () => {},
    { __oaViewedVersion: 1 },
    {},
    fetchMedia,
    null,
    {
      createObjectURL: (blob: Blob) => {
        createdMediaTypes.push(blob.type);
        return "blob:recording";
      },
      revokeObjectURL: () => {},
    },
    { getElementById: () => null },
    camera,
    () => {},
    () => {},
    () => {},
    () => {},
    false,
    () => {},
    () => {},
    () => 1,
    { querySelector: () => null },
    (message: unknown) => frameMessages.push(message),
    () => {},
    () => {},
    () => ({ style: {}, setAttribute: () => {} }),
    () => "0:00",
    (blob: Blob) => {
      const baseType = blob.type.split(";", 1)[0] ?? blob.type;
      return blob.slice(0, blob.size, baseType);
    },
    "artifact-1",
  ) as { startPlay(id: string): void };
  return {
    camera,
    createdMediaTypes,
    fetchRequests,
    frameMessages,
    runtime,
  };
}

async function flushPlaybackFetch(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("handoff media playback", () => {
  it("bypasses stale media and waits for metadata before replay", async () => {
    const harness = createPlaybackHarness();

    harness.runtime.startPlay("h1");
    await flushPlaybackFetch();

    expect(harness.camera.src).toBe("blob:recording");
    expect(harness.createdMediaTypes).toEqual(["video/webm"]);
    expect(harness.fetchRequests).toEqual([
      {
        cache: "no-store",
        url: "/api/artifacts/artifact-1/handoffs/h1/events?r=2026-08-01T08%3A00%3A00.000Z",
      },
      {
        cache: "no-store",
        url: "/api/artifacts/artifact-1/handoffs/h1/media?r=2026-08-01T08%3A00%3A00.000Z",
      },
    ]);
    expect(harness.camera.loadCalls).toBe(1);
    expect(harness.camera.playCalls).toBe(0);
    expect(harness.frameMessages).toEqual([]);

    harness.camera.onloadedmetadata?.();
    await Promise.resolve();

    expect(harness.camera.playCalls).toBe(1);
    expect(harness.frameMessages).toEqual([
      { durationMs: 1000, events: [], type: "oa:handoff:play" },
    ]);
  });
});
