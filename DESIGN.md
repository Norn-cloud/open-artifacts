---
name: Open Artifacts
description: Quiet systems-grade viewer chrome - one accent, both themes, Figma/Linear restraint; follows the artifact's palette via the --oa-* bridge.
colors:
  bg: "#ffffff"
  surface: "#f8f8f8"
  surface-2: "#f1f1f3"
  fg: "#18181b"
  fg-2: "#3f3f46"
  muted: "#71717a"
  border: "#e4e4e7"
  border-strong: "#d4d4d8"
  accent: "#6457f0"
  accent-on: "#ffffff"
  accent-hover: "color-mix(in oklab, #6457f0, #18181b 8%)"
  accent-active: "color-mix(in oklab, #6457f0, #18181b 14%)"
  accent-soft: "color-mix(in oklab, #6457f0, transparent 88%)"
  danger: "#b42318"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  button: "6px"
  menu: "4px"
  item: "8px"
  badge: "999px"
  avatar: "50%"
  dock: "14px"
  guide: "10px"
spacing:
  xs: "0.375rem"
  sm: "0.6rem"
  md: "0.75rem"
  lg: "1rem"
components:
  icon-button:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    rounded: "{rounded.button}"
    height: "28px"
    width: "28px"
  icon-button-active:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.accent}"
  select:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.button}"
    height: "28px"
  count-badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-on}"
    rounded: "{rounded.badge}"
  avatar:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.avatar}"
    size: "28px"
  dock-btn:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.button}"
    height: "30px"
  dock-btn-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-on}"
    rounded: "{rounded.button}"
    height: "30px"
  dock-btn-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.button}"
    height: "30px"
  toast:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.item}"
    padding: "0.75rem 1rem"
  compose-pill:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.badge}"
  dropdown-menu:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.button}"
  sheet-container:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.item}"
    padding: "{spacing.md}"
---

# Design System: Open Artifacts (service chrome)

## Overview

**Creative North Star: "The Quiet Instrument"**

The service chrome is the host UI around an artifact - the sticky header, its
toggles, the comments drawer, the live and handoff docks, the version picker.
It is tool UI, not content: quiet, precise, systems-grade, the kind of chrome a
Figma canvas or a Linear toolbar user trusts on sight. The artifact leads; the
chrome recedes. One accent, one font family, one radius scale, both themes
always, keyboard first-class.

The chrome does not own a palette of its own. It reads `--oa-*` tokens that the
token contract (`skills/using-open-artifacts/references/tokens.css`) bridges to
the artifact's identity tokens (`--oa-accent` -> `--accent`, `--oa-bg` -> `--bg`,
etc.) with the service defaults recorded here as the fallback. So a brand-register
artifact repaints the chrome to match; a markdown or legacy artifact that defines
no identity keeps these defaults. The chrome's design system is therefore
structural - sizes, radii, spacing, states, focus - carried by a small set of
`--oa-*` variables and a single repeating icon-button pattern.

**Key Characteristics:**
- One accent (`#6457f0` light / `#8d82f5` dark), the only interactive color.
- Both themes always; the viewer stamps `data-theme` and every chrome element
  reads in light and dark.
- 28px hit targets, shadcn-aligned radii (6px controls, 4px menu items, 8px
  cards, 999px badges/avatar) - a console, not soft UI.
- Ghost icon buttons (transparent, no border, muted-to-fg on hover); chrome at
  rest stays flat and separates with borders, tint, or backdrop contrast.
  Floating/transient elements (docks, toasts, dropdowns, compose pill) use
  subtle drop shadows to separate from the artifact beneath.
- Keyboard-first: `:focus-visible` rings on every control, no animation on
  high-frequency actions.

## Colors

A near-monochrome neutral palette with one accent and one destructive semantic.
Light is the canonical theme; dark mirrors it with the same hue, lower chroma,
and a lightness staircase for depth.

### Primary
- **Signal Indigo** (`#6457f0` light, `#8d82f5` dark): the single interactive
  color. Active toggle states, count badges, focus-ring outer, links, the
  comment "done" check. Carries ≤10% of any chrome view.
