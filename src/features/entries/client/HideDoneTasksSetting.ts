import { setting, ToggleSetting, userStorage, type SettingStorage } from '../../settings/client/Setting.js'
import { type Entry } from '../Entry.js'
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

	/** Whether a surface draws this entry. Closed tasks remain visible while their editor is active. */
	static shows(entry: Entry, hidden = HideDoneTasksSetting.current) {
		return !hidden || !entry.type.isTask || !entry.closed || EntryEditorIntent.holds(entry)
	}

	private static readonly filtered = new WeakMap<ReadonlyArray<Entry>, { hidden: boolean, result: ReadonlyArray<Entry> }>()

	/**
	 * Filters entries for display, memoized on input array identity.
	 * Returns input untouched when lens is disabled.
	 */
	static filter(entries: ReadonlyArray<Entry>, hidden = HideDoneTasksSetting.current): ReadonlyArray<Entry> {
		const cached = HideDoneTasksSetting.filtered.get(entries)
		if (cached?.hidden === hidden) {
			return cached.result
		}
		const result = !hidden ? entries : entries.filter(entry => HideDoneTasksSetting.shows(entry, hidden))
		HideDoneTasksSetting.filtered.set(entries, { hidden, result })
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
