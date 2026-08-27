---
target: public/index.html
total_score: 33
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 2
timestamp: 2026-08-27T09-16-07Z
slug: public-index-html
---
# Critique: public/index.html

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Copy confirmation is icon-only, no aria-live |
| 2 | Match System / Real World | 4 | -- |
| 3 | User Control and Freedom | 4 | -- |
| 4 | Consistency and Standards | 4 | -- |
| 5 | Error Prevention | 3 | Clipboard fallback falsely reports "copied" |
| 6 | Recognition Rather Than Recall | 4 | -- |
| 7 | Flexibility and Efficiency | 4 | Two install paths (agent + manual) |
| 8 | Aesthetic and Minimalist Design | 4 | -- |
| 9 | Error Recovery | n/a | No error states on static page |
| 10 | Help and Documentation | 3 | install.md only in copy string, never a clickable link |
| **Total** | | **33/36** | **Excellent (91.7%)** |

## Design Specificity Verdict

**LLM assessment:** Mostly authored for this product, with a category-interchangeable core. The topbar is a deliberate, honest echo of the viewer chrome (same tokens, same ghost buttons, same shared oa-theme localStorage key) — that coherence is itself persuasive to a developer audience. The dual install path (agent-paste vs. manual shell) correctly reads the audience: the agent is the installer. Runtime origin substitution so coda0.com and self-hosters share one page is a smart, product-true detail.

Where it slides toward interchangeable: the overall composition (sticky topbar, centered column, chip + h1 + lead, command blocks, bordered feature list, spec table, one-line footer) is the generic "developer tool / open-source project" landing template. The four feature icons (send, lock, refresh, shield) are the standard SaaS glyph set. Nothing in the layout would break if the product changed; only the words carry the product. And critically: the page never shows a real artifact — the entire pitch is abstract.

**Deterministic scan:** 0 findings. The detector is clean.

## Overall Impression

A disciplined, system-faithful landing page that tells you what the product does but never shows you. The chrome-echo is genuinely rare and admirable; the missing proof of output is the biggest conversion leak. A single embedded example would transform this from "well-described" to "self-evident."

## What's Working

1. The chrome-echo is honest and rare. The landing page IS the viewer chrome — same tokens, same 28px ghost buttons, same shared theme key. Most product sites invent a separate marketing skin; this one tells the truth about the instrument.
2. Audience-correct install model. Recognizing that the agent is the installer (paste-prompt path) with runtime origin substitution is a genuinely insightful, product-specific interaction.
3. System discipline under restraint. Both themes, focus rings everywhere, reduced-motion respected, single subtle entrance, no AI-slop tropes. It practices the design system it ships.

## Priority Issues

### [P1] No proof of output — the product is never shown
- Why it matters: This is a Persuade surface whose entire value prop is visual output. Telling a developer "it publishes shareable pages" without showing one is the biggest conversion leak. The peak-end curve never peaks on the actual product.
- Fix: Add a compact, product-true proof: a "See a live artifact" link to a real /a/:id example and/or a small framed preview using the existing sheet/card vocabulary. Keep it quiet and system-consistent — one card, real content.
- Suggested command: $impeccable polish public/index.html

### [P1] Install-step trust gap: pasting a remote install.md with no way to read it first
- Why it matters: The primary CTA has the user's agent fetch and follow install.md, but that file is only embedded in a copy string — never a clickable link. Running remote instructions through an agent is a real trust decision for the target audience.
- Fix: Make install.md a visible inline link ("read what this does") next to the agent command, and add a one-line reassurance about what the prompt performs.
- Suggested command: $impeccable clarify public/index.html

### [P2] Copy feedback is visual-only and can falsely report success
- Why it matters: Screen-reader users get no feedback that the copy succeeded. The no-clipboard fallback (else{done();}) marks "copied" even when nothing was written, so a user pastes nothing into their terminal.
- Fix: Add an aria-live="polite" "Copied" announcement. In the fallback, select the text or prompt manual copy instead of faking the check state.
- Suggested command: $impeccable harden public/index.html

### [P2] Reference content competes with the conversion action
- Why it matters: The full API table and zero-knowledge crypto internals are presented at full weight to first-time visitors who haven't installed yet. Post-install reference material dilutes the single first action.
- Fix: Keep the API table but de-emphasize it (collapsed/secondary block, or moved below a clearer conversion moment) so the paste-prompt stays the unambiguous hero.
- Suggested command: $impeccable distill public/index.html

### [P3] Feature iconography is generic SaaS glyphs
- Why it matters: Send/lock/refresh/shield are the default feature-list icon set. Contributes to category-interchangeability.
- Fix: Make icons more literal to the product (version-stack, stale/sync diff, CSP shield reading as "no external requests") or drop icons for a tighter typographic feature list.
- Suggested command: $impeccable polish public/index.html

## Persona Red Flags

**Jordan (first-timer):** Reads the lead, understands what it is, but never sees what an artifact looks like — leaves with an abstract picture. Sees "Paste this into any coding agent" but has no link to read install.md first. Faces three command rows and may be unsure whether to run all three or just the first.

**Riley (stress tester):** Copies with clipboard disabled — button flashes the check but nothing was copied (false success). Tabs through: focus rings are good, but copy success is never announced to AT. Notes the messaging seam between "sandboxed, no phone-home" (about artifacts) and "paste this prompt that follows a remote URL" (about the install step).

**Casey (mobile user):** Command rows use overflow-x:auto; white-space:nowrap — long commands require fiddly horizontal scroll on a phone to even read the full text. Copy buttons are 28px with ~38px effective hit area — under the 44px touch target guideline for the primary mobile action.

## Minor Observations

- The rise entrance staggered delay up to ~455ms on the second install block slightly delays a scannable action.
- chip uses font-weight:500; the design system's caption/label scale is 400 and title is 600 — 500 is a small off-scale weight.
- Footer leads with wrangler deploy (self-host), which PRODUCT.md says shouldn't be the headline — it's only the footer so low-severity, but it's the last thing the user reads.
- The GitHub icon-link has no visible label on mobile; acceptable for the toggle (conventional) but the GitHub link's only affordance is a glyph.

## Questions to Consider

1. If this page could show only one thing to convince a developer, why isn't it a real, living artifact? What would change if the hero were an embedded example the visitor could click into?
2. The install CTA asks the user's agent to follow a remote install.md sight-unseen — is the page treating "the agent is the user" as license to hide what the human is authorizing?
3. The chrome-echo says "the landing page is the same instrument as the viewer" — could you push that truth further so the page demonstrates the chrome on a live sample rather than merely borrowing its topbar?
