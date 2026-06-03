import { type DateTime } from '@3mo/date-time'
import { model } from './model.js'
import { entity, primaryKey, property, enum as enumType, unique, manyToOne } from './orm.js'
import { Source } from './Source.js'

export enum EntryType {
	Event = 'event',
	Task = 'task',
}

export interface EntryData {
	raw?: string
	etag?: string
}

@model('Entry')
@entity()
@unique({ properties: ['sourceId', 'uri'] })
export class Entry {
	@primaryKey() id: string = crypto.randomUUID()
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string
	@property({ type: 'string', nullable: true }) uri?: string

	@enumType(() => EntryType) type!: EntryType

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime
	@property({ type: 'boolean', nullable: true }) done?: boolean

	@property({ type: 'json', nullable: true }) data?: EntryData

	get duration() {
		if (!this.start || !this.end) {
			return undefined
		}

		const minutes = this.end.since(this.start).minutes

		return new Intl.DurationFormat(Localizer.languages.current, { style: 'narrow' }).format({
			days: Math.floor(minutes / 60 / 24),
			hours: Math.floor(minutes / 60),
			minutes: Math.floor(minutes % 60)
		})
	}

	constructor(init?: Partial<Entry>) {
		Object.assign(this, init)
	}

	get allDay() {
		return this.start && this.end
			&& this.start.hour === 0 && this.start.minute === 0
			&& this.end.hour === 0 && this.end.minute === 0
	}

	get multiDay() {
		return !!this.start && !!this.end && !this.start.dayStart.equals(this.end.dayStart)
	}
}
