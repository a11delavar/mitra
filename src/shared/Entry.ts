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
	// No default: the backend assigns the id on create. A locally-created entry (a drag draft) has no id
	// until then — `persisted` (below) is the single, intrinsic source of "is this still a draft". The
	// explicit `type` is required because, without a default value, MikroORM can't infer the column type.
	@primaryKey({ type: 'string' }) id?: string
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string
	@property({ type: 'string', nullable: true }) uri?: string

	@enumType(() => EntryType) type!: EntryType

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime
	@property({ type: 'boolean', nullable: true }) done?: boolean

	@property({ type: 'boolean' }) allDay = false

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

	/** Whether the backend has assigned this entry an id. A locally-created draft has none until it's
	 * saved, so `!persisted` *is* "this is a draft" — no separate flag or side store to keep in sync. */
	get persisted() {
		return this.id !== undefined
	}

	get multiDay() {
		return !!this.start && !!this.end && !this.start.dayStart.equals(this.end.dayStart)
	}
}
