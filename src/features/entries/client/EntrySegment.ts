import type { DateTime } from '@3mo/date-time'
import { type EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { SnapSetting } from './SnapSetting.js'
import { EntryStore } from './EntryStore.js'

export interface TimedOverlap {
	readonly slot: number
	readonly total: number
	readonly span: number
	readonly inset: number
}

/** One day of an occurrence, as the views lay it out. */
export class EntrySegment {
	previous?: EntrySegment
	next?: EntrySegment
	overlap?: TimedOverlap
	covers = false

	constructor(readonly occurrence: EntryOccurrence, readonly date?: DateTime) { }

	/** What it shows. */
	get entry() {
		return this.occurrence.entry
	}

	get hasPrevious() { return !!this.previous }
	get hasNext() { return !!this.next }

	private _startMinute?: number
	get startMinute() {
		const { start } = this.occurrence
		return this._startMinute ??= this.previous ? 1 : start ? start.hour * 60 + start.minute + 1 : 1
	}

	private _endMinute?: number
	get endMinute() {
		if (this._endMinute === undefined) {
			const { end } = this.occurrence
			const endsPastDay = this.dayValue !== undefined && !!end && end.dayStart.valueOf() > this.dayValue
			const line = endsPastDay ? 1441 : end ? end.hour * 60 + end.minute + 1 : undefined
			this._endMinute = line !== undefined && line > this.startMinute ? line : Math.min(this.startMinute + SnapSetting.current, 1441)
		}
		return this._endMinute
	}

	/** Midnight epoch-ms for the segment's day. */
	private _dayValue?: number
	get dayValue(): number | undefined {
		return this._dayValue ??= this.date?.dayStart.valueOf()
	}

	get allDay() {
		return !!this.previous || !!this.next || this.occurrence.allDay
	}

	get runEnd(): EntrySegment {
		return this.next?.runEnd ?? this
	}

	get id() {
		return `${this.occurrence.key ?? (EntryStore.isPreview(this.entry) ? 'preview' : 'draft')}-${this.dayValue ?? 0}`
	}

	fallsOn(dayValue: number) {
		return this.date ? this.dayValue === dayValue : this.occurrence.start?.dayStart.valueOf() === dayValue
	}

	fallsOnDay(date: DateTime) {
		return this.fallsOn(date.dayStart.valueOf())
	}

	overlaps(other: EntrySegment) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}
}
