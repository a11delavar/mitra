import express, { type ErrorRequestHandler } from 'express'
import path from 'path'
import cors from 'cors'
import { NotFoundError } from '@mikro-orm/sqlite'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { createLogger } from '../shared/index.js'
import { orm } from './orm.js'
import { authMiddleware } from './auth.js'
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
const PORT = Number(process.env.PORT) || 3000

new Synchronizer(orm).start()
new ReminderScheduler(orm).start()

const app = express()
app.use(cors())
// Rehydrate `@type`-tagged JSON (written by the shared models' `toJSON`) back into domain instances,
// mirroring how `@a11d/api` revives responses on the client. The reviver runs depth-first, so nested
// models (e.g. a source within an integration) are reconstructed before their parent — routes then
// receive real entities, with their methods and getters, instead of inert plain objects.
const modelConstructor = new ModelValueConstructor()
app.use(express.json({ reviver: (_key, value) => modelConstructor.shallConstruct(value) ? modelConstructor.construct(value) : value }))
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
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	logger.error('Request failed:', error)
	const status = error instanceof NotFoundError ? 404 : 500
	res.status(status).json({ error: error.message })
}
app.use(errorHandler)

app.listen(PORT, () => logger.info(`Backend API running on http://localhost:${PORT}`))
