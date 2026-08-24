import ICAL from 'ical.js'

/**
 * Build the RFC 5545 `VTIMEZONE` component for an IANA zone — what makes a `DTSTART;TZID=…` legal in
 * an .ics (§3.6.5 requires a matching VTIMEZONE per TZID used) and lets OTHER clients resolve the
 * entry's local times, including DST-correct expansion of recurring series.
 *
 * No timezone database ships with ical.js, so the observances are derived from the runtime's own zone
 * data via the global Temporal — using only the one primitive every implementation agrees on, an
 * instant's offset in a zone (the pre-final-spec `Temporal.TimeZone`/`getNextTransition` API exists
 * solely in the injected polyfill, and the final spec's `getTimeZoneTransition` isn't in it yet, so
 * neither can be relied on). The zone's transitions around `aroundYear` are found by probing that
 * offset across the window and pinning each change by binary search; each side (standard/daylight) is
 * then compressed into a single yearly `RRULE` observance where the pattern is regular — which it is
 * for every currently-DST-observing zone ("last Sunday of March" etc.). Irregular histories (Morocco's
 * Ramadan-suspended DST, say) fall back to listing the window's transitions explicitly; clients apply
 * the last observance onward, so even that degrades gracefully. A zone with no transitions at all
 * (fixed offset — most of the world) is a single standing observance.
 */

/** Transitions enumerated around the anchor year when the pattern is irregular; RRULE-compressed
 * zones don't depend on the window at all. */
const WINDOW_YEARS = 20

/** The coarse probe stride. Every real observance persists far longer (the shortest in the modern
 * tzdb — Morocco's Ramadan standard-time interlude — lasts about a month), so a week's step can never
 * hop over a whole observance and back; each detected change is then pinned by binary search. */
const PROBE_MS = 7 * 24 * 60 * 60 * 1000

interface Transition {
	readonly epochMs: number
	readonly fromOffset: number // seconds
	readonly toOffset: number // seconds
}

interface Observance {
	readonly kind: 'standard' | 'daylight'
	/** The local wall time the observance takes effect, expressed in the PREVIOUS offset (§3.8.2.4). */
	readonly onset: Temporal.PlainDateTime
	readonly fromOffset: number
	readonly toOffset: number
	readonly rrule?: string
}

/** The zone's UTC offset (seconds) at an instant — the single zone-database primitive everything else
 * derives from. Throws on an unresolvable zone id, like any Temporal zone operation. */
const offsetAt = (zone: string, epochMs: number) =>
	Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(zone).offsetNanoseconds / 1_000_000_000

/** The zone's offset changes within [startMs, endMs], each pinned to its exact millisecond. */
function transitionsIn(zone: string, startMs: number, endMs: number): Array<Transition> {
	const transitions = new Array<Transition>()
	let previous = offsetAt(zone, startMs)
	for (let ms = startMs + PROBE_MS; ms <= endMs; ms += PROBE_MS) {
		const current = offsetAt(zone, ms)
		if (current !== previous) {
			let [before, after] = [ms - PROBE_MS, ms]
			while (after - before > 1) {
				const mid = Math.floor((before + after) / 2)
				offsetAt(zone, mid) === previous ? before = mid : after = mid
			}
			transitions.push({ epochMs: after, fromOffset: previous, toOffset: offsetAt(zone, after) })
		}
		previous = current
	}
	return transitions
}

/** The onset wall clock: the transition instant read in the offset that was in effect before it. */
const onsetOf = (transition: Transition): Temporal.PlainDateTime =>
	Temporal.Instant.fromEpochMilliseconds(transition.epochMs)
		.add({ seconds: transition.fromOffset })
		.toZonedDateTimeISO('UTC').toPlainDateTime()

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

/** One yearly RRULE covering every transition in the group, or undefined when the group is irregular.
 * Regular means: same month, same wall time, same offsets, and the same "nth (or last) weekday". */
