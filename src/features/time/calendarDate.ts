/**
 * The calendar date an instant reads as in `zone`, as a `Temporal.PlainDate`: the single
 * instant → date primitive for domain code holding absolute instants (entry starts, exclusions)
 * that must be interpreted as SOMEONE's days. NB: never SPREAD a `PlainDate` (its fields are
 * prototype getters, so a spread yields `{}`); read `year`/`month`/`day` explicitly.
 *
 * `zone` absent falls back to the runtime's local zone. That is correct in the browser (whose zone stamped
 * the times) and the documented legacy behavior on the server for entries that carry no `timeZone`.
 */
export function calendarDateOf(instant: Date, zone?: string | null): Temporal.PlainDate {
	if (!zone) {
		return Temporal.PlainDate.from({ year: instant.getFullYear(), month: instant.getMonth() + 1, day: instant.getDate() })
	}
	return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDate()
}

/**
 * The instant at which `date` begins in `zone`, its local midnight there: the date → instant
 * primitive, inverse of {@link calendarDateOf}. `zone` is required: a date is only ever anchored to a
 * KNOWN zone (`'UTC'` for the canonical all-day encoding, or a viewer's zone), unlike reading a date
 * OUT of an instant, where no zone means "the runtime's local day". Temporal's start-of-day semantics
 * resolve a midnight skipped by a DST jump to the day's first existing wall-clock time.
 */
export function midnightOf(date: Temporal.PlainDate, zone: string): Date {
	return new Date(date.toZonedDateTime(zone).epochMilliseconds)
}
