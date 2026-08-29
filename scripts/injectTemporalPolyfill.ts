// Feature-detect complete native Temporal implementation (specifically gregorian calendar arithmetic)
// before falling back to temporal-polyfill.
import { Temporal as TemporalPolyfill } from 'temporal-polyfill'

function nativeTemporalComplete(): boolean {
	try {
		const calendar = new Intl.DateTimeFormat().resolvedOptions().calendar
		const zoned = new globalThis.Temporal.ZonedDateTime(0n, 'UTC', calendar)
		zoned.add({ months: 1, days: 1 }).startOfDay()
		zoned.with({ day: 1 })
		return true
	} catch {
		return false
	}
}

if (typeof globalThis.Temporal === 'undefined' || !nativeTemporalComplete()) {
	globalThis.Temporal = TemporalPolyfill
}
