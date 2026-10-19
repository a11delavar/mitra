import { type RequestHandler } from 'express'

/**
 * A tab from an older Mitra reloads before it writes: one from before all-day dates traveled as days sends its zone with
 * every write, and one from before occurrences had their own address changes or deletes one through its entry's, which
 * would now reach the whole entry.
 */
export const staleTabs: RequestHandler = (req, res, next) => req.method !== 'GET' && (req.query.tz || req.query.recurrenceId)
	? res.status(409).json({ error: 'Mitra was updated. Reload the page to save your changes.' })
	: next()
