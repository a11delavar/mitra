import { Router } from 'express'
import { orm } from '../database/orm.js'

export const healthRouter = Router()

const CHECK_TIMEOUT_MS = 2000

/** Unauthenticated health probe returning 200/503 based on database connectivity. */
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
