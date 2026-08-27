---
name: hallmark-generation-quality
 description: Findings from comparing nutlope/hallmark with Open Artifacts artifact authoring
 type: decision
---

## Why

Hallmark is useful as a design-quality reference, but it should not be copied wholesale into Open Artifacts. Open Artifacts already has stronger CSP-aware Recipes, deterministic composition, both-theme token enforcement, interaction guidance, and Canvas-specific runtime contracts. Hallmark's highest-value additions are explicit structural planning, named anti-slop checks, brief-to-layout variation, and reference-DNA extraction.

## How to apply

Prioritize transferable ideas in this order:

1. Add a compact artifact-type design planner that chooses register, production level, layout concept, palette roles, type roles, and motion budget before authoring.
2. Add a machine-checkable or structured quality checklist for generated HTML covering contrast, mobile widths, clickable text, focus/states, reduced motion, token drift, fake chrome, and fabricated content.
3. Add optional project-level design memory for repeated artifact families, while keeping Open Artifacts' deterministic Recipe and scope model authoritative.
4. Add optional reference study/remix guidance that extracts structure and roles rather than copying pixels or remote assets.
5. Add worked examples by artifact type and layout pattern, not only generic design principles.

Do not import Hallmark's broad theme catalog or its external-font assumptions without adapting them to strict CSP, installed-font/web-font opt-in behavior, Markdown limitations, and the L1/L2/L3 plus Canvas model.

## Related

[[DESIGN]]
[[skills/using-open-artifacts/SKILL]]
[[skills/using-open-artifacts/references/design]]
[[skills/using-open-artifacts/references/interaction]]
[[skills/using-open-artifacts/references/canvas]]
