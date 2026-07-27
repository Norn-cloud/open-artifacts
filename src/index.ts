import { createApp } from "./app";
import { devAuthorizer } from "./dev-authorizer";

// LiveObject Durable Object (src/live-do.ts) - re-exported from the engine
// barrel so a SaaS deploy (e.g. coda0) that binds LIVE_DO in wrangler.jsonc
// can satisfy wrangler's "exported from your entrypoint" requirement without
// importing the class directly. Self-host deploys that don't bind LIVE_DO
// never reference this export; tree-shaking drops it.
export { LiveObject } from "./live-do";

// devAuthorizer grants owner perms only when DEV_AUTHORIZER=1 (local .dev.vars);
// otherwise it delegates to defaultAuthorizer, so this is a no-op in any deploy
// that lacks the flag. Lets `pnpm dev` show the Live/Handoff toggles locally.
export default createApp(devAuthorizer);