- **Accent Hover** (`color-mix(in oklab, var(--accent), var(--fg) 8%)`): the
  hover state for primary dock buttons and accent-filled controls.
- **Accent Active** (`color-mix(in oklab, var(--accent), var(--fg) 14%)`): the
  pressed/active state for primary dock buttons.
- **Accent Soft** (`color-mix(in oklab, var(--accent), transparent 88%)`): the
  tinted fill for pressed dock buttons, chip highlights, and chart areas.

### Semantic
- **Danger** (`#b42318` light, `#ff8f85` dark): destructive actions only - the
  delete-handoff button, record button, error callouts, error toasts. Never an
  action color for non-destructive controls.
- **Success** and **Warn** exist in the token contract for artifacts but are
  deliberately excluded from chrome; semantic state lives in the artifact, not
  the frame.

### Neutral (light)
- **BG** (`#ffffff`): page and drawer floor.
- **Surface** (`#f8f8f8`): toggle/select fills, comment-item cards, dock panels.
- **Surface-2** (`#f1f1f3`): second elevation step, used on the landing page for
  derived tiers and method badges. Derived from `--surface` toward `--fg` (4%).
- **FG** (`#18181b`): primary text and icon color.
- **FG-2** (`#3f3f46`): secondary text on the landing page (lead paragraphs, path
  cells). A lighter step below `--fg` for de-emphasized content.
- **Muted** (`#71717a`): bylines, labels, and the rest-state icon color on ghost buttons (hover lifts to `--oa-fg`).
- **Border** (`#e4e4e7`): 1px hairlines on every control and divider.
- **Border Strong** (`#d4d4d8`): a darker hairline for hover states on bordered
  controls (the copy button on the landing page).

### Neutral (dark)
- **BG** (`#131316`), **Surface** (`#1c1c21`), **Surface-2** (`#232329`), **FG**
  (`#e7e7ea`), **FG-2** (`#c4c4ca`), **Muted** (`#9a9aa2`), **Border**
  (`#2e2e33`), **Border Strong** (`#3a3a41`). Depth comes from surface lightness
  (`#131316` -> `#1c1c21` -> `#232329`), not shadows.

### Named Rules
**The One Accent Rule.** Signal Indigo is the only interactive color. Danger is
for destruction only. No second accent, no semantic red/yellow/green in the
chrome (semantic state lives in the artifact, not the chrome).

**Exception — live disconnect dot.** The Live toggle's disconnected indicator
is a fixed 6px amber dot (`oklch(77% 0.13 82)`, 1.4s pulse, static under
`prefers-reduced-motion`), aligned with the impeccable live-mode reference the
live editor is built from. It is the ONLY semantic color in the chrome and
means exactly one thing (agent watcher offline); it never carries interactive
state — the toggle stays a normal button.

**The Bridge Rule.** The chrome reads `--oa-*`, which the token contract mirrors
from the artifact's identity tokens. Never hand-override `--oa-*` in an artifact
theme fragment - the bridge already covers it, and overriding breaks the
"chrome follows the artifact" invariant.

## Typography

**Font:** `--oa-font` - `system-ui, -apple-system, "Segoe UI", sans-serif` by
default; the `OA_FONT` env var can replace it on a branded deploy. One family
across the entire chrome.

**Mono Font:** `--oa-font-mono` - `ui-monospace, SFMono-Regular, "SF Mono", Menlo,
Consolas, monospace`. Used only for measurement: dock timers, timecodes, speed
selectors, and the live-guide text area. Never a costume for "technical" -
mono earns its place by displaying numbers and code.

**Character:** A single neutral grotesk at small, dense sizes. The chrome is
read at arm's length while the user works - hierarchy comes from weight and
size steps within one family, never from a second face. Numerics in counts and
timestamps use `tabular-nums`.

### Hierarchy
- **Display** (600, 2rem, 1.2): landing-page hero title only. Never appears in
  the viewer chrome.
- **Headline** (600, 1.25rem, 1.3): standalone status and unlock-card headings.
  The largest type inside the viewer; used for full-page messages, not in-chrome
  controls.
