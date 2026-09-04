# Norn Cloud deployment

The Norn-hosted instance is deployed from `wrangler.norn.jsonc` to:

- Worker: `norn-open-artifacts`
- Custom domain: `https://artifacts.norn.cloud`
- D1: `norn-open-artifacts`
- R2: `norn-open-artifacts-content`

`workers.dev`, web-font proxying, Handoff recording, and Live editing are
disabled for the initial deployment. Artifact creation is protected by the
Worker `CREATE_TOKEN` secret, and canonical links are pinned by `PUBLIC_URL`.
Neither secret belongs in this repository.

Deploy after the normal gates:

```sh
pnpm test
pnpm test:cli
pnpm typecheck
pnpm check
pnpm exec wrangler deploy -c wrangler.norn.jsonc
```

The project currently has one upstream timing-sensitive Live-watcher test that
may fail on slower hosts. Live is not bound in this deployment, but the failure
must still be recorded rather than silently ignored.
