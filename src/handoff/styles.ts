// The handoff dock CSS - unified with the Live dock's visual language.
// Inlined into the host page's <style> at serve time (see wrap.ts hostShell).
//
// DIRECTION CONTRACT
// THESIS: One floating bar, always expanded. The dock refuses the old
//   strip-inline posture (hover-expand + pinned chevron): every control is
//   visible whenever the dock is open, and transient status floats above the
//   bar instead of owning a row inside it.
// OWN-WORLD: The Live dock's chrome - 14px radius, hairline border,
//   backdrop blur(14px) saturate(120%) over a 96% --oa-bg panel, the shared
//   30px .oa-dock-btn ghost-button anatomy, mono only for measurement
//   (timer, timecode, speed). Recording truth (rec-dot, cam ring, the
//   frame's red edge) keeps --oa-danger; interaction keeps --oa-accent.
// STORY: The creator sees one instrumented bar: terminal action left
//   (Record/Stop/Pause), status cluster next (rec-dot + timer / timecode),
//   utilities right (Blur, speed, Copy link), Exit/Discard pinned far right.
// FIRST VIEWPORT: A bottom-center pill over the dimmed artifact; during
//   capture the cam bubble wears the same border/shadow language with a
//   danger ring; the 3-2-1 countdown is a mono numeral on the same blurred
//   veil. FORM: assigned direction "unify with Live dock" (user-committed);
//   no concept roll - the incumbent Live chrome is the reference world.
//
// Uses the engine's --oa-* identity (the dock runs in the engine, not just
// coda0, so it must NOT hardcode coda0's #050505/#2e6bff). Class/ID names
// stay stable where tests assert them (oa-handoff-toggle / oa-handoff-root /
// oa-handoff-cam-canvas / oa-handoff-data).
export const HANDOFF_CSS = `
.oa-handoff-toggle{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid transparent;background:transparent;color:var(--oa-muted);border-radius:6px;cursor:pointer;transition:color .15s ease-out,background .15s ease-out;flex-shrink:0}
.oa-handoff-toggle::before{content:"";position:absolute;inset:-6px}
.oa-handoff-toggle:focus-visible{outline:none;box-shadow:var(--oa-focus-ring)}
.oa-handoff-toggle:active{transform:translateY(1px)}
.oa-handoff-toggle svg{display:block;width:16px;height:16px}
.oa-handoff-toggle[aria-expanded="true"]{color:var(--oa-accent);background:color-mix(in oklab,var(--oa-accent),transparent 88%)}
@media (hover:hover) and (pointer:fine){.oa-handoff-toggle:hover{color:var(--oa-fg);background:color-mix(in oklab,var(--oa-fg),transparent 90%)}}
#oa-handoff-root[hidden]{display:none}
#oa-handoff-root{position:fixed;inset:0;z-index:2147483645;pointer-events:none;font-family:var(--oa-font);font-size:.8rem}
/* The dock: the Live dock's chrome verbatim - 14px radius, hairline border,
   backdrop blur over a near-opaque panel, the paired drop + inset-top
   shadows. One always-expanded controls row; width hugs the contents. */
#oa-handoff-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:1rem;max-width:calc(100vw - 1.5rem);display:flex;align-items:center;padding:.45rem .55rem;border-radius:14px;border:1px solid color-mix(in oklab,var(--oa-border),var(--oa-fg) 4%);background:color-mix(in oklab,var(--oa-bg),transparent 4%);backdrop-filter:blur(14px) saturate(120%);-webkit-backdrop-filter:blur(14px) saturate(120%);box-shadow:0 8px 32px -4px color-mix(in oklab,var(--oa-fg),transparent 86%),0 1px 0 0 color-mix(in oklab,var(--oa-fg),transparent 92%) inset;pointer-events:auto;z-index:2147483645;--oa-mono:var(--oa-font-mono,ui-monospace,Menlo,Consolas,monospace)}
/* The floating status pill: transient messages ("Saving handoff…", "Mic
   muted by system") surface ABOVE the bar so they never shift the controls
   row. Same chrome family, smaller radius, centered over the dock. */
#oa-handoff-status{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(1rem + 3.6rem);max-width:calc(100vw - 2rem);display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:8px;border:1px solid color-mix(in oklab,var(--oa-border),var(--oa-fg) 4%);background:color-mix(in oklab,var(--oa-bg),transparent 4%);backdrop-filter:blur(14px) saturate(120%);-webkit-backdrop-filter:blur(14px) saturate(120%);box-shadow:0 6px 24px -4px color-mix(in oklab,var(--oa-fg),transparent 88%);color:var(--oa-fg);font-size:.78rem;line-height:1.4;pointer-events:auto;z-index:2147483645;animation:oa-handoff-status-in .18s ease-out;white-space:nowrap}
#oa-handoff-status[hidden]{display:none}
@keyframes oa-handoff-status-in{from{opacity:0;transform:translate(-50%,4px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){#oa-handoff-status{animation:none}}
#oa-handoff-status .oa-handoff-spin{display:inline-block;width:11px;height:11px;border:2px solid color-mix(in oklab,var(--oa-fg),transparent 70%);border-top-color:var(--oa-accent);border-radius:50%;animation:oa-handoff-spin .7s linear infinite;vertical-align:-1px;margin-right:.3rem;flex:none}
@keyframes oa-handoff-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#oa-handoff-status .oa-handoff-spin{animation:none}}
/* The controls row: one flex line of .oa-dock-btn clusters separated by 1px
   vertical rules. The primary group grows (flex:1 1 auto) so the scrubber
   fills the available width. */
#oa-handoff-controls{display:flex;align-items:center;gap:.35rem;flex-wrap:nowrap;min-width:0}
.oa-handoff-group{display:inline-flex;align-items:center;gap:.35rem;flex-shrink:0;min-width:0}
.oa-handoff-group--primary{flex:1 1 auto}
.oa-handoff-divider{width:1px;align-self:stretch;background:color-mix(in oklab,var(--oa-border),var(--oa-fg) 8%);margin:0 .1rem;flex-shrink:0}
/* The status cluster: rec-dot + timer while RECORDING, timecode while
   PLAYING, play glyph + duration in IDLE-with-handoff. Mono, tabular,
   selectable so a user can copy the time. Sits inline in the row. */
.oa-handoff-cluster{display:inline-flex;align-items:center;gap:.35rem;padding:0 .35rem 0 .15rem;color:var(--oa-muted);font-family:var(--oa-mono);font-size:.72rem;font-variant-numeric:tabular-nums;flex-shrink:0;user-select:text;-webkit-user-select:text}
.oa-handoff-cluster svg{display:block;width:12px;height:12px;flex:none}
.oa-handoff-timer{color:var(--oa-fg)}
.oa-handoff-rec-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--oa-danger);animation:oa-handoff-blink 1s infinite;flex:none}
@keyframes oa-handoff-blink{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.oa-handoff-rec-dot{animation:none}}
.oa-handoff-dur{flex-shrink:0}
.oa-handoff-time{color:var(--oa-fg)}
/* Scrubber: the input is 16px tall (matches the thumb) so the thumb centers
   vertically without margin hacks; the 4px visual track is the runnable
   track pseudo-element, centered in the 16px input. */
.oa-handoff-scrub-wrap{position:relative;flex:1;min-width:80px;display:flex;align-items:center;height:16px}
.oa-handoff-scrub{width:100%;height:16px;-webkit-appearance:none;appearance:none;background:transparent;outline:none;cursor:pointer;margin:0}
.oa-handoff-scrub::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--oa-border)}
.oa-handoff-scrub::-moz-range-track{height:4px;border-radius:2px;background:var(--oa-border)}
.oa-handoff-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--oa-accent);border:0;margin-top:-6px}
.oa-handoff-scrub::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--oa-accent);border:0}
.oa-handoff-scrub:focus-visible{outline:none;box-shadow:var(--oa-focus-ring);border-radius:4px}
/* Event-derived markers on the scrubber (clicks + scroll-stops). */
.oa-handoff-mark{position:absolute;top:50%;width:3px;height:10px;transform:translate(-1.5px,-50%);background:color-mix(in oklab,var(--oa-fg),transparent 55%);pointer-events:auto;cursor:pointer;border-radius:1px}
.oa-handoff-mark::before{content:"";position:absolute;inset:-5px -4px}
.oa-handoff-mark:hover{background:var(--oa-accent)}
/* Camera bubble: same border/shadow language as the dock - hairline ring
   with a fg tint, layered drop shadow. While capturing (data-rec) the ring
   shifts to danger and a small notch flags live capture; the selfie mirror
   flip is preserved. */
#oa-handoff-cam{position:fixed;right:1rem;bottom:5.5rem;width:min(180px,26vw);aspect-ratio:1/1;border-radius:50%;border:2px solid color-mix(in oklab,var(--oa-border),var(--oa-fg) 10%);background:#000;object-fit:cover;pointer-events:auto;box-shadow:0 8px 24px -6px color-mix(in oklab,var(--oa-fg),transparent 78%),0 0 0 1px color-mix(in oklab,var(--oa-bg),transparent 20%);z-index:2147483646;cursor:grab;touch-action:none;user-select:none}
#oa-handoff-cam[hidden]{display:none}
#oa-handoff-cam[data-rec]{transform:scaleX(-1);border-color:color-mix(in oklab,var(--oa-danger),transparent 40%)}
#oa-handoff-cam[data-rec]::after{content:"";position:absolute;top:8px;left:8px;width:7px;height:7px;border-radius:50%;background:var(--oa-danger);box-shadow:0 0 0 2px var(--oa-bg)}
#oa-handoff-cam-canvas{position:fixed;right:1rem;bottom:5.5rem;width:min(180px,26vw);aspect-ratio:1/1;border-radius:50%;border:2px solid color-mix(in oklab,var(--oa-border),var(--oa-fg) 10%);background:#000;object-fit:cover;pointer-events:auto;box-shadow:0 8px 24px -6px color-mix(in oklab,var(--oa-fg),transparent 78%),0 0 0 1px color-mix(in oklab,var(--oa-bg),transparent 20%);z-index:2147483646;cursor:grab;touch-action:none;user-select:none}
#oa-handoff-cam-canvas[hidden]{display:none}
#oa-handoff-cam[data-dragging]{cursor:grabbing}
.oa-handoff-mic{display:inline-flex;align-items:center;gap:.3rem;flex-shrink:0;width:36px;height:18px}
.oa-handoff-mic-bar{display:block;width:100%;height:4px;border-radius:2px;background:color-mix(in oklab,var(--oa-fg),transparent 82%);transform:scaleX(.02);transform-origin:left center;transition:transform .08s linear}
.oa-handoff-mic-bar.oa-handoff-mic-silent{background:color-mix(in oklab,var(--oa-danger),transparent 60%)}
/* Countdown: the same translucent veil + backdrop blur as the dock backdrop;
   the numeral is a light-weight mono display, accent on the final beat. */
#oa-handoff-countdown{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483647;pointer-events:none;--oa-mono:var(--oa-font-mono,ui-monospace,Menlo,Consolas,monospace);font-family:var(--oa-mono);font-size:7rem;font-weight:300;color:var(--oa-fg);background:color-mix(in oklab,var(--oa-bg),transparent 30%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#oa-handoff-countdown[data-on]{display:flex}
#oa-handoff-countdown[data-num="1"]{color:var(--oa-accent)}
@keyframes oa-handoff-pop{0%{transform:scale(.6);opacity:0}30%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:1}}
#oa-handoff-countdown[data-on]>*{animation:oa-handoff-pop .5s ease-out}
@media (prefers-reduced-motion:reduce){#oa-handoff-countdown[data-on]>*{animation:none}}
.oa-handoff-speed{min-height:28px;padding:.1rem 1.1rem .1rem .4rem;border:1px solid var(--oa-border);border-radius:6px;background:var(--oa-bg);color:var(--oa-fg);font-family:var(--oa-mono);font-size:.7rem;line-height:1.4;cursor:pointer;-webkit-appearance:none;appearance:none;flex-shrink:0}
.oa-handoff-speed:focus-visible{outline:none;border-color:var(--oa-accent);box-shadow:var(--oa-focus-ring)}
#oa-handoff-share.oa-dock-btn--copied{color:var(--oa-accent);border-color:color-mix(in oklab,var(--oa-accent),transparent 60%)}
/* The Play/Pause toggle swaps both icon and label; "Pause" is wider than
   "Play" and the dock hugs its contents, so the dock would jump width on
   every toggle. Pin the label to the wider ("Pause") width so the button
   - and therefore the dock - is width-stable across the two states. The
   min-width reserves space; keep the label centered so the icon+label
   pair stays visually centered as the text swaps. */
#oa-handoff-pp .oa-dock-label{min-width:5ch;text-align:center}
/* Blur toggle: unmistakable on/off - accent-filled when pressed. The hover
   rule preserves the accent fill when on (the base .oa-dock-btn:hover is
   excluded for --blur in wrap.ts so it can't override with a --fg tint). */
.oa-dock-btn--blur[aria-pressed="true"]{background:var(--oa-accent);border-color:var(--oa-accent);color:var(--oa-accent-on)}
@media (hover:hover) and (pointer:fine){.oa-dock-btn--blur:hover{opacity:1;background:color-mix(in oklab,var(--oa-fg),transparent 94%)}.oa-dock-btn--blur[aria-pressed="true"]:hover{background:var(--oa-accent-hover,var(--oa-accent))}}
/* Discard: danger on hover so it reads as "discard the recording". */
.oa-dock-btn--discard{color:var(--oa-muted)}
@media (hover:hover) and (pointer:fine){.oa-dock-btn--discard:hover{color:var(--oa-danger);background:color-mix(in oklab,var(--oa-danger),transparent 90%);border-color:color-mix(in oklab,var(--oa-danger),transparent 60%)}}
/* Narrow viewport: collapse secondary control labels to icons-only so the
   row fits without clipping. The primary action keeps its label (it's the
   one that matters); secondary groups (Blur, Discard, speed, Exit) drop to
   icon + aria-label. */
@media (max-width:380px){#oa-handoff-controls .oa-handoff-group:not(.oa-handoff-group--primary) .oa-dock-label{display:none}}
`;
