# Repository Guidelines

## Project Structure & Module Organization

Open Artifacts is a Cloudflare Worker engine plus the published
`skills/using-open-artifacts/` agent skill. Worker code is in `src/`: routing
and composition live in `app.ts`, `api.ts`, and `index.ts`; persistence is in
`store.ts`; viewer wrapping is in `wrap.ts`; optional live and handoff features
live in `live-*` and `handoff/`. The installable skill owns `SKILL.md`, its
zero-dependency CLI scripts, reference contracts, and Recipe examples.

Keep formal behavior specifications in `tests/features/`. Worker integration
tests live in `tests/worker/`; Node CLI tests live in `tests/cli/`; the optional
real-browser live workflow is `tests/e2e/live-e2e.mjs`. Static assets are in
`public/`; do not hand-edit `src/generated/`, `public/vendor/mediapipe/`, or
`worker-configuration.d.ts`.

## Build, Test, and Development Commands

```bash
pnpm dev
pnpm test                         # Worker tests via workerd
pnpm test:cli                     # CLI/skill tests in Node
pnpm test -- tests/worker/api.test.ts
pnpm test:cli -- tests/cli/artifact-cli.test.ts
pnpm typecheck                    # Worker and CLI targets
pnpm check                        # Biome format and lint check
node tests/e2e/live-e2e.mjs       # Requires agent-browser; uses port 8788
```

Run `pnpm test`, `pnpm test:cli`, `pnpm typecheck`, and `pnpm check` for
cross-cutting changes. `pnpm run deploy` deploys directly to production; use it
only when explicitly requested. `@fradser/pi-kit` is absent; do not add an
unverified replacement.

## Coding Style & Naming Conventions

Use TypeScript strict mode for Worker code and Node ESM for skill scripts.
Biome enforces two-space indentation, double quotes, and semicolons. Name tests
`*.test.ts`; name BDD files `*.feature`. Add dependencies with `pnpm add` or
`pnpm remove`, never by editing `package.json`.

Artifacts are sandboxed under strict CSP and opaque origin: no runtime `fetch`,
external resources, or storage. Preserve the Recipe/token contract, both
`:root` themes, and viewer-owned `--oa-*` tokens. Canvas runtime behavior belongs
in `references/canvas.md`, not per-artifact patches.

## Testing Guidelines

Start behavior changes with a Given/When/Then scenario, make the relevant test
fail, then implement the smallest passing change. Keep Worker and CLI test
targets separate. Recipe/skill changes must respect deterministic composition,
CSP validation, and shared/local source layout. Use `artifact.mjs smoke` for
responsive scrolling HTML when `agent-browser` is available; Canvas has its own
ship gate.

## Commit & Pull Request Guidelines

Recent history uses conventional subjects such as `feat(skills): ...`,
`fix(src): ...`, `test: ...`, and `docs(public): ...`. Keep commits focused and
state the affected scope. PRs should explain user-visible behavior, note Recipe
or CSP implications, include test commands run, and avoid generated/vendor or
secret files. Main is expected to remain deployable.
