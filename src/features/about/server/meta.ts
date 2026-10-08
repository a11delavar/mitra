import { Router } from 'express'
import { isDemo, isDeveloperSystem } from '../../../infrastructure/environment.js'
import { updateChecker } from './updates.js'
import { getReleaseSources, runningReleaseUrl } from './changelog.js'

export const metaRouter = Router()

// Only an operator's name travels: without one the client names itself, in the viewer's language.
const instanceName = process.env.MITRA_NAME

/**
 * Returns instance metadata and update status for authenticated users.
 */
metaRouter.get('/', (_req, res) => {
	return res.json({
		...(instanceName ? { name: instanceName } : {}),
		version: mitra.version,
		commit: mitra.commit,
		node: process.version,
		...(isDeveloperSystem ? { development: true } : {}),
		...(isDemo ? { demo: true } : {}),
		...(runningReleaseUrl() ? { releaseUrl: runningReleaseUrl() } : {}),
		...(updateChecker.update ? { update: updateChecker.update } : {}),
	})
})

metaRouter.get('/releases', async (_req, res) => {
	return res.json(await getReleaseSources())
})
