import { html } from '@a11d/lit'
import { SetDefaultCalendar } from '#operations'
import { ChoiceSetting, setting, type SettingStorage } from '#features/settings/client/Setting.js'
import { session } from '#infrastructure/http/PageSession.js'
import { Calendars } from './Calendars.js'

/**
 * Default source calendar setting for newly created entries (syncs with primary source).
 */
@setting()
export class DefaultSourceSetting extends ChoiceSetting<string> {
	readonly heading = t('Default Calendar')
	readonly icon = 'calendar-check'
	readonly keywords = t('DefaultSourceSetting.Keywords')
	readonly page = 'entries'
	override get hint() { return t('Where new events and tasks are created') }

	get fallback() { return Calendars.getPrimary()?.id ?? '' }

	protected readonly storage: SettingStorage<string> = {
		read: () => Calendars.defaultId,
		write: async value => {
			await session.keepUser(SetDefaultCalendar.call({ sourceId: value ?? null }))
			document.querySelector('mitra-sidebar')?.requestUpdate()
		},
	}

	override get options() {
		return Calendars.visible.map(source => ({ value: source.id, label: source.name }))
	}

	override get glyph() {
		return html`<mitra-source-icon .source=${Calendars.getSource(this.value)}></mitra-source-icon>`
	}
}
