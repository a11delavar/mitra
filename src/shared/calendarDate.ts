/**
 * The calendar date an instant reads as in `zone`, as a `Temporal.PlainDate` — the single
 * instant → date primitive for domain code holding absolute instants (entry starts, exclusions)
 * that must be interpreted as SOMEONE's days. NB: never SPREAD a `PlainDate` (its fields are
 * prototype getters — a spread yields `{}`); read `year`/`month`/`day` explicitly.
 *
 * `zone` absent falls back to the runtime's local zone — correct in the browser (whose zone stamped
 * the times) and the documented legacy behavior on the server for entries that carry no `timeZone`.
 */
export function calendarDateOf(instant: Date, zone?: string | null): Temporal.PlainDate {
	if (!zone) {
		return Temporal.PlainDate.from({ year: instant.getFullYear(), month: instant.getMonth() + 1, day: instant.getDate() })
	}
	return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDate()
}

/**
 * The instant at which `date` begins in `zone` — its local midnight there; the date → instant
 * primitive, inverse of {@link calendarDateOf}. `zone` is required: a date is only ever anchored to a
 * KNOWN zone (`'UTC'` for the canonical all-day encoding, or a viewer's zone) — unlike reading a date
 * OUT of an instant, where no zone means "the runtime's local day". Temporal's start-of-day semantics
 * resolve a midnight skipped by a DST jump to the day's first existing wall-clock time.
 */
export function midnightOf(date: Temporal.PlainDate, zone: string): Date {
	return new Date(date.toZonedDateTime(zone).epochMilliseconds)
}

// --- The all-day API boundary --------------------------------------------------------------------
// An all-day bound is a DATE, but it's stored and carried as an INSTANT (a `Date`/epoch-ms column, so
// the whole Entry model can hold one field type) — CANONICALLY as the date's UTC midnight, which is
// zone-less and deterministic on every server (the container's TZ is irrelevant). Crossing the
// boundary therefore always reinterprets across zones — read which date the instant falls on in one
// zone, re-anchor its midnight in another — so the event covers the same calendar dates, midnight to
// midnight, for every viewer.

/**
 * Normalize an instant to the CANONICAL all-day bound of the calendar date it falls on in `zone`
 * (that date's UTC midnight). The WRITE side: what the API stores when a viewer in `zone`
 * creates/edits an all-day entry. Inverse of {@link projectAllDay}.
 */
export function normalizeAllDay(instant: Date, zone?: string | null): Date {
	return midnightOf(calendarDateOf(instant, zone), 'UTC')
}

/**
 * Project a canonical all-day bound to the instant it begins at in `zone` — the date's local
 * midnight there. The READ side: a stored UTC-midnight date rendered for a viewer. Inverse of
 * {@link normalizeAllDay}.
 */
export function projectAllDay(canonical: Date, zone: string): Date {
	return midnightOf(calendarDateOf(canonical, 'UTC'), zone)
}