- **Title** (600, 0.875rem, 1.35): comment-item titles, feature-card titles,
  drawer count badge. The header title uses 0.8rem/600/1.5 (a body-weight
  variant) so it aligns with the header's 0.8rem running text.
- **Body** (400, 0.8rem, 1.5): header running text, card descriptions, dock
  labels, live-guide body.
- **Label** (400, 0.75rem, 1.4): select options, form labels, secondary controls,
  brand chip, account chip.
- **Caption** (400, 0.72rem, 1.4): comment bylines, tags, metadata, status
  cluster text, dock timer/timecode.
- **Micro** (600, 9px, 1): count badges only.

### Named Rules
**The One Family Rule.** One font family in the chrome; no display face, no
mono costume. Hierarchy is weight + size, not family contrast. Mono is a
tool for measurement, not a voice.

**The Dense Scale Rule.** Chrome type stays at 0.72-0.8rem (9px for badges,
0.875rem for comment titles). The chrome never sets a heading above 0.875rem -
larger type belongs to the artifact, not the frame. The lone exception is the
handoff countdown (7rem, mono, 300-weight), a transient full-viewport overlay
that is not chrome text.

## Layout

- Sticky header (`--oa-header-h: 2.5rem`), flex row, `gap: 0.75rem`, padding
  `0.375rem 0.75rem`, `backdrop-filter: blur(10px)` over a 5%-transparent bg.
  Title (favicon + name, ellipsis) flexes to fill; controls trail right.
- Drawers (comments) are `position: fixed`, top at `var(--oa-header-h)`, right
  edge, `max-width: 23rem`, sliding via `transform: translateX(100%)` ->
  `translateX(0)` over `.18s`.
- The artifact frame is positioned below the sticky header. Inside the
  sandboxed frame, the document presents as a sheet on a quiet backdrop: the
  root paints a token-derived backdrop tone (`--oa-shell-backdrop`), and the
  body carries the artifact as a rounded (8px), 1px-bordered surface inset by
  `--oa-shell-gap` (0.75rem desktop, 0.5rem at ≤52rem). Authored `position:sticky`
  bars are re-pinned to the sheet's inner top edge so they clear the backdrop gap.
  The window remains the scroll container so handoff scroll playback is
  preserved. Canvas-mode artifacts (`.oa-plane` with a transform) detect the
  mode before first paint and stamp `data-shell="flat"`, restoring the
  full-bleed plane the spatial runtime owns.
- z-index scale: comment pin `2147483643` < handoff cursor `2147483644` < drawer
  and docks `2147483645` < header and compose `2147483646` < toast `2147483647` <
  countdown `2147483647`. No arbitrary `999`.
- Responsive: at `52rem` and below, favicon + truncated title, comment actions,
  and theme remain inline. Version, visibility, brand, Live, Handoff, and
  account controls move into a fixed More panel below the measured header; no
  action disappears. The drawer goes full-width below its max-width. At
  `380px` dock secondary labels collapse to icon-only so the controls row fits
  without clipping.

## Elevation & Depth

Chrome at rest is flat. The header, comments drawer, More panel, and inline
controls separate with a 1px `--oa-border` edge, a `--oa-surface` lightness
step, or backdrop contrast - never shadows. The comments drawer uses its left
border as the only boundary against the artifact. The header's
`backdrop-filter: blur(10px)` communicates overlap while content scrolls beneath
it; it does not imply raised geometry. Dark-theme depth remains a lightness
staircase (`#131316` -> `#1c1c21` -> `#232329`).

Floating and transient elements use subtle drop shadows to separate from the
artifact beneath, because they have no border-only relationship to the content
they overlay. The shadow vocabulary is restrained: one offset, one soft blur,
fg-tinted at low opacity. These are functional depth cues, not decoration.

### Shadow Vocabulary
- **Dock** (`0 8px 32px -4px color-mix(in oklab, var(--oa-fg), transparent 86%),
  0 1px 0 0 color-mix(in oklab, var(--oa-fg), transparent 92%) inset`): the
  live and handoff dock bars. The inset top edge reads as a catch-light.
- **Floating status** (`0 6px 24px -4px color-mix(in oklab, var(--oa-fg),
  transparent 88%)`): the handoff status pill and live action-bar row.
