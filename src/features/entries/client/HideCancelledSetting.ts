import { setting, ToggleSetting, userStorage, type SettingStorage } from '#features/settings/client/Setting.js'
import type { EntryOccurrence } from '#features/recurrence'
import { EntryLens } from './EntryLens.js'
import { EntryStore } from './EntryStore.js'

const stored = userStorage('hideCancelled')

/** Lens keeping cancelled tasks and events out of the surfaces that draw them. */
@setting()
export class HideCancelledSetting extends ToggleSetting {
	private static readonly default = false
	private static readonly lens = new EntryLens(entry => entry.cancelled)

	static get current(): boolean {
		return stored.read() ?? HideCancelledSetting.default
	}

	static shows(occurrence: EntryOccurrence, hidden = HideCancelledSetting.current) {
		return HideCancelledSetting.lens.shows(occurrence, hidden)
	}

	static filter(occurrences: ReadonlyArray<EntryOccurrence>, hidden = HideCancelledSetting.current) {
		return HideCancelledSetting.lens.filter(occurrences, hidden)
	}

	readonly heading = t('Hide cancelled')
	readonly icon = 'eye-off'
	readonly keywords = t('HideCancelledSetting.Keywords')
	readonly page = 'calendar'
	readonly fallback = HideCancelledSetting.default

	override get hint() {
		return t('Cancelled tasks and events leave the calendar. Search still finds them, and a cancelled task still counts towards progress.')
	}

	protected readonly storage: SettingStorage<boolean> = {
		read: () => stored.read(),
		write: async value => {
			await stored.write(value)
			EntryStore.notify()
		},
	}
}

EntryStore.lenses.add(occurrences => HideCancelledSetting.filter(occurrences))
