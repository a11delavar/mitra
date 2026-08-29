import { html } from '@a11d/lit'
import { getDefaultSourceId, getPrimarySource, getSource, getVisibleSources, setDefaultSource } from '../../../infrastructure/http/Api.js'
import { ChoiceSetting, setting, type SettingStorage } from '../../settings/client/Setting.js'

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

	get fallback() { return getPrimarySource()?.id ?? '' }

	protected readonly storage: SettingStorage<string> = {
		read: () => getDefaultSourceId(),
		write: async value => {
			await setDefaultSource(value)
			document.querySelector('mitra-sidebar')?.requestUpdate()
		},
	}

	override get options() {
		return getVisibleSources().map(source => ({ value: source.id, label: source.name }))
	}

	override get glyph() {
		return html`<mitra-source-icon .source=${getSource(this.value)}></mitra-source-icon>`
	}
}
