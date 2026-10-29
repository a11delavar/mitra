import ICAL from 'ical.js'
import { TimeZone } from '#features/time/TimeZone.js'

// A recurring entry repeats at a wall-clock time in its zone, 09:00 staying 09:00 across DST: ical.js iterates floating
// times and Temporal turns them into instants.

function wallAnchor(instant: Date, zone: TimeZone): ICAL.Time {
	const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone.id)
	return ICAL.Time.fromData({ year: zoned.year, month: zoned.month, day: zoned.day, hour: zoned.hour, minute: zoned.minute, second: zoned.second })
}

/** `compatible` resolves a DST gap forward and an overlap to its first reading, as calendars do. */
function wallToInstantMs(time: ICAL.Time, zone: TimeZone): number {
	return Temporal.PlainDateTime.from({ year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second })
		.toZonedDateTime(zone.id, { disambiguation: 'compatible' }).epochMilliseconds
}

export interface RecurrenceSpan {
	readonly start: Date
	readonly end: Date
}

/** The dates a rule generates from its anchor, less its exclusions (RFC 5545 §3.8.5), yielded lazily in order. */
export class RecurrenceSet implements Iterable<RecurrenceSpan> {
	static fromRule(rrule: string, start: Date, end: Date | undefined, exdates: ReadonlyArray<number> = [], zone = TimeZone.UTC): RecurrenceSet | undefined {
		let rule: ICAL.Recur
		try {
			rule = ICAL.Recur.fromString(rrule)
		} catch {
			return undefined
		}
		if (!rule.freq) {
			return undefined
		}
		return new RecurrenceSet(rule, wallAnchor(start, zone), end ? end.getTime() - start.getTime() : 0, new Set(exdates), zone)
	}

	private constructor(
		private readonly rule: ICAL.Recur,
		private readonly anchor: ICAL.Time,
		private readonly durationMs: number,
		private readonly exdates: ReadonlySet<number>,
		private readonly zone: TimeZone,
	) { }

	/** Every start the rule generates, exclusions included. */
	private *generated(maxIterations = 100_000): Generator<number, void, undefined> {
		const iterator = this.rule.iterator(this.anchor)
		let previousMs = -Infinity
		for (let i = 0; i < maxIterations; i++) {
			const time = iterator.next()
			if (!time) {
				return
			}
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs) {
				return
			}
			previousMs = startMs
			yield startMs
		}
	}

	*[Symbol.iterator](): Generator<RecurrenceSpan, void, undefined> {
		for (const startMs of this.generated()) {
			if (!this.exdates.has(startMs)) {
				yield { start: new Date(startMs), end: new Date(startMs + this.durationMs) }
			}
		}
	}

	/** Blind to exclusions, as RFC 5545 counts COUNT before EXDATEs prune the set. */
	generatedBefore(instant: Date): number {
		let generated = 0
		for (const startMs of this.generated()) {
			if (startMs >= instant.getTime()) {
				break
			}
			generated++
		}
		return generated
	}

	/** The spans starting at or after `after`. */
	*from(after: Date): Generator<RecurrenceSpan, void, undefined> {
		for (const span of this) {
			if (span.start >= after) {
				yield span
			}
		}
	}

	/** The spans overlapping the window. */
	within(windowStart: Date, windowEnd: Date): Array<RecurrenceSpan> {
		const spans = new Array<RecurrenceSpan>()
		for (const span of this) {
			if (span.start > windowEnd) {
				break
			}
			if (span.end >= windowStart) {
				spans.push(span)
			}
		}
		return spans
	}

	/** The span in progress or next to come, else the last; `skip` passes over overridden starts. */
	nearest(instant: Date, skip: (startMs: number) => boolean = () => false): RecurrenceSpan | undefined {
		let nearest: RecurrenceSpan | undefined
		for (const span of this) {
			if (skip(span.start.getTime())) {
				continue
			}
			nearest = span
			if (span.end >= instant) {
				break
			}
		}
		return nearest
	}
}
