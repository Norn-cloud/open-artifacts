# Critique ignore list

Findings matching these rules are dropped silently during critique runs.

## `#000` on camera video element

- **Rule**: `design-system-color` with `ignoreValue: "#000"` in `src/handoff/styles.ts`
- **Reason**: The `#000` is the natural background of a `<video>` element before
  the camera stream attaches. It is not a design token — it is a UA default for
  video elements. Replacing it with a token would be semantically incorrect (the
  video surface is black by definition, not by palette choice).