- **Toast** (`0 4px 16px -4px color-mix(in oklab, var(--oa-fg), transparent 85%)`):
  transient notifications. Error toasts replace the shadow with a danger-tinted
  border + danger-tinted background.
- **Compose pill** (`0 4px 16px -4px color-mix(in oklab, var(--oa-fg),
  transparent 75%)`): the floating comment compose surface. Stronger opacity
  because it sits over varied artifact content.
- **Dropdown / menu** (`0 4px 12px -2px color-mix(in oklab, var(--oa-fg),
  transparent 78%)`): comment more-menu, account menu, filter menu.
- **Camera bubble** (`0 8px 24px -6px color-mix(in oklab, var(--oa-fg),
  transparent 78%), 0 0 0 1px color-mix(in oklab, var(--oa-bg), transparent 20%)`):
  the handoff webcam preview. The ring is a bg-tinted edge, not elevation.

### Focus Treatment
- **Focus ring** (`box-shadow: 0 0 0 2px var(--oa-bg), 0 0 0 4px var(--oa-accent)`):
  an accessibility outline rendered outside the control so it remains legible
  on any surface. It is applied only on `:focus-visible` and is not elevation.

### Named Rules
**The Flat-at-Rest Rule.** Header bars, inline controls, sidebars, and panels
remain flat at rest. Use boundaries and tonal contrast to express layering.
Shadows appear only on floating/transient elements (docks, toasts, dropdowns,
compose pill, camera bubble) that overlay the artifact and have no border-only
relationship to the content beneath. Even then, the shadow is a single soft
offset, never a decorative halo or hard cast.

## Shapes

Compact, shadcn-aligned radii. `6px` (rounded-md) for icon buttons, selects,
dock buttons, and menu containers; `4px` (rounded-sm) for menu items; `8px`
(rounded-lg) for comment-item cards, toasts, and the sheet container; `999px`
(full) for the count badge, avatar, and the compose pill. The live and handoff
docks use `14px` - a deliberate exception that gives the floating pills a
softer silhouette against the artifact. The live-guide panel uses `10px`,
between the dock and the card scale. A `2px` micro-radius appears on the
scrubber track and mic-level bar (4px-tall functional elements where 6px would
round the entire height).

### Named Rules
**The Compact Radius Rule.** Radii stay at 4-8px for controls and cards (plus
the `999px` pill for badges/avatar/compose). The dock `14px` and live-guide
`10px` are the sole exceptions, earned by the floating-pill posture. No `16px+`
corners in chrome. The radius scale is `--oa-*`-aware but does not shift between
themes.

## Components

### Icon button (the canonical toggle)
One repeating pattern drives every header control - theme toggle, live toggle,
handoff toggle, comments toggle, close, filter. A shadcn **ghost** button:
28×28, `6px` radius, transparent background, no border (`1px solid transparent`
keeps the box), `--oa-muted` icon at rest. A `::before` pseudo expands the hit
area (`inset: -6px`). `:focus-visible` shows the focus ring; `:active` shifts
`translateY(1px)`. Hover lifts the icon to `--oa-fg` and tints the background
(`color-mix(in oklab, var(--oa-fg), transparent 90%)`). `[aria-expanded="true"]`
or `[aria-pressed="true"]` colors the icon `--oa-accent` and tints the background
toward the accent (`color-mix(in oklab, var(--oa-accent), transparent 88%)`).
SVG icons are `16×16`, `display: block`, centered.

### Dock button
The control vocabulary inside live and handoff docks. `30px` height, `6px`
radius, transparent background, `--oa-fg` text at `opacity:.85`, `0 .6rem`
padding. Three variants: **default** (ghost, `--oa-fg` at 85% opacity, hover
lifts to 100% with a fg tint), **primary** (`--oa-accent` fill,
`--oa-accent-on` text, 600 weight, hover darkens via `accent-hover`), and
**record** (`--oa-danger` fill, white text). Active/pressed state tints toward
accent (`accent-soft` fill, accent border at 60% opacity, accent text). The
Blur toggle fills solid `--oa-accent` when pressed. The Discard button rests in
`--oa-muted` and shifts to `--oa-danger` on hover. Icons are `14×14`; labels
are `white-space: nowrap` and hide on secondary controls below `380px`.

