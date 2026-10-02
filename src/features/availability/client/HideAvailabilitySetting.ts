import { setting, ToggleSetting, userStorage, type SettingStorage } from '../../settings/client/Setting.js'
import { EntryStore } from '../../entries/client/EntryStore.js'

const stored = userStorage('hideAvailability')

/** Lens taking availability off the week view. It changes nothing else: busy availability still shows as busy to others. */
@setting()
export class HideAvailabilitySetting extends ToggleSetting {
	private static readonly default = false

	static get current(): boolean {
		return stored.read() ?? HideAvailabilitySetting.default
	}

	readonly heading = t('Hide availability')
	readonly icon = 'eye-off'
	readonly keywords = t('HideAvailabilitySetting.Keywords')
	readonly page = 'calendar'
	readonly fallback = HideAvailabilitySetting.default

	override get hint() {
		return t('Availability leaves the week view. It stays in its calendars, and busy availability still shows as busy to others.')
	}

	protected readonly storage: SettingStorage<boolean> = {
		read: () => stored.read(),
		write: async value => {
			await stored.write(value)
			EntryStore.notify()
		},
	}
}