function yearlyRule(group: ReadonlyArray<Observance>): string | undefined {
	const first = group[0]!
	const same = (get: (o: Observance) => unknown) => group.every(o => get(o) === get(first))
	if (!same(o => o.fromOffset) || !same(o => o.toOffset) || !same(o => o.onset.month)
		|| !same(o => o.onset.hour) || !same(o => o.onset.minute) || !same(o => o.onset.dayOfWeek)) {
		return undefined
	}
	const nth = (o: Observance) => Math.ceil(o.onset.day / 7)
	const last = (o: Observance) => o.onset.day > o.onset.daysInMonth - 7
	const position = group.every(last) ? -1 : group.every(o => nth(o) === nth(first)) ? nth(first) : undefined
	return position === undefined ? undefined
		: `FREQ=YEARLY;BYMONTH=${first.onset.month};BYDAY=${position === -1 ? '-1' : position}${WEEKDAYS[first.onset.dayOfWeek - 1]}`
}

function addObservance(vtimezone: ICAL.Component, observance: Observance) {
	const component = new ICAL.Component(observance.kind)
	component.addPropertyWithValue('dtstart', ICAL.Time.fromData({
		year: observance.onset.year, month: observance.onset.month, day: observance.onset.day,
		hour: observance.onset.hour, minute: observance.onset.minute, second: observance.onset.second,
	}))
	component.addPropertyWithValue('tzoffsetfrom', ICAL.UtcOffset.fromSeconds(observance.fromOffset))
	component.addPropertyWithValue('tzoffsetto', ICAL.UtcOffset.fromSeconds(observance.toOffset))
	if (observance.rrule) {
		component.addPropertyWithValue('rrule', ICAL.Recur.fromString(observance.rrule))
	}
	vtimezone.addSubcomponent(component)
}

export function buildVTimezone(tzid: string, aroundYear: number): ICAL.Component {
	// A year back, so a date BEFORE this year's first transition still resolves against a prior onset
	// (January in a southern-hemisphere DST zone straddling New Year, say).
	const windowStart = Date.UTC(aroundYear - 1, 0, 1)
	const windowEnd = Date.UTC(aroundYear - 1 + WINDOW_YEARS, 0, 1)
	const transitions = transitionsIn(tzid, windowStart, windowEnd)

	const vtimezone = new ICAL.Component('vtimezone')
	vtimezone.addPropertyWithValue('tzid', tzid)

	if (!transitions.length) {
		// Fixed offset (within any horizon that matters): one standing observance from the epoch.
		const offset = offsetAt(tzid, windowStart)
		addObservance(vtimezone, { kind: 'standard', onset: Temporal.PlainDateTime.from('1970-01-01T00:00:00'), fromOffset: offset, toOffset: offset })
		return vtimezone
	}

	// STANDARD is the side transitioning onto the zone's base offset; the other side is DAYLIGHT.
	// (Labels only — the offsets are what clients compute with.)
	const standardOffset = Math.min(...transitions.map(t => t.toOffset))
	const observances: ReadonlyArray<Observance> = transitions.map(t => ({
		kind: t.toOffset === standardOffset ? 'standard' : 'daylight',
		onset: onsetOf(t), fromOffset: t.fromOffset, toOffset: t.toOffset,
	}))

	// All-or-nothing compression: mixing one RRULE side with an explicit-list side would make the
	// explicit side stop "recurring" while the RRULE side continues — skewed beyond the window.
	const kinds = [...new Set(observances.map(o => o.kind))]
	const rules = kinds.map(kind => yearlyRule(observances.filter(o => o.kind === kind)))
	if (rules.every(rule => rule !== undefined)) {
		kinds.forEach((kind, index) => {
			const first = observances.find(o => o.kind === kind)!
			addObservance(vtimezone, { ...first, rrule: rules[index]! })
		})
	} else {
		observances.forEach(observance => addObservance(vtimezone, observance))
	}
	return vtimezone
}
