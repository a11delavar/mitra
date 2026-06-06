import { Router } from 'express'
import { orm } from './orm.js'
import { Source, User } from '../shared/index.js'

export const userRouter = Router()

userRouter.get('/', (req, res) => {
	return res.json((req as any).user as User)
})

userRouter.put('/default-source', async (req, res) => {
	const sourceId = (req.body.sourceId ?? null) as string | null
	const em = orm.em.fork()
	if (sourceId !== null) {
		await em.findOneOrFail(Source, { id: sourceId })
	}
	const user = await em.findOneOrFail(User, { id: ((req as any).user as User).id })
	user.defaultSourceId = sourceId ?? undefined
	await em.flush()
	// Keep the auth singleton (attached to every request) in sync so a follow-up GET reflects the change.
	;((req as any).user as User).defaultSourceId = user.defaultSourceId
	return res.json(user)
})
