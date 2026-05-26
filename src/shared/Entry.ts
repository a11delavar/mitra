import { type DateTime } from '@3mo/date-time'
import { model } from './model.js'
import { EntrySegment } from './EntrySegment.js'
import { entity, primaryKey, property, manyToOne, enum as enumType, unique } from './orm.js'
import { Source } from './Source.js'

export enum EntryType {
	Event = 'event',
	Task = 'task',
}

@model('Entry')
@entity()
@unique({ properties: ['source', 'externalId'] })
export class Entry {
	@primaryKey() id = crypto.randomUUID() as string
	@property({ type: 'string' }) externalId!: string
	@manyToOne(() => Source) source!: Source

	@enumType(() => EntryType) type!: EntryType

	@property({ type: 'string', nullable: true }) url?: string
	@property({ type: 'string', nullable: true }) etag?: string
	@property({ type: 'text', nullable: true }) rawData?: string
	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	@property({ type: 'string', nullable: true }) color?: string

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime
	@property({ type: 'boolean', nullable: true }) done?: boolean

	constructor(init?: Partial<Entry>) {
		Object.assign(this, init)
	}

	get segments(): EntrySegment[] {
		if (!this.start || !this.end) return [new EntrySegment(this)]

		const start = this.start
		const end = this.end

		const startDay = start.dayStart
		const endDay = end.dayStart

		if (startDay.equals(endDay) || (end.hour === 0 && end.minute === 0 && startDay.equals(endDay.subtract({ days: 1 })))) {
			return [new EntrySegment(this, { date: startDay })]
		}

		const segments = new Array<EntrySegment>()
		let currentDay = startDay

		while (currentDay.isBefore(endDay) || (currentDay.equals(endDay) && (this.end.hour > 0 || this.end.minute > 0))) {
			const dayEnd = currentDay.add({ days: 1 })

			segments.push(new EntrySegment(this, {
				date: currentDay,
				continuedFromPrevious: start.isBefore(currentDay),
				continuesNext: end.isAfter(dayEnd),
			}))

			currentDay = dayEnd
		}

		return segments
	}

	get allDay() {
		return this.start && this.end
			&& this.start.hour === 0 && this.start.minute === 0
			&& this.end.hour === 0 && this.end.minute === 0
	}
}
