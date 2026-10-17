import { type RequestHandler } from 'express'

/** A tab from before all-day dates traveled as days sends its zone with every write, and those days as its own midnights: it reloads first. */
export const staleTabs: RequestHandler = (req, res, next) => req.method !== 'GET' && req.query.tz
	? res.status(409).json({ error: 'Mitra was updated. Reload the page to save your changes.' })
	: next()
