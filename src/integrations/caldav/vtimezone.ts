import ICAL from 'ical.js'

/**
 * Builds the RFC 5545 `VTIMEZONE` component for an IANA time zone.
 * Observances are derived by probing offset changes via Temporal and compressed into yearly RRULEs.
 */

const WINDOW_YEARS = 20
const PROBE_MS = 7 * 24 * 60 * 60 * 1000

interface Transition {
	readonly epochMs: number
	readonly fromOffset: number
	readonly toOffset: number
}

interface Observance {
	readonly kind: 'standard' | 'daylight'
	readonly onset: Temporal.PlainDateTime
	readonly fromOffset: number
	readonly toOffset: number
	readonly rrule?: string
}

const offsetAt = (zone: string, epochMs: number) =>
	Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(zone).offsetNanoseconds / 1_000_000_000

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

const onsetOf = (transition: Transition): Temporal.PlainDateTime =>
	Temporal.Instant.fromEpochMilliseconds(transition.epochMs)
		.add({ seconds: transition.fromOffset })
		.toZonedDateTimeISO('UTC').toPlainDateTime()

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

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
	const windowStart = Date.UTC(aroundYear - 1, 0, 1)
	const windowEnd = Date.UTC(aroundYear - 1 + WINDOW_YEARS, 0, 1)
	const transitions = transitionsIn(tzid, windowStart, windowEnd)

	const vtimezone = new ICAL.Component('vtimezone')
	vtimezone.addPropertyWithValue('tzid', tzid)

	if (!transitions.length) {
		const offset = offsetAt(tzid, windowStart)
		addObservance(vtimezone, { kind: 'standard', onset: Temporal.PlainDateTime.from('1970-01-01T00:00:00'), fromOffset: offset, toOffset: offset })
		return vtimezone
	}

	const standardOffset = Math.min(...transitions.map(t => t.toOffset))
	const observances: ReadonlyArray<Observance> = transitions.map(t => ({
		kind: t.toOffset === standardOffset ? 'standard' : 'daylight',
		onset: onsetOf(t), fromOffset: t.fromOffset, toOffset: t.toOffset,
	}))

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
