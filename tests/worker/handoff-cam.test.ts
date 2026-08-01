import { describe, expect, it } from "vitest";
import { HANDOFF_SVGS } from "../../src/handoff";
import { playback } from "../../src/handoff/playback";
import { HANDOFF_CSS } from "../../src/handoff/styles";
import { createCamDragHarness } from "./support/cam-drag-harness";

describe("camera bubble drag runtime", () => {
  it("captures one pointer and ignores concurrent pointer events", () => {
    const harness = createCamDragHarness();
    harness.dispatchDocument(
      "pointerdown",
      harness.pointer(harness.camera, 7, 620, 320),
    );

    expect(harness.camera.capturedPointers.has(7)).toBe(true);
    const offsetBeforeForeignMove =
      harness.camera.style.getPropertyValue("--oa-cam-drag-x");
    harness.dispatchDocument(
      "pointermove",
      harness.pointer(harness.camera, 8, 300, 200),
    );
    harness.dispatchDocument(
      "pointerup",
      harness.pointer(harness.camera, 8, 300, 200),
    );
    expect(harness.camera.style.getPropertyValue("--oa-cam-drag-x")).toBe(
      offsetBeforeForeignMove,
    );
    expect(harness.camera.hasAttribute("data-dragging")).toBe(true);

    harness.dispatchDocument(
      "pointermove",
      harness.pointer(harness.camera, 7, 760, 580),
    );
    harness.dispatchDocument(
      "pointerup",
      harness.pointer(harness.camera, 7, 760, 580),
    );
    expect(harness.camera.capturedPointers.has(7)).toBe(false);
    expect(harness.camera.hasAttribute("data-dragging")).toBe(false);
    expect(harness.camera.style.left).toBe("640px");
    expect(harness.camera.style.top).toBe("440px");
  });

  it("keeps dragging the element where the gesture started", () => {
    const harness = createCamDragHarness();
    harness.dispatchDocument(
      "pointerdown",
      harness.pointer(harness.camera, 3, 620, 320),
    );
    harness.runtime.setBlur(true);
    harness.canvas.hidden = false;

    harness.dispatchDocument(
      "pointermove",
      harness.pointer(harness.canvas, 3, 400, 200),
    );
    expect(harness.camera.style.getPropertyValue("--oa-cam-drag-x")).toBe(
      "-220px",
    );
    expect(harness.canvas.style.getPropertyValue("--oa-cam-drag-x")).toBe("");

    harness.dispatchDocument(
      "pointerup",
      harness.pointer(harness.canvas, 3, 400, 200),
    );
    expect(harness.camera.style.left).toBe("380px");
    expect(harness.camera.style.top).toBe("180px");
    expect(harness.camera.hasAttribute("data-dragging")).toBe(false);
  });

  it("clamps a persisted position back into the current viewport", () => {
    const harness = createCamDragHarness({ left: 900, top: 700 });

    expect(harness.camera.style.left).toBe("640px");
    expect(harness.camera.style.top).toBe("440px");
    expect(JSON.parse(harness.storage.get("oa-handoff-cam-pos") ?? "")).toEqual(
      { left: 640, top: 440 },
    );
  });

  it("reclamps the saved position after playback reveals the video", () => {
    expect(playback(HANDOFF_SVGS)).toContain(
      "cam.hidden=false; applyCamPos();",
    );
  });

  it("composes drag translation with the preview mirror", () => {
    expect(HANDOFF_CSS).toContain(
      "transform:translate3d(var(--oa-cam-drag-x),var(--oa-cam-drag-y),0) scaleX(var(--oa-cam-mirror))",
    );
    expect(HANDOFF_CSS).toContain(
      "#oa-handoff-cam[data-mirror]{--oa-cam-mirror:-1",
    );
    expect(HANDOFF_CSS).not.toContain(
      "#oa-handoff-cam[data-mirror]{transform:scaleX(-1)",
    );
    expect(HANDOFF_CSS).toContain(
      "#oa-handoff-cam-canvas[data-dragging]{cursor:grabbing",
    );
  });
});
