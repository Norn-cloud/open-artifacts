import { describe, expect, it } from "vitest";
import { HANDOFF_SVGS, handoffScript } from "../../src/handoff";
import { auth } from "../../src/handoff/auth";
import { blur } from "../../src/handoff/blur";
import { cam } from "../../src/handoff/cam";
import { del } from "../../src/handoff/del";
import { helpers } from "../../src/handoff/helpers";
import { playback } from "../../src/handoff/playback";
import { preview } from "../../src/handoff/preview";
import { record } from "../../src/handoff/record";
import { render } from "../../src/handoff/render";
import { share } from "../../src/handoff/share";
import { state } from "../../src/handoff/state";
import { status } from "../../src/handoff/status";
import { upload } from "../../src/handoff/upload";

// Syntax gate for the inlined handoff dock script. The dock is shipped as a
// JS string (see src/handoff/index.ts), so tsc cannot parse its body — a stray
// brace or unbalanced quote ships undetected and breaks the toggle at runtime
// (this exact bug shipped once). This test parses the concatenated script and
// each module with `new Function`, which performs a full parse without
// executing, catching the syntax-error class of bug at test time.
// tests/cli/handoff-syntax.test.ts runs `node --check` for precise line
// numbers.
//
// It also asserts the concatenated script still contains every oa:handoff:*
// message the frame shims rely on, so a refactor can't silently drop a message
// the play/record shim sends or handles.

describe("handoff dock script syntax gate", () => {
  const modules: Array<[string, (s: typeof HANDOFF_SVGS) => string]> = [
    ["helpers", helpers],
    ["auth", auth],
    ["status", status],
    ["cam", cam],
    ["blur", blur],
    ["record", record],
    ["upload", upload],
    ["playback", playback],
    ["preview", preview],
    ["share", share],
    ["del", del],
    ["render", render],
    ["state", state],
  ];

  it("the concatenated script parses (no stray braces / unbalanced quotes)", () => {
    const js = handoffScript(HANDOFF_SVGS);
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      new Function(js);
    }).not.toThrow();
  });

  it("each module body parses on its own", () => {
    for (const [name, fn] of modules) {
      const body = fn(HANDOFF_SVGS);
      // Wrap each module's bare body fragment in an IIFE so new Function sees
      // a complete function scope, exactly as it lands inside the concatenated
      // IIFE at runtime. Asserts no syntax error in any single module.
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        new Function(`(function(){${body}\n})();`);
      }, `module ${name} should parse`).not.toThrow();
    }
  });

  it("the concatenated script contains every oa:handoff:* frame message", () => {
    const js = handoffScript(HANDOFF_SVGS);
    // Host -> frame messages the frame shims receive.
    for (const type of [
      "oa:handoff:record:arm",
      "oa:handoff:record:disarm",
      "oa:handoff:play",
      "oa:handoff:pause",
      "oa:handoff:resume",
      "oa:handoff:seek",
      "oa:handoff:stop",
    ]) {
      expect(js).toContain(type);
    }
    // Frame -> host message the host listener buffers during RECORDING.
    expect(js).toContain("oa:handoff:event");
  });

  it("the concatenated script is non-empty and wrapped in one IIFE", () => {
    const js = handoffScript(HANDOFF_SVGS);
    expect(js.length).toBeGreaterThan(1000);
    expect(js.startsWith("(function(){")).toBe(true);
    expect(js.endsWith("})();")).toBe(true);
  });
});
