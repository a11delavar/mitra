/** Local development setup (`MITRA_DEV`). The Demo integration is only offered here. */
export const isDeveloperSystem = process.env.MITRA_DEV === 'true'

/** A public demo (`MITRA_DEMO`): every visitor gets a sandbox of their own. */
export const isDemo = process.env.MITRA_DEMO === 'true'
