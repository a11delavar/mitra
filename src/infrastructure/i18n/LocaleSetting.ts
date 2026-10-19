import { html, live } from '@a11d/lit'
import { Localizer, type LanguageCode } from '@3mo/localization'
import { ChoiceSetting, setting, userStorage, type SettingStorage } from '../../features/settings/client/Setting.js'
import { AppLocale } from './AppLocale.js'
import './LocalePreview.js'

/**
 * The locale the app runs in, chosen as a language and, folded under it, the region it is written in: `en`, which reads
 * as the browser writes English, or `en-GB`. Applies at once, without a reload.
 */
@setting()
export class LocaleSetting extends ChoiceSetting<string> {
	private static readonly languages: Array<LanguageCode> = ['en', 'de', 'fr', 'es', 'pt', 'it', 'fa', 'zh']

	/**
	 * @3mo/localization speaks a `?lang=` link's language (the website's links into the demo carry one), but only while
	 * the address holds it, and the calendar rewrites the address at once: a supported one is kept as the choice.
	 */
	static rememberLinkedLanguage() {
		if (new URLSearchParams(location.search).has('lang') && LocaleSetting.languages.includes(Localizer.locales.current.language as LanguageCode)) {
			Localizer.locales.current = Localizer.locales.current
		}
	}

	private static readonly account = userStorage('locale')

	/** The language and region this device shows, the region only where one is chosen. */
	private static get shown() {
		const { language } = Localizer.locales.current
		const region = AppLocale.chosenRegion
		return region ? `${language}-${region}` : language
	}

	/** A device shows the language and region chosen for the account, which are chosen once for every device. */
	static followAccount() {
		const chosen = LocaleSetting.account.read()
		if (chosen && chosen !== LocaleSetting.shown) {
			const locale = new Intl.Locale(chosen)
			AppLocale.set(locale.language, locale.region)
		}
	}

	/** The language's own name for itself. */
	private static label(code: LanguageCode) {
		const name = new Intl.DisplayNames([code], { type: 'language' }).of(code)
		return !name || name === code ? code.toUpperCase() : name.replace(/^./, first => first.toLocaleUpperCase(code))
	}

	readonly heading = t('Language')
	readonly icon = 'languages'
	readonly keywords = t('LocaleSetting.Keywords')
	readonly page = 'general'
	readonly fallback = 'en'

	// Kept on the account, so every device and the agents read the one choice; until there is one, the browser's language.
	protected readonly storage: SettingStorage<string> = {
		read: () => LocaleSetting.account.read() ?? LocaleSetting.shown,
		write: async value => {
			const locale = new Intl.Locale(value ?? this.fallback)
			AppLocale.set(locale.language, locale.region)
			await LocaleSetting.account.write(value)
		},
	}

	override get options() {
		return LocaleSetting.languages.map(code => ({ value: code as string, label: LocaleSetting.label(code) }))
	}

	/** The palette switches the language alone, keeping a chosen region the new one is written in (English in Germany). */
	override get verbs() {
		const { language } = Localizer.locales.current
		const region = AppLocale.chosenRegion
		return LocaleSetting.languages
			.filter(code => code !== language)
			.map(code => ({
				heading: `${this.heading}: ${LocaleSetting.label(code)}`,
				apply: () => this.set(region && AppLocale.regionsOf(code).includes(region) ? `${code}-${region}` : code),
			}))
	}

	/** Each language and its regions, named in the app's language. */
	private get trees() {
		const locale = Localizer.locales.current
		return LocaleSetting.languages.map(language => {
			const name = LocaleSetting.label(language)
			return {
				language: language as string,
				name,
				automatic: String(t('Automatic (${region})', { region: AppLocale.regionName(AppLocale.automaticRegionOf(language), locale) })),
				regions: AppLocale.regionsOf(language)
					.map(region => ({ value: `${language}-${region}`, name: AppLocale.regionName(region, locale) }))
					.sort((a, b) => a.name.localeCompare(b.name, locale.baseName)),
			}
		})
	}

	override get control() {
		return html`
			<mitra-select label=${this.heading} .value=${live(this.value)} @change=${(e: CustomEvent<string>) => void this.set(e.detail)}>
				${this.trees.map(tree => html`
					<mitra-option-tree>
						<mitra-option slot="header" .value=${tree.language} label=${tree.name}>
							${tree.name}<span slot="detail">${tree.automatic}</span>
						</mitra-option>
						${tree.regions.map(region => html`
							<mitra-option .value=${region.value} label=${`${tree.name} · ${region.name}`}>${region.name}</mitra-option>
						`)}
					</mitra-option-tree>
				`)}
			</mitra-select>
		`
	}

	override get details() {
		return html`<mitra-locale-preview locale=${String(Localizer.locales.current)}></mitra-locale-preview>`
	}
}
