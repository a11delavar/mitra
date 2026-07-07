import express, { type ErrorRequestHandler } from 'express'
import path from 'path'
import cors from 'cors'
import { NotFoundError } from '@mikro-orm/sqlite'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { createLogger, logLevelName } from '../shared/index.js'
import { orm } from './orm.js'
import { authMiddleware, authRouter, oidc } from './auth.js'
import { Synchronizer } from './Synchronizer.js'
import { eventsRouter } from './events.js'
import { entriesRouter } from './entries.js'
import { integrationsRouter } from './integrations.js'
import { sourcesRouter } from './sources.js'
import { userRouter } from './user.js'
import { locationsRouter } from './locations.js'
import { pushRouter } from './push.js'
import { ReminderScheduler } from './ReminderScheduler.js'
import { seedDev } from './Dev.js'

const logger = createLogger('API')
// 3000 is the container-internal convention (compose maps it); MITRA_PORT covers bare-metal setups
// where 3000 is already someone else's.
const PORT = Number(process.env.MITRA_PORT) || 3000

new Synchronizer(orm).start()
new ReminderScheduler(orm).start()

const app = express()
app.use(cors())

// One line per request at debug — the single most useful thing when "nothing is logging": every call as
// `METHOD /path → status (ms)`, tagged with the user once auth has resolved it (logged at finish, so
// req.user is populated by then). The app's own surface (/api, /auth) logs at debug; static-asset serving
// is left to trace so debug stays about the API. Errors get their own detailed line via the handler below.
app.use((req, res, next) => {
	const startedAt = performance.now()
	// Classify NOW, not at finish: a mounted router strips `req.path` to its own mount-relative value by
	// the time `finish` fires, so `/api/user` would otherwise read as `/` and miss the /api test.
	const appRoute = req.path.startsWith('/api') || req.path.startsWith('/auth')
	res.on('finish', () => {
		const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${Math.round(performance.now() - startedAt)}ms)`
		const tagged = req.user ? `${line} · user ${req.user.id}` : line
		if (appRoute) {
			logger.debug(tagged)
		} else {
			logger.verbose(tagged) // static-asset noise — trace tier only (verbose = level 5, no stack)
		}
	})
	next()
})
// Rehydrate `@type`-tagged JSON (written by the shared models' `toJSON`) back into domain instances,
// mirroring how `@a11d/api` revives responses on the client. The reviver runs depth-first, so nested
// models (e.g. a source within an integration) are reconstructed before their parent — routes then
// receive real entities, with their methods and getters, instead of inert plain objects.
const modelConstructor = new ModelValueConstructor()
app.use(express.json({ reviver: (_key, value) => modelConstructor.shallConstruct(value) ? modelConstructor.construct(value) : value }))
// The sign-in/out endpoints live OUTSIDE the auth wall (they are how one gets past it) and exist
// only in multi-user mode — without OIDC there is nothing to sign into.
if (oidc) {
	app.use('/auth', authRouter)
	logger.info(`Multi-user mode: OIDC against ${oidc.issuer} (redirect URI ${oidc.redirectUri})`)
} else {
	logger.info('Single-user mode: no authentication (set MITRA_OIDC_ISSUER to enable multi-user sign-in)')
}
app.use(authMiddleware)

// Dev-only: seed a persisted sample integration + entries (a real local calendar) so the app renders
// without a real account — and so hiding sources / editing / deleting all work via the normal routes.
if (process.env.MITRA_DEV === 'true') {
	await seedDev(orm)
	logger.info('Dev sample integration seeded')
}

app.use('/api/events', eventsRouter)
app.use('/api/entries', entriesRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/user', userRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/push', pushRouter)

// Serve the bundled frontend, falling back to index.html for client-side routes.
const frontendDistPath = path.resolve(import.meta.dirname, '../../dist')
app.use(express.static(frontendDistPath))
app.get(/(.*)/, (_, res) => res.sendFile(path.join(frontendDistPath, 'index.html')))

// Central error handler. Express 5 forwards rejected promises from async route handlers here,
// so endpoints can simply throw (or let `findOneOrFail` throw).
const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
	const status = error instanceof NotFoundError ? 404 : 500
	// A 404 is usually the client asking for something gone (a deleted entry, a stale link) — a normal
	// outcome, not a server fault, so it belongs at debug. A 5xx is a real failure: log it with its stack.
	if (status >= 500) {
		logger.error(`${req.method} ${req.originalUrl} failed:`, error)
	} else {
		logger.debug(`${req.method} ${req.originalUrl} → ${status}: ${error instanceof Error ? error.message : error}`)
	}
	res.status(status).json({ error: error.message })
}
app.use(errorHandler)

app.listen(PORT, () => {
	logger.info(`Backend API running on http://localhost:${PORT}`)
	// Advertise the active tier so operators know what they're seeing — and discover the knob to turn up.
	logger.info(`Log level: ${logLevelName} (set MITRA_LOG_LEVEL=debug for per-request detail, trace for SQL)`)
})
