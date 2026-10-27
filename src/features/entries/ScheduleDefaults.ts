import type { UserSettings } from '#features/settings/UserSettings.js'

/**
 * Where a time lands and how long it lasts where nothing else says: the account's default length, which the browser
 * registers ({@link ScheduleDefaults.from}) as `@include` finds a source, and the working day a day's entry and due date
 * take their hours from. The server registers none, and an entry there lasts Mitra's own.
 */
export class ScheduleDefaults {
	/** Mitra's own, until the account chooses: an hour. */
	static readonly standard = new ScheduleDefaults(60)

	/** The account's, as its settings keep them. */
	static of(settings: Pick<UserSettings, 'defaultDurationMinutes'> | undefined) {
		return new ScheduleDefaults(settings?.defaultDurationMinutes ?? ScheduleDefaults.standard.duration)
	}

	private static provider?: () => ScheduleDefaults

	/** Where the browser's entries find the account's defaults; none clears them. */
	static from(provider: (() => ScheduleDefaults) | undefined) {
		ScheduleDefaults.provider = provider
	}

	/** The account's where they are registered, else Mitra's own. */
	static get current() {
		return ScheduleDefaults.provider?.() ?? ScheduleDefaults.standard
	}

	/** `duration`: the minutes a new timed entry lasts. */
	constructor(readonly duration: number) { }

	/** The time a day's entry takes when it gains one: the start of the working day. */
	timeOn(day: DateTime) {
		return day.dayStart.with({ hour: 9 })
	}

	/** The time a due date on `day` takes when it gains one: the end of the working day. */
	dueOn(day: DateTime) {
		return day.dayStart.with({ hour: 17 })
	}
}
