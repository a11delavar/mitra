import { setting, ToggleSetting, userStorage, type SettingStorage } from '../../settings/client/Setting.js'
import { type EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntryStore } from './EntryStore.js'

const stored = userStorage('hideDoneTasks')

/**
 * Lens keeping closed tasks out of the surfaces that draw them.
 * The entries stay fetched and whole: search, progress rollups and the sync engine never see the lens.
 */
@setting()
export class HideDoneTasksSetting extends ToggleSetting {
	private static readonly default = false

	static get current(): boolean {
		return stored.read() ?? HideDoneTasksSetting.default
	}

	/** Whether a surface draws this occurrence. Closed tasks remain visible while their editor is active. */
	static shows(occurrence: EntryOccurrence, hidden = HideDoneTasksSetting.current) {
		const { entry } = occurrence
		return !hidden || !entry.type.isTask || !entry.closed || EntryEditorIntent.holds(occurrence)
	}

	private static readonly filtered = new WeakMap<ReadonlyArray<EntryOccurrence>, { hidden: boolean, result: ReadonlyArray<EntryOccurrence> }>()

	/**
	 * Filters occurrences for display, memoized on input array identity.
	 * Returns input untouched when lens is disabled.
	 */
	static filter(occurrences: ReadonlyArray<EntryOccurrence>, hidden = HideDoneTasksSetting.current): ReadonlyArray<EntryOccurrence> {
		const cached = HideDoneTasksSetting.filtered.get(occurrences)
		if (cached?.hidden === hidden) {
			return cached.result
		}
		const result = !hidden ? occurrences : occurrences.filter(occurrence => HideDoneTasksSetting.shows(occurrence, hidden))
		HideDoneTasksSetting.filtered.set(occurrences, { hidden, result })
		return result
	}

	readonly heading = t('Hide done tasks')
	readonly icon = 'eye-off'
	readonly keywords = t('HideDoneTasksSetting.Keywords')
	readonly page = 'calendar'
	readonly fallback = HideDoneTasksSetting.default

	override get hint() {
		return t('Done and cancelled tasks leave the calendar. Search still finds them, and they still count towards progress.')
	}

	protected readonly storage: SettingStorage<boolean> = {
		read: () => stored.read(),
		write: async value => {
			await stored.write(value)
			EntryStore.notify()
		},
	}
}
