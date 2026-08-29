import { Localizer, type LanguageCode } from '@3mo/localization'
import { ChoiceSetting, setting, type SettingStorage } from '../../features/settings/client/Setting.js'

/**
 * Application locale preference (updates active language instantly without page reload).
 */
@setting()
export class LanguageSetting extends ChoiceSetting<LanguageCode> {
	/** Supported application language codes. */
	private static readonly languages: Array<LanguageCode> = ['en', 'de', 'fr', 'es', 'pt', 'it']

	/** Formats native localized language name. */
	private static label(code: LanguageCode) {
		const name = new Intl.DisplayNames([code], { type: 'language' }).of(code)
		return !name || name === code ? code.toUpperCase() : name.replace(/^./, first => first.toLocaleUpperCase(code))
	}

	readonly heading = t('Language')
	readonly icon = 'languages'
	readonly keywords = t('LanguageSetting.Keywords')
	readonly page = 'general'
	readonly fallback: LanguageCode = 'en'

	protected readonly storage: SettingStorage<LanguageCode> = {
		read: () => Localizer.languages.current,
		write: value => { Localizer.languages.current = value ?? this.fallback },
	}

	override get options() {
		return LanguageSetting.languages.map(code => ({ value: code, label: LanguageSetting.label(code) }))
	}
}
