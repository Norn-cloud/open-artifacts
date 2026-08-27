# Artifact quality profile

Read this for an HTML Artifact that needs a stronger visual direction or a
quality review beyond the base Recipe contract. It complements, and never
replaces, [design.md](design.md), [interaction.md](interaction.md),
[motion.md](motion.md), and [canvas.md](canvas.md).

## Scope

Apply this profile by Artifact register, not by reflex:

- **Level 1 / product register:** preserve reading rhythm and familiar
  document structure. The quality floor is measure, contrast, honest content,
  and responsive text. Do not manufacture a hero or structural novelty.
- **Level 2 / product register:** preserve familiar controls and information
  density. Reachable interaction states, keyboard paths, and visible feedback
  matter more than visual novelty.
- **Level 3 / brand register:** add a named layout concept, select visual
  material deliberately, and test that repeated brand artifacts do not collapse
  into a color-swapped template.
- **Canvas:** use [canvas.md](canvas.md), not this page's scrolling-document
  layout rules. The runtime owns the transformed plane, zoom cluster, overflow,
  pointer routing, and mobile stacked read. This profile applies only inside an
  authored frame when it does not contradict that contract.

## Design brief

Before writing a Recipe, write this short brief in the generation task. It is
working context, not a Recipe field and not viewer content:

```text
Artifact read: <kind> for <audience>, optimized for <primary task>
Level/register: <1|2|3> / <product|brand>
Layout concept: <one sentence naming the information shape>
System: <light/dark surface posture> · <display/body roles> · <accent role>
Visual material: <none | data | diagram | CSS art | supplied asset>
Motion budget: <none | feedback only | one orchestrated moment>
Content provenance: <supplied | derived | labelled placeholder>
```

The brief is complete when every supplied fact is classified and the layout
concept describes information organization rather than a generic web page.
Examples: “a decision memo with an evidence table and a closing recommendation”
is a concept; “a clean dashboard” is not.

When the user has not supplied audience, primary task, or tone, infer them from
visible project context and state the inference once in the task's design note.
Do not block an isolated publishing workflow on an extra user round-trip.

## Level 3 critique

After composing a Level 3 brand artifact and before publishing, score the
output from 1 to 5 on these six axes:

1. **Philosophy** — the page takes a clear visual position appropriate to the
   brief.
2. **Hierarchy** — the eye finds primary, secondary, and supporting material
   immediately.
3. **Execution** — contrast, spacing, type, responsive behavior, and states
   are intentional rather than merely plausible.
4. **Specificity** — copy, visual material, and organization belong to this
   artifact rather than a category default.
5. **Restraint** — every flourish earns its place; one decisive move beats
   competing decoration.
6. **Variety** — when the project has multiple brand artifacts, the structure
   is not a superficial color swap of the latest one.

Revise the lowest axis whenever it is below 3. Keep this critique inside the
generation task; do not publish a score claim in the Artifact body.

## Structural choices for brand artifacts

Choose one information shape before building a Level 3 artifact. Do not force
this catalog onto a report, a product tool, or Canvas.

| Shape | Use when | Avoid when |
| --- | --- | --- |
| **Thesis** | One claim or launch message carries the Artifact. | The audience needs dense reference material. |
| **Evidence-led** | Real data, comparisons, or research findings carry the argument. | Numbers are missing or speculative. |
| **Guided walkthrough** | A product, workflow, or proposal is best understood step by step. | A static document is the actual task. |
| **Index** | Discovery across links, entries, or work items is the value. | The content needs a narrative. |
| **Narrative** | A memo, letter, case study, or argument should be read in sequence. | The audience needs to operate controls. |
| **Spatial map** | Relationships are more useful in two dimensions than in a scroll. | The mobile stacked read would destroy the central relationship. |

Within one brand artifact, use at least three appropriate section families:
prose, split evidence, table/list, quote, diagram, full-bleed statement, or
operable control. Do not repeat an identical card skeleton as the default
section grammar.

For a family of Level 3 artifacts, remember the last layout concept, visual
material choice, and section families in an optional project-local
`.artifacts/design-memory.local.json`. It is a generation note, never Recipe
metadata, must be bounded to the newest 20 entries, and must be written only by
the same serialized content-generation task that runs `create` or `update`.
Keep the identity system consistent; vary organization only when the brief
supports it.

## Visual-material decision

Typography-only is the default and a complete answer. Add material only when
removing it would make the Artifact less understandable.

1. **Data or diagram:** use an inline SVG chart, flow, timeline, map, or table
   when the brief supplies facts or relationships.
2. **CSS art:** use one small abstract or geometric construction when it makes
   the subject clearer without introducing an asset.
3. **Hand-built SVG:** use a labelled illustration or diagram when CSS cannot
   carry the structure cleanly.
4. **User-supplied asset:** embed it as a `data:` URI only when its provenance
   and role are clear.
5. **Generated still:** use only when the brief truly requires a scene that
   cannot be represented as data, type, CSS, or SVG. Label it as illustrative
   when it is not documentary.

The Artifact CSP still applies: no remote image, media, font, stylesheet, or
script URL. The profile never authorizes a runtime request.

For Level 3 motion, use one orchestrated moment at most. Every animation has a
one-sentence communication reason and a reduced-motion endpoint; see
[motion.md](motion.md).

## Static quality profile

The Recipe builder enforces the checks below for scrolling HTML. They are
intentionally conservative and do not apply to Canvas or Markdown:

- display headings are roman and declare `overflow-wrap: anywhere` plus
  `min-width: 0` when they use display-scale type;
- primary affordances marked by a CTA/primary class or `data-oa-primary` use
  `white-space: nowrap`;
- a Grid parent that contains image/video content uses `minmax(0, 1fr)` rather
  than a bare fraction track;
- a multi-column `.oa-section-head` containing an eyebrow and a heading
  collapses to one column at or before 48rem;
- a secondary `position: sticky; top: 0` is offset below a top sticky nav;
- fake browser, IDE, terminal, and phone chrome is rejected;
- colors and font-family declarations live in theme token blocks, not component
  rules.

Run the rendered check before publishing a scrolling HTML artifact whose scope
includes responsive design:

```sh
node "$ARTIFACT_CLI" smoke .artifacts/recipes/<name>.recipe.json
```

It renders at **320, 375, 414, and 768px**, failing on horizontal document
scroll or heading overflow. The command uses `agent-browser`; install it before
running the smoke check. Canvas uses its own ship gate in [canvas.md](canvas.md).

## Content and copy

Specificity is a visual material. Use supplied names, dates, decisions,
measurements, and sources. If a number, testimonial, logo, or result was not
supplied, omit it, ask for it, or label the gap plainly:

```text
— metric to confirm
Source pending
Illustrative example
```

Avoid generic opening claims such as “Built for the modern team,” “Unleash your
workflow,” “Seamless integration,” and “Next-generation platform.” Replace them
with a concrete subject, action, constraint, place, date, or observable result.

## Reference DNA is optional

When the user explicitly asks to learn from a screenshot or URL, read
[study.md](study.md) before inspecting it. The study is agent-side research:
it produces static design facts for a Recipe or `design.md`; the published
Artifact never fetches the reference.
