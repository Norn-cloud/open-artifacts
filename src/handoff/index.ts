// Assembles the host-side handoff dock controller from focused modules.
//
// Each module exports a function that takes the SVG pack (HandoffSvgs) and
// returns the JS body for its concern, as a string. This file concatenates
// them in dependency order and wraps the result in a single IIFE so the
// runtime shares one closure scope exactly as the old inline HANDOFF_SCRIPT
// did — the authoring surface is split, the runtime behavior is identical.
//
// Why strings (not real TS modules): the dock JS is inlined verbatim into the
// host HTML as a <script nonce> (see wrap.ts). There is no build step that
// could bundle a real TS module into an inlined string, so the dock stays a
// string. The split still buys us: small files, per-module `node --check`
// (see tests/worker/handoff-script.test.ts), and readable concerns. tsc still
// won't parse the string bodies, but the syntax gate catches the stray-brace
// class of bug that motivated this refactor.

import { auth } from "./auth";
import { blur } from "./blur";
import { cam } from "./cam";
import { del } from "./del";
import { helpers } from "./helpers";
import { playback } from "./playback";
import { preview } from "./preview";
import { record } from "./record";
import { render } from "./render";
import { share } from "./share";
import { state } from "./state";
import { status } from "./status";
import type { HandoffSvgs } from "./svgs";
import { upload } from "./upload";

export type { HandoffSvgs } from "./svgs";
// Re-export the SVG pack + glyphs so wrap.ts and tests can import them from a
// single entry point. CLOSE_SVG/HANDOFF_SVG are also re-exported for the
// header toggle button and the Live dock's Exit button.
export { CLOSE_SVG, HANDOFF_SVG, HANDOFF_SVGS } from "./svgs";

// Dependency order matters: state declares the shared vars (state, mr, chunks,
// stream, recStart, events, timerInt, playDur, scrubbing, countdownEl, etc.)
// and wires the others; helpers/auth must be defined before state's render
// functions reference them. Within the shared closure, function declarations
// hoist, but `var` declarations must precede their first read at runtime. The
// order below keeps declarations ahead of use.
export function handoffScript(svgs: HandoffSvgs): string {
  // Order: helpers/auth first (pure utilities), then status (setStatus +
  // tickers), then the cam/blur/preview/record/upload/playback/share/delete bodies,
  // then render (the three render fns), then state last — state declares the
  // shared `var`s and the dispatcher + dock-registration logic that wires the
  // others. Function declarations hoist within the IIFE, so call order is not
  // sensitive to physical position; `var` declarations are hoisted to the top
  // of the IIFE scope regardless, so this order is a readability convention,
  // not a runtime requirement. The `node --check` gate catches any syntax
  // error; runtime call order is unchanged from the original inline script.
  const parts = [
    helpers(svgs),
    auth(svgs),
    status(svgs),
    cam(svgs),
    blur(svgs),
    preview(svgs),
    record(svgs),
    upload(svgs),
    playback(svgs),
    share(svgs),
    del(svgs),
    render(svgs),
    state(svgs),
  ];
  return `(function(){\n${parts.join("\n")}\n})();`;
}
