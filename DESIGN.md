---
name: Open Artifacts
description: Quiet systems-grade viewer chrome - one accent, both themes, Figma/Linear restraint; follows the artifact's palette via the --oa-* bridge.
colors:
  bg: "#ffffff"
  surface: "#f8f8f8"
  fg: "#18181b"
  muted: "#71717a"
  border: "#e4e4e7"
  accent: "#6457f0"
  accent-on: "#ffffff"
  danger: "#b42318"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.5
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
rounded:
  button: "6px"
  item: "10px"
  badge: "8px"
  avatar: "50%"
spacing:
  xs: "0.375rem"
  sm: "0.6rem"
  md: "0.75rem"
  lg: "1rem"
components:
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.button}"
    height: "28px"
    width: "28px"
  icon-button-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
  select:
    backgroundColor: "{colors.surface}"
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
- 28px hit targets, 6px radii, 1px hairline borders - a console, not soft UI.
- Flat by default: hairline borders + surface tint carry depth; the only shadow
  is the layered focus ring.
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

### Semantic
- **Danger** (`#b42318` light, `#ff8f85` dark): destructive actions only - the
  delete-handoff button, error callouts. Never an action color for non-destructive
  controls.

### Neutral (light)
- **BG** (`#ffffff`): page and drawer floor.
- **Surface** (`#f8f8f8`): toggle/select fills, comment-item cards.
- **FG** (`#18181b`): primary text and icon color.
- **Muted** (`#71717a`): bylines, labels, inactive icon color (at `opacity .8`).
- **Border** (`#e4e4e7`): 1px hairlines on every control and divider.

### Neutral (dark)
- **BG** (`#131316`), **Surface** (`#1c1c21`), **FG** (`#e7e7ea`), **Muted**
  (`#9a9aa2`), **Border** (`#2e2e33`). Depth comes from surface lightness
  (`#131316` -> `#1c1c21`), not shadows.

### Named Rules
**The One Accent Rule.** Signal Indigo is the only interactive color. Danger is
for destruction only. No second accent, no semantic red/yellow/green in the
chrome (semantic state lives in the artifact, not the chrome).
**The Bridge Rule.** The chrome reads `--oa-*`, which the token contract mirrors
from the artifact's identity tokens. Never hand-override `--oa-*` in an artifact
theme fragment - the bridge already covers it, and overriding breaks the
"chrome follows the artifact" invariant.

## Typography

**Font:** `--oa-font` - `system-ui, -apple-system, "Segoe UI", sans-serif` by
default; the `OA_FONT` env var can replace it on a branded deploy. One family
across the entire chrome.

**Character:** A single neutral grotesk at small, dense sizes. The chrome is
read at arm's length while the user works - hierarchy comes from weight and
size steps within one family, never from a second face. Numerics in counts and
timestamps use `tabular-nums`.

### Hierarchy
- **Title** (600, 0.8rem, 1.5): header title, drawer headings.
- **Body** (400, 0.8rem, 1.5): header running text.
- **Label** (400, 0.75rem, 1.4): select options, secondary controls.
- **Caption** (400, 0.72rem, 1.4): comment bylines, tags, metadata.
- **Micro** (600, 9px, 1): count badges only.

### Named Rules
**The One Family Rule.** One font family in the chrome; no display face, no
mono costume. Hierarchy is weight + size, not family contrast.
**The Dense Scale Rule.** Chrome type stays at 0.72-0.8rem (9px for badges).
The chrome never sets a heading above 0.875rem - larger type belongs to the
artifact, not the frame.

## Layout

- Sticky header (`--oa-header-h: 2.5rem`), flex row, `gap: 0.6rem`, padding
  `0.375rem 1rem`, `backdrop-filter: blur(10px)` over an 8%-transparent bg.
  Title (favicon + name, ellipsis) flexes to fill; controls trail right.
- Drawers (comments) are `position: fixed`, top at `var(--oa-header-h)`, right
  edge, `max-width: 23rem`, sliding via `transform: translateX(100%)` ->
  `translateX(0)` over `.18s`.
- The artifact frame fills the viewport below the header.
- z-index scale: drawer `2147483645` < header `2147483646`. No arbitrary `999`.
- Responsive: the header truncates the title and drops non-essential controls
  on narrow viewports; the drawer goes full-width (`width: 100%`) below its
  max-width.

## Elevation & Depth

