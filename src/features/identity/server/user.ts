import { Router, type Request, type Response } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { TimeZone } from '../../time/TimeZone.js'
import { UserTimeZones } from '../../time/UserTimeZones.js'
import { User } from '../User.js'
export const userRouter = Router()

userRouter.get('/', (req, res) => {
	return res.json(req.user)
})

/** Applies one step to what is stored rather than a whole list, so a device's change never overwrites another's that came first. */
async function changeTimeZones(req: Request, res: Response, zone: unknown, change: (zones: UserTimeZones, zone: TimeZone) => UserTimeZones) {
	const parsed = TimeZone.parse(zone)
	if (!parsed) {
		return res.status(400).json({ error: 'Unknown time zone' })
	}
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.timeZones = change(user.timeZones ?? UserTimeZones.none, parsed)
	await em.flush()
	req.user.timeZones = user.timeZones
	return res.json(user)
}

/** The zone a device runs in becomes home, unless the account has one. */
userRouter.post('/time-zones/settle', (req, res) => changeTimeZones(req, res, req.body.id, (zones, zone) => zones.settle(zone)))
userRouter.put('/time-zones/home', (req, res) => changeTimeZones(req, res, req.body.id, (zones, zone) => zones.makeHome(zone)))
userRouter.post('/time-zones', (req, res) => changeTimeZones(req, res, req.body.id, (zones, zone) => zones.add(zone)))
userRouter.delete('/time-zones/:id', (req, res) => changeTimeZones(req, res, req.params.id, (zones, zone) => zones.remove(zone)))
userRouter.put('/time-zones/:id/label', (req, res) => changeTimeZones(req, res, req.params.id,
	(zones, zone) => zones.rename(zone, typeof req.body.label === 'string' ? req.body.label : undefined)))

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
