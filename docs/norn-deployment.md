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

## Agent Gateway MCP

The Norn Worker exposes the native stateless MCP endpoint at
`https://artifacts.norn.cloud/mcp`. Agent-facing clients should connect to the
central Agent Gateway; Nango remains a credential-vault/REST-proxy boundary
and is not an agent-facing MCP hop.

Set both production secrets before deploying the MCP-enabled Worker:

```sh
pnpm exec wrangler secret put MCP_TOKEN -c wrangler.norn.jsonc
pnpm exec wrangler secret put MCP_CHANNEL_SECRET -c wrangler.norn.jsonc
```

The endpoint deliberately returns 404 if either secret is absent. The gateway
stores only `MCP_TOKEN` as its backend bearer; `MCP_CHANNEL_SECRET` remains a
Worker secret used to derive the fixed project channel hashes. MCP tools expose
only bounded artifact metadata/content and never return write, channel, or
global MCP credentials.
