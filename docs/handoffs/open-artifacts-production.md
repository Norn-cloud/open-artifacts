# Open Artifacts production handoff

This is the repository index for the complete, secret-free production handoff.
The canonical artifact body lives in
[`.artifacts/fragments/open-artifacts-production-handoff/body.md`](../../.artifacts/fragments/open-artifacts-production-handoff/body.md)
and is built by
[`.artifacts/recipes/open-artifacts-production-handoff.recipe.json`](../../.artifacts/recipes/open-artifacts-production-handoff.recipe.json).
The shared Markdown Recipe uses a repo-relative body path and contains no
credentials.

The validated fragment is published through the MCP `registry` project at
[`https://artifacts.norn.cloud/a/FB3xTZcpBXoS`](https://artifacts.norn.cloud/a/FB3xTZcpBXoS)
(version 2, label `production handoff v2`). The evidence packet covers:

- merged Open Artifacts PRs #5/#6 (`335a971d…` and `aef5490…`);
- merged Soliman federation PR #1792 (`43055087…`);
- production health, public artifact, and bearer-protected MCP checks;
- the `norn`, `soliman`, `zen`, and `core-kit` project slugs;
- exact MCP methods, gateway policy, secret names, and Infisical paths without
  values; and
- Mac and norn-dev verification commands and discovered config locations.

The body intentionally distinguishes merged source, deployed runtime, and
client wiring. Keep this file as a pointer; update the fragment and rerun the
Recipe validation when the evidence changes.

## Local validation

From the repository root:

```sh
node skills/using-open-artifacts/scripts/artifact.mjs validate \
  .artifacts/recipes/open-artifacts-production-handoff.recipe.json
node skills/using-open-artifacts/scripts/artifact.mjs build \
  .artifacts/recipes/open-artifacts-production-handoff.recipe.json \
  --output /tmp/open-artifacts-production-handoff.md
```

The full evidence packet lists the focused Worker/CLI tests and static gates.
No publish, deploy, secret rotation, or token retrieval is part of this
handoff.
