# Open Artifacts production handoff

Status: implemented, merged, deployed, and wired to the Soliman Agent Gateway.
This record was checked on 2026-09-05. It contains secret names and paths only;
no credential values belong here.

## Executive summary

Open Artifacts is live at [artifacts.norn.cloud](https://artifacts.norn.cloud).
Its native Streamable HTTP MCP endpoint is
[`https://artifacts.norn.cloud/mcp`](https://artifacts.norn.cloud/mcp), and it
requires a bearer token. The public Soliman registry artifact is
[`KNTxNHCsw7AH`](https://artifacts.norn.cloud/a/KNTxNHCsw7AH).

Soliman agents connect through the single Agent Gateway endpoint
[`https://agentgateway.norn.cloud/mcp`](https://agentgateway.norn.cloud/mcp).
The gateway has an `open-artifacts` target pointing at the production Worker,
injects the backend bearer credential server-side, and does not expose Worker,
channel, or artifact write tokens to callers.

## Three distinct completion gates

| Gate | Evidence | What it proves |
| --- | --- | --- |
| Merged source | Open Artifacts PR [#5](https://github.com/Norn-cloud/open-artifacts/pull/5) merged as [`335a971d42be3c1eebd35c9de8b49708c46190a6`](https://github.com/Norn-cloud/open-artifacts/commit/335a971d42be3c1eebd35c9de8b49708c46190a6); PR [#6](https://github.com/Norn-cloud/open-artifacts/pull/6) merged as [`aef549030abd8a8d9232bd17e72b0c5b55912095`](https://github.com/Norn-cloud/open-artifacts/commit/aef549030abd8a8d9232bd17e72b0c5b55912095) | The Worker MCP registry and tool annotations are on `main`. |
| Soliman client wiring | Soliman PR [#1792](https://github.com/Soliman-Holdings/soliman-llc-platform/pull/1792) merged as [`430550870f8eb0c85fa7788a9252deece8413561`](https://github.com/Soliman-Holdings/soliman-llc-platform/commit/430550870f8eb0c85fa7788a9252deece8413561) | The Agent Gateway target, bearer injection, policy, and Infisical renderer are merged. |
| Deployed runtime | `GET /health` returned `200 {"ok":true}`; the public registry metadata and viewer both returned `200`; unauthenticated `POST /mcp` returned `401` with `WWW-Authenticate: Bearer` | The production Worker is serving and the MCP route is protected. |

The runtime check also found `soliman-llc-agentgateway` running image
`soliman-llc/agentgateway:1.5.0` on `hetzner-ts`. A 401 without credentials is
the expected protection check; it is not evidence of an authenticated tool
call.

## Production artifact

- Base: [`https://artifacts.norn.cloud`](https://artifacts.norn.cloud)
- Health: [`https://artifacts.norn.cloud/health`](https://artifacts.norn.cloud/health)
- Registry metadata:
  [`/api/artifacts/KNTxNHCsw7AH`](https://artifacts.norn.cloud/api/artifacts/KNTxNHCsw7AH)
- Public viewer: [`/a/KNTxNHCsw7AH`](https://artifacts.norn.cloud/a/KNTxNHCsw7AH)
- ID: `KNTxNHCsw7AH`
- Current public version observed: `2` (`Soliman design hub`)

The public artifact is intentionally plaintext/public. Do not put bearer
tokens, channel secrets, create tokens, or Infisical values in its content.

## MCP contract

The Worker implementation is documented and tested in
`src/mcp.ts:16-44`, `src/mcp.ts:620-659`, and
`tests/worker/mcp.test.ts:199-230`.

The four exposed methods are:

- `list_artifacts` — bounded public metadata search.
- `get_artifact` — bounded metadata/version history and optional plaintext.
- `list_project_artifacts` — resolve a fixed project channel.
- `publish_project_artifact` — create or version a fixed project's stable channel.

The Soliman handoff's fixed project slugs are `norn`, `soliman`, `zen`, and
`core-kit`. The Worker keeps a closed allowlist and currently also contains
`atlas`, `mesh-vms`, `mailcore`, `notifycore`, and `registry`; callers should
use the four Soliman slugs unless an expansion is deliberately reviewed.
Project publishing reuses the Worker domain and byte-limit validation.

The Worker fails closed unless `MCP_TOKEN` and `MCP_CHANNEL_SECRET` are both
present and at least 32 characters. The latter is the non-rotating root for
deterministic project-channel derivation. The route compares bearer values
timing-safely and bounds the request body before MCP SDK parsing
(`src/mcp.ts:665-739`).

## Soliman Agent Gateway wiring

At merged commit `430550870f8eb0c85fa7788a9252deece8413561`:

- `services/agentgateway/config.yaml:47-63` grants builders only
  `list_artifacts`, `get_artifact`, and `list_project_artifacts` for the
  `open-artifacts` target; the reviewed orchestrator and owner interactive
  policy retain publishing through their existing broad catalog rules.
- `services/agentgateway/config.yaml:143-148` targets
  `https://artifacts.norn.cloud/mcp` and uses
  `$OPEN_ARTIFACTS_MCP_BEARER_TOKEN` as backend auth.
- `services/agentgateway/docker-compose.yml:65-68` requires the rendered
  `OPEN_ARTIFACTS_MCP_BEARER_TOKEN` environment variable.
- `scripts/render-agentgateway-env.sh:24-30,86-92` reads `MCP_TOKEN` from
  Infisical path `/soliman-llc/open-artifacts`, validates its length, and
  emits the gateway-only variable. `OPEN_ARTIFACTS_SECRET_PATH` may override
  the default path; `BASE_PATH` defaults to `/soliman-llc`.
- `services/agentgateway/README.md:48-59` tells desktop clients to configure
  only `https://agentgateway.norn.cloud/mcp`; OAuth/PKCE is handled by the
  gateway, not copied into a desktop file.

The source-level stack test is
`scripts/tests/test-agentgateway-stack.sh`. It explicitly checks the
production Worker host, backend bearer expression, builder read-only policy,
and the absence of `publish_project_artifact` in that builder policy.

## Agent client registrations

The normal shared route is the central Agent Gateway. A direct Worker MCP
registration is also installed as a temporary break-glass path while the
Better Auth issuer cutover is pending; it loads the bearer at process start
from Infisical and does not write the value into an agent configuration file.

- Mac Codex: `~/.codex/config.toml` contains `agentgateway` and
  `open-artifacts-soliman`.
- Mac Claude: `~/.claude.json` contains `agentgateway` and
  `open-artifacts-soliman`.
- Mac direct launcher:
  `~/.codex/mcp/run-open-artifacts-soliman-mcp.sh`.
- Coder `norn-dev` `/home/node`: `.codex/config.toml` and `.claude.json`
  contain `open-artifacts-soliman`; the launcher is
  `.codex/mcp/run-open-artifacts-soliman-mcp.sh` and uses
  `.codex/mcp/open-artifacts-infisical-bootstrap.py`.
- Coder `norn-dev` `/root`: `.codex/config.toml` and `.claude.json` now contain
  the same direct registration and launcher/bootstrap pattern. The prior files
  were backed up under `.codex/backups/open-artifacts-20260905T161151Z/` before
  the additive change.

The `/root` canary initialized protocol `2025-06-18`, listed all four tools,
resolved `soliman` to `KNTxNHCsw7AH` with two versions, and resolved `registry`
to this handoff's `FB3xTZcpBXoS` with two versions. An earlier report of zero
Soliman artifacts was a client-side parsing mistake: the response contains one
singular `artifact` object plus a `versions` array, not an `artifacts` array.

Clients already running before these registrations were added must be
restarted or reload their MCP configuration. The direct registration is a
safety net, not a replacement for the gateway's identity and tool policy.

## Secret and configuration inventory

Names and locations only:

| System | Name/path | Handling |
| --- | --- | --- |
| Norn Worker Wrangler secrets | `MCP_TOKEN`, `MCP_CHANNEL_SECRET` | Set with `pnpm exec wrangler secret put ... -c wrangler.norn.jsonc`; values are never committed. |
| Norn Worker create gate | `CREATE_TOKEN` | Existing production create-token secret; not an MCP client credential. |
| Norn Worker canonical URL | `PUBLIC_URL` | Pins generated links to `https://artifacts.norn.cloud`; keep its value in deployment configuration, not this handoff. |
| Soliman Infisical | `/soliman-llc/open-artifacts` → `MCP_TOKEN` | Rendered transiently as `OPEN_ARTIFACTS_MCP_BEARER_TOKEN`; never commit the rendered env file. |
| Local Mac Open Artifacts CLI | `~/.config/open-artifacts/config.json` | The discovered file has `apiUrl` and `createToken` keys; values are intentionally omitted here. |

The Worker deployment shape is in `wrangler.norn.jsonc` (Worker
`norn-open-artifacts`, custom domain, D1 `norn-open-artifacts`, and R2
`norn-open-artifacts-content`). Deployment instructions and secret names are
in `docs/norn-deployment.md:1-52`.

## Verification runbook

### Mac: public and source checks

Run from the Open Artifacts checkout. These commands do not print credentials
or mutate production:

```sh
cd /path/to/open-artifacts
curl -fsS https://artifacts.norn.cloud/health
curl -fsS https://artifacts.norn.cloud/api/artifacts/KNTxNHCsw7AH
curl -fsS -o /dev/null -w '%{http_code}\n' https://artifacts.norn.cloud/a/KNTxNHCsw7AH
curl -sS -D - -o /dev/null -X POST https://artifacts.norn.cloud/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ping"}'
node skills/using-open-artifacts/scripts/artifact.mjs validate \
  .artifacts/recipes/open-artifacts-production-handoff.recipe.json
pnpm test -- tests/worker/mcp.test.ts
pnpm test:cli
pnpm typecheck
pnpm check
```

The locally discoverable Mac paths are
`/Users/yousseftarek/projects/open-artifacts` and
`/Users/yousseftarek/.config/open-artifacts/config.json`. The Soliman gateway
source checkout is `/Users/yousseftarek/projects/worktrees/soliman-open-artifacts-gateway`.

### norn-dev: gateway source and stack checks

Do not run the Docker-backed stack test on the Mac. On the Coder `norn-dev`
workspace, the relevant checkout and source locations are:

- `/workspace/work/openartifacts-gateway`
- `services/agentgateway/config.yaml`
- `services/agentgateway/docker-compose.yml`
- `scripts/render-agentgateway-env.sh`
- `scripts/tests/test-agentgateway-stack.sh`
- `mcp-configs/codex.example.toml` and `mcp-configs/claude-desktop.example.json`

Run the deterministic, test-only stack assertions there:

```sh
cd /workspace/work/openartifacts-gateway
bash scripts/tests/test-agentgateway-stack.sh
```

For a production runtime check from the Mac, the observed host is
`hetzner-ts`; this is read-only and prints container metadata only:

```sh
ssh hetzner-ts 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "agentgateway|cloudflare-mcp"'
curl -sS -o /dev/null -w '%{http_code}\n' https://agentgateway.norn.cloud/mcp
```

To exercise an authenticated Worker `tools/list` probe, use an active
Infisical session and inject `/soliman-llc/open-artifacts` at command time;
filter the response to method names and never echo the environment. The
normal Soliman client path remains the gateway URL, not the Worker bearer.

## Follow-up / risks

- The public artifact ID is stable, but its current version is mutable through
  the stable project channel; use the metadata endpoint to record a version
  when citing a particular snapshot.
- `MCP_CHANNEL_SECRET` is the deterministic channel root. Rotation requires a
  reviewed artifact rebind/migration; removing it is the break-glass endpoint
  shutdown described in `docs/norn-deployment.md:43-49`.
- Builder access is intentionally read-only. Publishing should be performed by
  the reviewed orchestrator or owner interactive policy, with the gateway's
  normal OAuth/PKCE controls.
- No deployment, publish, secret rotation, or client-token retrieval is part
  of this handoff commit.
