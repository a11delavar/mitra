/**
 * The calendar date an instant reads as in `zone` — the single day-boundary primitive for domain code
 * holding absolute instants (entry starts, exclusions) that must be interpreted as the USER's days:
 * an all-day entry is stored as its zone's local-midnight instant, which is still the PREVIOUS
 * calendar day in UTC (and in whatever zone the server happens to run in, e.g. a UTC container).
 *
 * `zone` absent falls back to the runtime's local zone — correct in the browser (whose zone stamped
 * the times) and the documented legacy behavior on the server for entries that carry no `timeZone`.
 * Intl-based (no Temporal import) so shared code bundles into the frontend without the polyfill.
 */
export function calendarDateOf(instant: Date, zone?: string | null): { year: number, month: number, day: number } {
	if (!zone) {
		return { year: instant.getFullYear(), month: instant.getMonth() + 1, day: instant.getDate() }
	}
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(instant)
	const part = (type: string) => Number(parts.find(p => p.type === type)?.value)
	return { year: part('year'), month: part('month'), day: part('day') }
}
