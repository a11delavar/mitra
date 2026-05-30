import express, { type ErrorRequestHandler } from 'express'
import path from 'path'
import cors from 'cors'
import { NotFoundError } from '@mikro-orm/sqlite'
import { createLogger } from '../shared/index.js'
import { orm } from './orm.js'
import { authMiddleware } from './auth.js'
import { Synchronizer } from './Synchronizer.js'
import { eventsRouter } from './events.js'
import { entriesRouter } from './entries.js'
import { integrationsRouter } from './integrations.js'
import { sourcesRouter } from './sources.js'

const logger = createLogger('API')
const PORT = 3000

new Synchronizer(orm).start()

const app = express()
app.use(cors())
app.use(express.json())
app.use(authMiddleware)

app.use('/api/events', eventsRouter)
app.use('/api/entries', entriesRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/sources', sourcesRouter)

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
