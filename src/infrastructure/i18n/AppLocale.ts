import { Localizer } from '@3mo/localization'
import { deviceStorage } from '../../features/settings/client/Setting.js'

/**
 * One BCP 47 tag: its language picks the words, its region how dates, times, numbers and weeks read; without one,
 * @3mo/localization adopts the browser's region for that language. A region is a format, never a time zone.
 */
export class AppLocale {
	/** Where @3mo/localization stores the tag. */
	private static readonly stored = deviceStorage<string>('Localizer.Language')

	/** The region chosen in the app, unless the browser's is in force. */
	static get chosenRegion(): string | undefined {
		try {
			const tag = AppLocale.stored.read()
			return tag ? new Intl.Locale(tag).region : undefined
		} catch {
			return undefined
		}
	}

	/** The region a language reads as while none is chosen: the browser's first preference naming one, as @3mo/localization adopts it, else the language's likeliest. */
	static automaticRegionOf(language: string): string {
		const preference = navigator.languages.find(tag => tag.startsWith(`${language}-`))
		return new Intl.Locale(preference ?? language).maximize().region ?? '001'
	}

	/** Regions that are no country: the world, Europe and Latin America, each with a variant of some languages. */
	private static readonly areas = ['001', '150', '419']

	/** A region's name in `locale`, with the areas named where the engine has no name for them. */
	static regionName(region: string, locale: Intl.Locale) {
		const name = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }).of(region)
		return name ?? String(({ '001': t('World'), '150': t('Europe'), '419': t('Latin America') } as Record<string, unknown>)[region] ?? region)
	}

	private static candidates?: ReadonlyArray<string>
	private static readonly regionsByLanguage = new Map<string, ReadonlyArray<string>>()

	/**
	 * The regions the browser holds `language`'s formats for, countries and areas like Europe (`150`) alike. Intl has no
	 * list of them: a tag the engine has no data for resolves to a shorter one (`de-US` to `de`), so every region is tried.
	 */
	static regionsOf(language: string): ReadonlyArray<string> {
		let regions = AppLocale.regionsByLanguage.get(language)
		if (!regions) {
			const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
			const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
			// The areas go in whether or not the engine names them: Chromium has English for Europe (`150`) but no name for it.
			AppLocale.candidates ??= [...letters.flatMap(first => letters.map(second => first + second)).filter(code => names.of(code)), ...AppLocale.areas]
			regions = AppLocale.candidates.filter(region => new Intl.DateTimeFormat(`${language}-${region}`).resolvedOptions().locale === `${language}-${region}`)
			AppLocale.regionsByLanguage.set(language, regions)
		}
		return regions
	}

	/** Runs the app in `language`, read as in `region` or as the browser has it, keeping the tag's `-u-` preferences. */
	static set(language: string, region: string | undefined) {
		const current = Localizer.locales.current
		const preferences = String(current).slice(current.baseName.length)
		Localizer.locales.current = `${language}${region ? `-${region}` : ''}${preferences}`
	}
}
