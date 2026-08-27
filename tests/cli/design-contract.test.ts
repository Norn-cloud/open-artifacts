import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface DesignSidecar {
  extensions: {
    shadows: Array<{ name: string; value: string }>;
  };
  narrative: unknown;
}

const sidecar = JSON.parse(
  readFileSync(
    new URL("../../.impeccable/design.json", import.meta.url),
    "utf8",
  ),
) as DesignSidecar;
const designMarkdown = readFileSync(
  new URL("../../DESIGN.md", import.meta.url),
  "utf8",
);

describe("service chrome design contract", () => {
  it("prescribes only functional floating-element shadows, not decorative elevation", () => {
    // The shadow vocabulary includes focus-ring (accessibility, not elevation)
    // plus functional depth cues for floating/transient elements that overlay
    // the artifact. No decorative or arbitrary shadows.
    const shadowNames = sidecar.extensions.shadows.map(({ name }) => name);
    expect(shadowNames).toContain("focus-ring");
    expect(shadowNames).toContain("dock");
    expect(shadowNames).toContain("toast");
    expect(shadowNames).toContain("dropdown");

    // Every shadow must have a soft blur (offset + blur) — no hard casts.
    for (const { value } of sidecar.extensions.shadows) {
      // focus-ring is a ring, not a shadow; skip the blur check for it.
      if (value.includes("0 0 0 2px")) continue;
      // All other shadows must contain a blur radius > 0 (e.g. "8px 32px -4px").
      expect(value).toMatch(/\d+px \d+px -?\d+px/);
    }

    const designSource = `${JSON.stringify(sidecar.narrative)}\n${designMarkdown}`;
    for (const preference of [
      "panel-lift",
      "drawer-lift",
      "action-bar-lift",
      "Do shadow floating panels",
      "cast a shadow",
      "casts a directional shadow",
    ]) {
      expect(designSource).not.toContain(preference);
    }
    // The refreshed DESIGN.md replaces "No elevation shadows" with the
    // Flat-at-Rest Rule: chrome at rest is flat, floating elements get
    // one soft shadow. Verify the rule is present.
    expect(designSource).toContain("Flat-at-Rest");
  });
});
