import { z } from 'zod'
import { ValidationError } from '#infrastructure/validation'

/**
 * A point in time, an ISO string on the wire and a `Date` in the domain. Nothing revives dates on its own, as a reviver
 * matching any text that holds a timestamp turned descriptions into dates, so each date field declares this.
 */
export const instant = {
	schema: z.iso.datetime({ offset: true }),

	/** The point in time `text` names, refused when it names none. */
	read(text: string) {
		const date = new Date(text)
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(`"${text}" names no point in time. Write it in ISO 8601 with its offset (2026-10-14T16:30:00Z).`)
		}
		return date
	},

	construct<T extends Date | null | undefined>(value: string | T) {
		return typeof value === 'string' ? instant.read(value) : value
	},
}