### Header
Sticky, backdrop-blurred, 2.5rem tall. The favicon + title leads from the left;
the right-side controls trail orders version picker, visibility, Live, Handoff,
comments, theme, account chip, and brand. `--oa-header-h` is exposed so artifact
sticky bars and full-viewport sections clear it. At `52rem` and below, a More
button discloses the same ordered controls in a labeled panel with outside-click
and Escape dismissal. A dock launched from the panel returns focus to More when
it closes, never to a hidden control.

### Select (version / visibility)
`28px` min-height, `6px` radius, 1px border, `--oa-bg` fill (shadcn trigger),
`0.75rem` label. Custom chevron via two `linear-gradient` arrows in `--oa-muted`.
Hover tints the background (`color-mix(in oklab, var(--oa-fg), transparent 92%)`);
`:focus-visible` -> accent border + focus ring. Pointer states change only the
background color, so the custom chevron stays visible and the select never
translates when its native menu opens.

### Comments drawer
Fixed right, `23rem` max, slides `.18s`, and uses a 1px left border with no
elevation effect. Head (title + count + close), filter row, scrollable list,
footer input.
Comment items: `8px` radius (rounded-lg), `--oa-surface` bg, 1px tinted border,
hover background tint, avatar + title (`0.875rem`/600) + byline (`0.72rem`
muted). Done state strikes through and dims the avatar. Dropdown menus (more,
filter) are shadcn-style: `6px` radius, 1px border, `4px` items with hover tint.

### Compose pill
The floating comment compose surface: `999px` radius (full pill),
`--oa-bg` background, 1px `--oa-border`-with-fg-tint border, and a soft drop
shadow (`0 4px 16px -4px ...`) because it overlays varied artifact content. The
textarea inside is borderless and transparent; `:focus-within` shifts the pill
border to `--oa-accent`. The send button is a `32px` circle, muted at rest,
accent-filled when `[data-ready]`.

### Comment selection toolbar
A floating toolbar that appears when the user selects text inside a canvas
artifact: `6px` radius, 1px border with fg tint, `--oa-bg` background, 600-weight
`0.78rem` label, accent-tinted on hover. Positioned at the selection anchor with
`transform: translate(-50%, .4rem)`.

### Comment pin
A teardrop-shaped location pin for canvas comments: `18px`, `border-radius:
50% 50% 50% 2px` (round head, pointed tail), `--oa-accent` fill, 1.5px
`--oa-bg` border. Sits at the pinned coordinates, inverse-scaled against the
canvas transform.

### Avatar
`28px` circle, `--oa-fg`-tinted fill (`color-mix(in oklab, var(--oa-fg), transparent 90%)`),
initials uppercase `0.75rem`/600.

### Count badge
`--oa-accent` fill, `--oa-accent-on` text, `9px`/600, `999px` radius (rounded-full),
pinned top-right of its toggle. Hidden unless `[data-count]` is set.

### Toast
Transient notification: `8px` radius, `--oa-bg` background, 1px `--oa-border`,
soft drop shadow. `0.85rem` body text. Error toasts tint border + background
toward `--oa-danger`; success toasts tint toward `--oa-accent`. Slides in with
`.2s` ease-out. Stacked top-right below the header.

### Dropdown menu
Flat menu container: `6px` radius, 1px `--oa-border`, `--oa-bg` background, soft
drop shadow. Items are `4px` radius, `0.8rem`, hover-tinted background. The
destructive item (delete) is `--oa-danger` text.

