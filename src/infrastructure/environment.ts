/** Local development setup (`MITRA_DEV`). The Demo integration is only offered here. */
export const isDeveloperSystem = process.env.MITRA_DEV === 'true'

/** A public demo (`MITRA_DEMO`): every visitor gets a sandbox of their own. */
export const isDemo = process.env.MITRA_DEMO === 'true'

/** Whether people sign in (`MITRA_OIDC_ISSUER`); the demo opens sandboxes instead. */
export const isSignedIn = !isDemo && !!process.env.MITRA_OIDC_ISSUER

/** Whether agents may connect over MCP (`MITRA_MCP`): on unless it says `off`, `false`, `0` or `no`. */
export const isMcpEnabled = !['off', 'false', '0', 'no'].includes(process.env.MITRA_MCP?.trim().toLowerCase() ?? '')