Flat by default. Structure comes from 1px hairline borders (`--oa-border`) and
the surface tint (`--oa-surface` on `--oa-bg`). The header carries a
`backdrop-filter: blur(10px)` over an 8%-transparent background so content
scrolls beneath it - the only place blur is permitted. Dark-theme depth is a
lightness staircase (`#131316` -> `#1c1c21`), never a shadow.

### Shadow Vocabulary
- **Focus ring** (`box-shadow: 0 0 0 2px var(--oa-bg), 0 0 0 4px var(--oa-accent)`):
  the only shadow in the chrome. Layered (bg gap + accent outer) so it reads on
  any surface; applied on `:focus-visible` only.

### Named Rules
**The Flat Chrome Rule.** No drop shadows on chrome elements - not cards, not
drawers, not toggles. Borders + surface tint + the focus ring carry everything.
The header's backdrop-blur is the single exception.

## Shapes

Compact, console-grade radii. `6px` for every interactive control (icon buttons,
selects, close, filter), `10px` for comment-item cards, `8px` for count badges,
`50%` for avatars only. No large radii; the chrome is a tool, not a soft
consumer surface.

### Named Rules
**The Compact Radius Rule.** Radii stay at 6-10px (plus the avatar circle). No
`12px+` corners in chrome. The radius scale is `--oa-*`-aware but does not shift
between themes.

## Components

### Icon button (the canonical toggle)
One repeating pattern drives every header control - theme toggle, live toggle,
handoff toggle, comments toggle, close, filter. 28×28 (`6px` radius, 1px
`--oa-border`, `--oa-surface` fill, `--oa-fg` icon at `opacity .8`). A
`::before` pseudo expands the hit area (`inset: -6px`). `:focus-visible` shows
the focus ring; `:active` shifts `translateY(1px)`. `[aria-expanded="true"]` or
`[aria-pressed="true"]` raises opacity to 1, tints the border toward the accent,
and colors the icon `--oa-accent`. SVG icons are `15×15`, `display: block`,
centered.

### Header
Sticky, backdrop-blurred, 2.5rem tall. Favicon + title (ellipsis, `0.8rem`/600)
left; version picker, visibility, account chip, comments toggle, live toggle,
handoff toggle, theme toggle trail right. `--oa-header-h` is exposed so artifact
sticky bars and full-viewport sections clear it.

### Select (version / visibility)
`28px` min-height, `6px` radius, 1px border, `--oa-surface` fill, `0.75rem`
label. Custom chevron via two `linear-gradient` arrows in `--oa-muted`.
`:focus-visible` -> accent border + focus ring.

### Comments drawer
Fixed right, `23rem` max, slides `.18s`. Head (title + count + close), filter
row, scrollable list, footer input. Comment items: `10px` radius, `--oa-surface`
bg, 1px tinted border, avatar + title (`0.875rem`/600) + byline (`0.72rem`
muted). Done state strikes through and dims the avatar.

### Avatar
`28px` circle, `--oa-fg`-tinted fill (`color-mix(in oklab, var(--oa-fg), transparent 90%)`),
initials uppercase `0.75rem`/600.

### Count badge
`--oa-accent` fill, `--oa-accent-on` text, `9px`/600, `8px` radius, pinned
top-right of its toggle. Hidden unless `[data-count]` is set.

### Live / Handoff docks
Bottom-center pills that inherit the icon-button vocabulary for their controls
and the drawer's surface/border tokens for their panels. They are mutually
exclusive (opening one closes the other) - a state rule, not a visual one.

## Do's and Don'ts

### Do
- **Do** use one accent (Signal Indigo) for every interactive/active state;
  danger only for destructive actions.
- **Do** ship `:focus-visible` rings (the layered focus-ring shadow) on every
  control; keyboard is first-class.
- **Do** keep hit targets at 28px and radii at 6-10px - a console dialect.
- **Do** let the chrome follow the artifact's palette via the `--oa-*` bridge;
  the service defaults are a fallback, not a fixed identity.
- **Do** support both themes on every chrome element; the viewer stamps
  `data-theme` and the toggle must win over `prefers-color-scheme`.

### Don't
- **Don't** drop shadows on chrome - borders + surface tint + the focus ring
  only (the header's backdrop-blur is the single exception).
- **Don't** introduce a second accent or decorative semantic colors in chrome.
- **Don't** hand-override `--oa-*` tokens in artifact theme fragments - the
  bridge already mirrors the artifact identity.
- **Don't** animate high-frequency actions (toggles, presses); motion is
  `.15s` for feedback and `.18s` for drawer slide, nothing more.
- **Don't** invent new chrome control patterns - reuse the icon-button; the
  chrome's consistency is its identity.
