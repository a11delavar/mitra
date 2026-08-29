import { Router } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { User, type UserTimeZone } from '../User.js'
export const userRouter = Router()

userRouter.get('/', (req, res) => {
	return res.json(req.user)
})

/** Validates time zone identifier via Intl.DateTimeFormat. */
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
	req.user.timeZones = user.timeZones
	return res.json(user)
})

/** Updates last seen release notes version for the current user. */
userRouter.put('/seen-version', async (req, res) => {
	const version = req.body.version
	if (typeof version !== 'string' || !version.trim() || version.length > 64) {
		return res.status(400).json({ error: 'Invalid version' })
	}
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.lastSeenVersion = version
	await em.flush()
	req.user.lastSeenVersion = user.lastSeenVersion
	return res.json(user)
})

/** Updates user settings JSON bag. */
userRouter.put('/settings', async (req, res) => {
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.applySettings(req.body.settings)
	await em.flush()
	req.user.settings = user.settings
	return res.json(user)
})

userRouter.put('/default-source', async (req, res) => {
	const sourceId = (req.body.sourceId ?? null) as string | null
	const em = orm.em.fork()
	if (sourceId !== null) {
		await req.user.source(em, sourceId)
	}
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.defaultSourceId = sourceId ?? undefined
	await em.flush()
	req.user.defaultSourceId = user.defaultSourceId
	return res.json(user)
})
