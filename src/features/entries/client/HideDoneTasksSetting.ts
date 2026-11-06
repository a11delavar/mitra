import { setting, ToggleSetting, userStorage, type SettingStorage } from '#features/settings/client/Setting.js'
import type { EntryOccurrence } from '#features/recurrence'
import { EntryLens } from './EntryLens.js'
import { EntryStore } from './EntryStore.js'

const stored = userStorage('hideDoneTasks')

/** Lens keeping done tasks out of the surfaces that draw them; cancelled ones are {@link HideCancelledSetting}'s. */
@setting()
export class HideDoneTasksSetting extends ToggleSetting {
	private static readonly default = false
	private static readonly lens = new EntryLens(entry => entry.done)

	static get current(): boolean {
		return stored.read() ?? HideDoneTasksSetting.default
	}

	static shows(occurrence: EntryOccurrence, hidden = HideDoneTasksSetting.current) {
		return HideDoneTasksSetting.lens.shows(occurrence, hidden)
	}

	static filter(occurrences: ReadonlyArray<EntryOccurrence>, hidden = HideDoneTasksSetting.current) {
		return HideDoneTasksSetting.lens.filter(occurrences, hidden)
	}

	readonly heading = t('Hide done tasks')
	readonly icon = 'eye-off'
	readonly keywords = t('HideDoneTasksSetting.Keywords')
	readonly page = 'calendar'
	readonly fallback = HideDoneTasksSetting.default

	override get hint() {
		return t('Done tasks leave the calendar. Search still finds them, and they still count towards progress.')
	}

	protected readonly storage: SettingStorage<boolean> = {
		read: () => stored.read(),
		write: async value => {
			await stored.write(value)
			EntryStore.notify()
		},
	}
}

EntryStore.showing(occurrences => HideDoneTasksSetting.filter(occurrences))
