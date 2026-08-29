import type { DateTime } from '@3mo/date-time'
import { type Entry } from '../Entry.js'
import { SnapSetting } from './SnapSetting.js'
import { EntryStore } from './EntryStore.js'

export interface TimedOverlap {
	readonly slot: number
	readonly total: number
	readonly span: number
	readonly inset: number
}

/**
 * Single-day projection of an entry rendered across calendar views.
 */
export class EntrySegment {
	previous?: EntrySegment
	next?: EntrySegment
	overlap?: TimedOverlap
	covers = false

	constructor(readonly entry: Entry, readonly date?: DateTime) { }

	get hasPrevious() { return !!this.previous }
	get hasNext() { return !!this.next }

	private _startMinute?: number
	get startMinute() {
		return this._startMinute ??= this.previous ? 1 : this.entry.start ? this.entry.start.hour * 60 + this.entry.start.minute + 1 : 1
	}

	private _endMinute?: number
	get endMinute() {
		if (this._endMinute === undefined) {
			const endsPastDay = this.dayValue !== undefined && !!this.entry.end && this.entry.end.dayStart.valueOf() > this.dayValue
			const line = endsPastDay ? 1441 : this.entry.end ? this.entry.end.hour * 60 + this.entry.end.minute + 1 : undefined
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
		return !!this.previous || !!this.next || !!this.entry.allDay
	}

	get runEnd(): EntrySegment {
		return this.next?.runEnd ?? this
	}

	get id() {
		return `${this.entry.id ?? (EntryStore.isPreview(this.entry) ? 'preview' : 'draft')}-${this.dayValue ?? 0}`
	}

	fallsOn(dayValue: number) {
		return this.date ? this.dayValue === dayValue : this.entry.start?.dayStart.valueOf() === dayValue
	}

	fallsOnDay(date: DateTime) {
		return this.fallsOn(date.dayStart.valueOf())
	}

	overlaps(other: EntrySegment) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}
}