### Live / Handoff docks
Bottom-center floating pills with `14px` radius, hairline border
(`color-mix(in oklab, var(--oa-border), var(--oa-fg) 4%)`), near-opaque
`--oa-bg` panel (`color-mix(in oklab, var(--oa-bg), transparent 4%)`), and
`backdrop-filter: blur(14px) saturate(120%)`. The dock shadow
(`0 8px 32px -4px ...` with an inset top catch-light) separates the bar from
the artifact beneath. Controls use the dock-button vocabulary; mono is used
only for the timer, timecode, and speed selector. The two docks are mutually
exclusive (opening one closes the other) - a state rule, not a visual one.
The circular camera preview captures one primary pointer for each drag and keeps
that pointer bound to the overlay where the gesture began. Drag translation and
the recording mirror use separate CSS variables so moving the preview never
flips it; saved coordinates are clamped back inside the viewport after resize.
An artifact with a saved handoff opens the Handoff dock by default in a
camera-free playback-first state. Camera and microphone access starts only when
the owner opens a record-first dock with no saved handoff or explicitly chooses
Re-record; only active capture adds the danger ring, and closing the dock
releases every media track. Handoff timelines begin with the artifact's scroll
position at `t=0`, so playback resets to the recorded viewport before its first
animation frame. Re-recording keeps stable R2 keys, so playback appends the
handoff `createdAt` as a media/events revision and bypasses the browser cache;
event replay waits for media metadata before it advances the artifact.

### Artifact Sheet Container
The tactile container for artifact documents: `8px` radius (`{rounded.item}`),
1px `--oa-border` boundary, inset from the iframe viewport by `--oa-shell-gap`
(`0.75rem` desktop, `0.5rem` mobile) on a token-derived `--oa-shell-backdrop`
(`color-mix(var(--oa-surface), var(--oa-fg) 3%)`). Synchronously detects
spatial canvas modes (`.oa-plane` with transform) and applies `data-shell="flat"`
to bypass the inset for infinite viewports. Authored sticky headers automatically
re-pin to `var(--oa-shell-gap)` so the backdrop gap remains unobstructed.

### Dark-console status page
An opt-in branded status page theme (`BRAND_STATUS_THEME="dark-console"`):
overrides the chrome tokens with a near-black palette (`--oa-bg: #050505`,
`--oa-surface: #0d0d0d`, `--oa-fg: #e5e5e5`, `--oa-muted: #949494`,
`--oa-border: #1f1f1f`, `--oa-accent: #3c7bff`, `--oa-accent-on: #050505`).
A dot-grid background (`radial-gradient(circle, #303030 0.7px, transparent 0.8px)`,
18px grid) with a bottom-fade scrim. The brand mark is 9px mono, uppercase,
accent-colored, letter-spaced `0.12em`. The action link is a bordered surface
pill with mono text, accent on hover. No header or theme toggle - the reset's
`prefers-color-scheme` handles the base. Used only on missing-artifact and
invalid-version pages when the host configures it.

## Do's and Don'ts

### Do
- **Do** use one accent (Signal Indigo) for every interactive/active state;
  danger only for destructive actions.
- **Do** ship visible `:focus-visible` rings on every
  control; keyboard is first-class.
- **Do** keep hit targets at 28px and radii aligned (6px controls, 4px menu
  items, 8px cards, 999px badges/avatar/compose). The dock 14px is the sole
  earned exception.
- **Do** let the chrome follow the artifact's palette via the `--oa-*` bridge;
  the service defaults are a fallback, not a fixed identity.
- **Do** support both themes on every chrome element; the viewer stamps
  `data-theme` and the toggle must win over `prefers-color-scheme`.
- **Do** keep chrome at rest flat; use borders, surface lightness, and backdrop
  contrast for inline layering.
- **Do** use a single soft drop shadow on floating/transient elements (docks,
  toasts, dropdowns, compose pill) that overlay the artifact; the shadow is a
  functional depth cue, one offset + one blur.

### Don't
- **Don't** add elevation shadows to inline chrome (header, drawer, panels,
  controls); shadows are for floating elements only.
- **Don't** introduce a second accent or decorative semantic colors in chrome.
- **Don't** hand-override `--oa-*` tokens in artifact theme fragments - the
  bridge already mirrors the artifact identity.
- **Don't** animate high-frequency actions (toggles, presses); motion is
  `.15s` for feedback, `.18s` for drawer slide, and `.2s` for toast entrance,
  nothing more.
- **Don't** invent new chrome control patterns - reuse the ghost icon-button
  for header controls and the dock-button for dock controls; the chrome's
  consistency is its identity.
