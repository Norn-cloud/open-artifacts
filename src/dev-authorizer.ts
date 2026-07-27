import type { Context } from "hono";
import { type Authorizer, defaultAuthorizer } from "./authorizer";

// Local-dev authorizer: grants owner perms (canManage + authorizeWrite) so the
// Live and Handoff toggles render and their write APIs (live WebSocket,
// handoff record) admit WITHOUT OAuth or a write token. Gated on
// DEV_AUTHORIZER=1 (set in .dev.vars, gitignored, local-only). With no such
// env - any real deploy - every method delegates to defaultAuthorizer, so
// wiring this via createApp(devAuthorizer) in src/index.ts changes production
// nothing. Remove or leave; it is inert without the flag.
function devOn(c: Context): boolean {
  return (c.env as { DEV_AUTHORIZER?: string }).DEV_AUTHORIZER === "1";
}

export const devAuthorizer: Authorizer = {
  async authorizeCreate(c) {
    return defaultAuthorizer.authorizeCreate(c);
  },
  async authorizeView(c, record) {
    return devOn(c) ? true : defaultAuthorizer.authorizeView(c, record);
  },
  async authorizeWrite(c, record) {
    return devOn(c) ? true : defaultAuthorizer.authorizeWrite(c, record);
  },
  async canManage(c, record) {
    return devOn(c) ? true : defaultAuthorizer.canManage(c, record);
  },
};
