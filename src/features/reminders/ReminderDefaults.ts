import { equals } from '@a11d/equals'
import type { Entry } from '#features/entries/Entry.js'
import type { UserSettings } from '#features/settings/UserSettings.js'
import { EntryReminders } from './EntryReminders.js'

/**
 * The reminders a new entry starts with, per kind, in minutes before its anchor (null = none). The browser registers the
 * account's ({@link ReminderDefaults.from}), as `@include` finds a source: a new entry starts with them, and reminders still
 * on them follow them when the entry's kind changes. The server registers none, and asks the user's ({@link ReminderDefaults.of}).
 */
export class ReminderDefaults {
	/** Mitra's own, until the account chooses: half an hour before an event, a task at its time. */
	static readonly standard = new ReminderDefaults(30, 0)

	/** The account's, as its settings keep them, a kind it never chose falling back to Mitra's own. */
	static of(settings: Pick<UserSettings, 'defaultReminderMinutes' | 'defaultTaskReminderMinutes'> | undefined) {
		const { defaultReminderMinutes: event, defaultTaskReminderMinutes: task } = settings ?? {}
		return new ReminderDefaults(event === undefined ? ReminderDefaults.standard.event : event, task === undefined ? ReminderDefaults.standard.task : task)
	}

	private static provider?: () => ReminderDefaults

	/** Where the browser's entries find the account's defaults; none clears them. */
	static from(provider: (() => ReminderDefaults) | undefined) {
		ReminderDefaults.provider = provider
	}

	/** The account's, where they are registered. */
	static get current() {
		return ReminderDefaults.provider?.()
	}

	constructor(readonly event: number | null, readonly task: number | null) { }

	/** What these give `entry`: its kind's, where a time anchors them; none for availability, a day, or an entry with no time. */
	for(entry: Pick<Entry, 'type' | 'allDay' | 'reminderAnchor'>) {
		if (entry.type.isAvailability || entry.allDay || !entry.reminderAnchor) {
			return undefined
		}
		const minutes = entry.type.isTask ? this.task : this.event
		return minutes === null ? undefined : EntryReminders.normalize([minutes])
	}

	/** Whether `entry`'s reminders are the ones these give it, so they follow these rather than being the user's own. */
	gave(entry: Pick<Entry, 'type' | 'allDay' | 'reminderAnchor' | 'reminders'>) {
		return Object[equals](entry.reminders, this.for(entry))
	}
}
