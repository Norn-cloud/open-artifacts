// Trusted inline-SVG glyphs for the handoff (and shared Live) docks. Each is a
// single-line SVG string with `fill="currentColor"` so it inherits the
// surrounding text color. Inlined into the dock via JSON.stringify(...) so the
// quotes are escaped at serve time. Kept verbatim from the original wrap.ts
// constants so no visual changes; this file is the single source of truth.

// Shared with the Live dock (the Exit button in both docks uses this X).
export const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M18 6 6 18M6 6l12 12"/></svg>';

// The handoff toggle in the service header (a video camera).
export const HANDOFF_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>';

export const RECORD_DOT_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6"/></svg>';

export const STOP_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

export const PLAY_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>';

// Pause glyph for the playback toggle (two rounded bars).
export const PAUSE_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

export const SHARE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

// Background-blur toggle glyph (concentric dashed circles suggest a blur field).
export const BLUR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/></svg>';

// Discard (trash) glyph - "discard this recording", not "cancel blur".
export const DISCARD_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

// The SVG pack passed to each handoff module so they can inline the glyphs via
// JSON.stringify(svgs.<name>). Kept as a record so the call sites read
// ${JSON.stringify(svgs.close)} etc., mirroring the old ${JSON.stringify(CLOSE_SVG)}.
export interface HandoffSvgs {
  close: string;
  handoff: string;
  recordDot: string;
  stop: string;
  play: string;
  pause: string;
  share: string;
  blur: string;
  discard: string;
}

export const HANDOFF_SVGS: HandoffSvgs = {
  close: CLOSE_SVG,
  handoff: HANDOFF_SVG,
  recordDot: RECORD_DOT_SVG,
  stop: STOP_SVG,
  play: PLAY_SVG,
  pause: PAUSE_SVG,
  share: SHARE_SVG,
  blur: BLUR_SVG,
  discard: DISCARD_SVG,
};
