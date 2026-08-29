import express, { type ErrorRequestHandler } from 'express'
import path from 'path'
import cors from 'cors'
import '../integrations/server/registerEngines.js'
import { NotFoundError } from '@mikro-orm/sqlite'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { createLogger, logLevelName } from '../infrastructure/logging/Logger.js'
import { orm } from '../infrastructure/database/orm.js'
import { authMiddleware, authRouter, oidc } from '../features/identity/server/auth.js'
import { synchronizer } from '../integrations/server/Synchronizer.js'
import { eventsRouter } from '../infrastructure/realtime/events.js'
import { entriesRouter } from '../features/entries/server/entries.js'
import { integrationsRouter } from '../integrations/server/integrations.js'
import { sourcesRouter } from '../features/sources/server/sources.js'
import { userRouter } from '../features/identity/server/user.js'
import { locationsRouter } from '../features/locations/server/locations.js'
import { pushRouter } from '../features/reminders/server/push.js'
import { healthRouter } from '../infrastructure/http/health.js'
import { metaRouter } from '../features/about/server/meta.js'
import { updateChecker } from '../features/about/server/updates.js'
import { ReminderScheduler } from '../features/reminders/server/ReminderScheduler.js'
import { seedDev } from '../integrations/dev/Dev.js'

const logger = createLogger('API')
const PORT = Number(process.env.MITRA_PORT) || 3000

synchronizer.start()
new ReminderScheduler(orm).start()
updateChecker.start()

const app = express()
app.use(cors())

// Request logger middleware.
app.use((req, res, next) => {
	const startedAt = performance.now()
	const appRoute = (req.path.startsWith('/api') || req.path.startsWith('/auth')) && req.path !== '/api/health'
	res.on('finish', () => {
		const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${Math.round(performance.now() - startedAt)}ms)`
		const tagged = req.user ? `${line} · user ${req.user.id}` : line
		if (appRoute) {
			logger.debug(tagged)
		} else {
			logger.verbose(tagged)
		}
	})
	next()
})

// Rehydrate typed JSON into domain model instances.
const modelConstructor = new ModelValueConstructor()
app.use(express.json({ reviver: (_key, value) => modelConstructor.shallConstruct(value) ? modelConstructor.construct(value) : value }))

if (oidc) {
	app.use('/auth', authRouter)
	logger.info(`Multi-user mode: OIDC against ${oidc.issuer} (redirect URI ${oidc.redirectUri})`)
} else {
	logger.info('Single-user mode: no authentication (set MITRA_OIDC_ISSUER to enable multi-user sign-in)')
}

// Unauthenticated health check endpoint for orchestrators.
app.use('/api/health', healthRouter)
app.use(authMiddleware)

if (process.env.MITRA_DEV === 'true') {
	await seedDev(orm)
	logger.info('Dev sample integration seeded')
}

app.use('/api/events', eventsRouter)
app.use('/api/entries', entriesRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/user', userRouter)
app.use('/api/meta', metaRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/push', pushRouter)

// Serve frontend SPA dist bundle.
const frontendDistPath = path.resolve(import.meta.dirname, '../../dist')
app.use(express.static(frontendDistPath))
app.get(/(.*)/, (_, res) => res.sendFile(path.join(frontendDistPath, 'index.html')))

// Central error handler.
const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
	const status = error instanceof NotFoundError ? 404 : 500
	if (status >= 500) {
		logger.error(`${req.method} ${req.originalUrl} failed:`, error)
	} else {
		logger.debug(`${req.method} ${req.originalUrl} → ${status}: ${error instanceof Error ? error.message : error}`)
	}
	res.status(status).json({ error: error.message })
}
app.use(errorHandler)

app.listen(PORT, () => {
	logger.info(`Mitra ${mitra.version} — backend API running on http://localhost:${PORT}`)
	logger.info(`Log level: ${logLevelName} (set MITRA_LOG_LEVEL=debug for per-request detail, trace for SQL)`)
})
