import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface DesignSidecar {
  extensions: {
    shadows: Array<{ name: string }>;
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
  it("does not prescribe decorative elevation shadows", () => {
    expect(sidecar.extensions.shadows.map(({ name }) => name)).toEqual([
      "focus-ring",
    ]);

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
    expect(designSource).toContain("No elevation shadows");
  });
});
