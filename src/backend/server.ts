import express from 'express'
import path from 'path'
import cors from 'cors'
import dotenv from 'dotenv'
import { MikroORM } from '@mikro-orm/sqlite'
import { User, Integration, CalDAV, Source, Entry, createLogger } from '../shared/index.js'
import { Synchronizer } from './Synchronizer.js';

dotenv.config({ path: `${import.meta.dirname}/.env` })

const logger = createLogger('API')

export const orm = await MikroORM.init({
	entities: [User, Integration, CalDAV, Source, Entry],
	dbName: `${import.meta.dirname}/../../data/database.sqlite`,
	allowGlobalContext: true,
})
await orm.schema.update();

const app = express()
app.use(cors())
app.use(express.json())

let defaultUser = await orm.em.findOne(User, { username: User.default.username })
if (!defaultUser) {
	defaultUser = User.default
	orm.em.persist(defaultUser)
	await orm.em.flush()
}

// Global Auth Middleware
app.use((req, _res, next) => {
	// In the future, this is where we check the Bearer token for OIDC
	// For now, we run in zero-auth single-user mode
	(req as any).user = defaultUser
	next()
});

const PORT = 3000

new Synchronizer(orm).start()

app.get('/api/entries', async (req, res) => {
	try {
		const { start, end } = req.query as { start?: string, end?: string }

		if (!start || !end) {
			return res.status(400).json({ error: 'Missing start or end date parameters' })
		}

		// The user is authenticated by middleware, but entries are global to the integration for now.
		// In a multi-user setup, we would filter by user.id

		const [startDate, endDate] = [new Date(start), new Date(end)]

		const entries = await orm.em.find(Entry, {
			$or: [
				{ start: { $gte: startDate, $lte: endDate } },
				{ end: { $gte: startDate, $lte: endDate } },
				{ start: { $lte: startDate }, end: { $gte: endDate } }
			]
		}, { populate: ['source'] })

		return res.json(entries)
	} catch (error: any) {
		logger.error('Error fetching local entries:', error)
		return res.status(500).json({ error: error.message })
	}
})

const frontendDistPath = path.resolve(import.meta.dirname, '../../dist')
app.use(express.static(frontendDistPath))

app.get(/(.*)/, (_, res) => {
	res.sendFile(path.join(frontendDistPath, 'index.html'))
})

app.listen(PORT, () => logger.info(`Backend API running on http://localhost:${PORT}`))
