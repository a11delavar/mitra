import { Router } from 'express'
import { orm } from './orm.js'
import { User, type UserTimeZone } from '../shared/index.js'

export const userRouter = Router()

userRouter.get('/', (req, res) => {
	return res.json(req.user)
})

/** An id names a real zone iff Intl can format in it — authoritative on this very runtime. */
function isValidTimeZone(id: string): boolean {
	try {
		new Intl.DateTimeFormat(undefined, { timeZone: id })
		return true
	} catch {
		return false
	}
}

userRouter.put('/time-zones', async (req, res) => {
	const incoming = (req.body.timeZones ?? []) as Array<UserTimeZone>
	if (!Array.isArray(incoming) || incoming.some(zone => typeof zone?.id !== 'string' || !isValidTimeZone(zone.id))) {
		return res.status(400).json({ error: 'Invalid time zone list' })
	}
	if (new Set(incoming.map(zone => zone.id)).size !== incoming.length) {
		return res.status(400).json({ error: 'Duplicate time zones' })
	}
	const timeZones = incoming.map(zone => ({
		id: zone.id,
		...(typeof zone.label === 'string' && zone.label.trim() ? { label: zone.label.trim().slice(0, 24) } : {}),
	}))
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.timeZones = timeZones.length ? timeZones : undefined
	await em.flush()
	// Keep the request's user (a different entity manager's instance) in sync so a follow-up GET reflects the change.
	req.user.timeZones = user.timeZones
	return res.json(user)
})

userRouter.put('/default-source', async (req, res) => {
	const sourceId = (req.body.sourceId ?? null) as string | null
	const em = orm.em.fork()
	if (sourceId !== null) {
		await req.user.source(em, sourceId) // 404s a source that isn't the user's own
	}
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.defaultSourceId = sourceId ?? undefined
	await em.flush()
	// Keep the request's user (a different entity manager's instance) in sync so a follow-up GET reflects the change.
	req.user.defaultSourceId = user.defaultSourceId
	return res.json(user)
})
