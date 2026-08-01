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
  menu: "4px"
  item: "8px"
  badge: "999px"
  avatar: "50%"
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
- Ghost icon buttons (transparent, no border, muted-to-fg on hover); every
  chrome surface stays flat and separates with borders, tint, or backdrop
  contrast instead of elevation effects.
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
- **Muted** (`#71717a`): bylines, labels, and the rest-state icon color on ghost buttons (hover lifts to `--oa-fg`).
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

- Sticky header (`--oa-header-h: 2.5rem`), flex row, `gap: 0.75rem`, padding
  `0.375rem 0.75rem`, `backdrop-filter: blur(10px)` over a 5%-transparent bg.
  Title (favicon + name, ellipsis) flexes to fill; controls trail right.
- Drawers (comments) are `position: fixed`, top at `var(--oa-header-h)`, right
  edge, `max-width: 23rem`, sliding via `transform: translateX(100%)` ->
  `translateX(0)` over `.18s`.
- The artifact frame fills the viewport below the header.
- z-index scale: drawer `2147483645` < header `2147483646`. No arbitrary `999`.
- Responsive: at `52rem` and below, favicon + truncated title, comment actions,
  and theme remain inline. Version, visibility, brand, Live, Handoff, and
  account controls move into a fixed More panel below the measured header; no
  action disappears. The drawer goes full-width below its max-width.

## Elevation & Depth

No elevation shadows. Every service-chrome surface, including sidebars,
dropdowns, compose surfaces, toasts, and dock bars, separates with a 1px
`--oa-border` edge, a `--oa-surface` lightness step, or backdrop contrast. The
comments drawer uses its left border as the only boundary against the artifact.
The header's `backdrop-filter: blur(10px)` communicates overlap while content
scrolls beneath it; it does not imply raised geometry. Dark-theme depth remains
a lightness staircase (`#131316` -> `#1c1c21`).

### Focus Treatment
- **Focus ring** (`box-shadow: 0 0 0 2px var(--oa-bg), 0 0 0 4px var(--oa-accent)`):
  an accessibility outline rendered outside the control so it remains legible
  on any surface. It is applied only on `:focus-visible` and is not elevation.

### Named Rules
**The Flat Chrome Rule.** Header bars, controls, sidebars, menus, popovers,
toasts, and dock bars remain flat. Use boundaries and tonal contrast to express
layering; never add decorative elevation effects.

## Shapes

Compact, shadcn-aligned radii. `6px` (rounded-md) for icon buttons, selects, and
menu containers; `4px` (rounded-sm) for menu items; `8px` (rounded-lg) for
comment-item cards; `999px` (full) for the count badge, avatar, and the compose
pill. No large radii; the chrome is a tool, not a soft consumer surface.

### Named Rules
**The Compact Radius Rule.** Radii stay at 4-8px for controls and cards (plus
the `999px` pill for badges/avatar/compose). No `12px+` corners in chrome. The
radius scale is `--oa-*`-aware but does not shift between themes.

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

### Header
Sticky, backdrop-blurred, 2.5rem tall. Favicon + title (ellipsis, `0.8rem`/600)
left; version picker, visibility, account chip, comments toggle, live toggle,
handoff toggle, theme toggle trail right. `--oa-header-h` is exposed so artifact
sticky bars and full-viewport sections clear it. At `52rem` and below, a More
button discloses the secondary controls in a labeled panel with outside-click
and Escape dismissal; comments and theme stay one tap away. A dock launched
from the panel returns focus to More when it closes, never to a hidden control.

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

### Avatar
`28px` circle, `--oa-fg`-tinted fill (`color-mix(in oklab, var(--oa-fg), transparent 90%)`),
initials uppercase `0.75rem`/600.

### Count badge
`--oa-accent` fill, `--oa-accent-on` text, `9px`/600, `999px` radius (rounded-full),
pinned top-right of its toggle. Hidden unless `[data-count]` is set.

### Live / Handoff docks
Bottom-center pills that inherit the icon-button vocabulary for their controls
and the drawer's surface/border tokens for their panels. They are mutually
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
animation frame.

## Do's and Don'ts

### Do
- **Do** use one accent (Signal Indigo) for every interactive/active state;
  danger only for destructive actions.
- **Do** ship visible `:focus-visible` rings on every
  control; keyboard is first-class.
- **Do** keep hit targets at 28px and radii aligned (6px controls, 4px menu
  items, 8px cards, 999px badges/avatar/compose).
- **Do** let the chrome follow the artifact's palette via the `--oa-*` bridge;
  the service defaults are a fallback, not a fixed identity.
- **Do** support both themes on every chrome element; the viewer stamps
  `data-theme` and the toggle must win over `prefers-color-scheme`.
- **Do** separate overlapping chrome with borders, surface lightness, and
  backdrop contrast; keep sidebars visibly bounded without artificial lift.

### Don't
- **Don't** add elevation shadows to controls, sidebars, menus, popovers,
  toasts, or docks; the service chrome stays flat.
- **Don't** introduce a second accent or decorative semantic colors in chrome.
- **Don't** hand-override `--oa-*` tokens in artifact theme fragments - the
  bridge already mirrors the artifact identity.
- **Don't** animate high-frequency actions (toggles, presses); motion is
  `.15s` for feedback and `.18s` for drawer slide, nothing more.
- **Don't** invent new chrome control patterns - reuse the ghost icon-button;
  the chrome's consistency is its identity.
