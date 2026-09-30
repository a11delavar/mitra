import { type EntryType } from '../entries/EntryType.js'

/** The reminders a new entry starts with, per kind, in minutes before its anchor (null = none). */
export class ReminderDefaults {
	constructor(readonly event: number | null, readonly task: number | null) { }

	for(type: EntryType): Array<number> | null {
		const minutes = type.isTask ? this.task : this.event
		return minutes === null ? null : [minutes]
	}
}
