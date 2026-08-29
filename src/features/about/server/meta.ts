import { Router } from 'express'
import { updateChecker } from './updates.js'
import { getChangelog, runningReleaseUrl } from './changelog.js'

export const metaRouter = Router()

const instanceName = process.env.MITRA_NAME || 'Mitra'

/**
 * Returns instance metadata and update status for authenticated users.
 */
metaRouter.get('/', (_req, res) => {
	return res.json({
		name: instanceName,
		version: mitra.version,
		commit: mitra.commit,
		node: process.version,
		...(runningReleaseUrl() ? { releaseUrl: runningReleaseUrl() } : {}),
		...(updateChecker.update ? { update: updateChecker.update } : {}),
	})
})

metaRouter.get('/changelog', async (req, res) => {
	const sections = await getChangelog()
	const limit = Number(req.query.limit) || undefined
	return res.json(limit ? sections.slice(0, limit) : sections)
})
