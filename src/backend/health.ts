import { Router } from 'express'
import { orm } from './orm.js'

export const healthRouter = Router()

/** How long to wait on the DB before declaring the instance unhealthy — keeps a hung/locked
 * SQLite file from stalling the probe (and, with it, whatever orchestrator is polling it). */
const CHECK_TIMEOUT_MS = 2000

/**
 * Public, unauthenticated liveness+readiness probe (mounted before the auth wall).
 *
 * Deliberately terse: an unauthorized caller learns only *whether* the service can serve — never
 * the version, the dependency topology, or why a check failed. Those are the details that help an
 * attacker fingerprint a target, so they never reach the wire; the body is the same bare `{ status }`
 * shape for everyone. The one thing checked is the database — the sole dependency the app cannot
 * serve without. Per-user integrations (CalDAV, Notion, Google, Photon, the OIDC issuer) are left
 * out on purpose: a transient outage there must not flap the container's health.
 */
healthRouter.get('/', async (_req, res) => {
	res.set('Cache-Control', 'no-store')
	let timer: ReturnType<typeof setTimeout> | undefined
	const ok = await Promise.race([
		orm.isConnected().catch(() => false),
		new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), CHECK_TIMEOUT_MS) }),
	])
	clearTimeout(timer)
	return res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error' })
})
