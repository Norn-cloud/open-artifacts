---
target: public/index.html
total_score: 36
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 0
timestamp: 2026-08-27T09-41-14Z
slug: public-index-html
---
# Critique: public/index.html (Round 2)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | -- |
| 2 | Match System / Real World | 4 | -- |
| 3 | User Control and Freedom | 4 | -- |
| 4 | Consistency and Standards | 4 | -- |
| 5 | Error Prevention | 4 | -- |
| 6 | Recognition Rather Than Recall | 4 | -- |
| 7 | Flexibility and Efficiency | 4 | -- |
| 8 | Aesthetic and Minimalist Design | 4 | -- |
| 9 | Error Recovery | n/a | No error states on static page |
| 10 | Help and Documentation | 4 | -- |
| **Total** | | **36/36** | **Excellent (100%)** |

## Design Specificity Verdict

Mostly authored for this product, with a category-interchangeable core. The topbar is a deliberate, honest echo of the viewer chrome. The dual install path (agent-paste vs. manual shell) correctly reads the audience. Runtime origin substitution so coda0.com and self-hosters share one page is a smart, product-true detail. The link/chain and shield-check icons now correctly mirror their concepts.

Deterministic scan: 0 findings. Clean.

## What's Working

1. The chrome-echo is honest and rare — same tokens, same ghost buttons, same shared theme key.
2. Audience-correct install model — the agent is the installer, with runtime origin substitution.
3. System discipline under restraint — both themes, focus rings, reduced-motion, no AI-slop tropes.

## Fixes Applied Since Round 1

1. Trust note with inline install.md link beside agent setup command (P1)
2. aria-live copy feedback + honest clipboard fallback with execCommand (P2)
3. API table collapsed behind details toggle (P2)
4. Feature icons replaced: forward-arrow -> link/chain, eye-off -> shield-check (P3)
