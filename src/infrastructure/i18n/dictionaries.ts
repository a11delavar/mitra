import { Localizer, LocalizableString, type LanguageCode } from '@3mo/localization'
import en from './en.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }
import fa from './fa.json' with { type: 'json' }

/** Localization configuration with source English and translated locale dictionaries. */
const dictionaries = { en, de, fr, es, pt, it, fa }
Localizer.dictionaries.add(dictionaries)

/** `t()` in a given language, for the server, which has no current one. Unknown languages read English. */
export function localizeIn(language: string | null | undefined) {
	const known = (language && language in dictionaries ? language : 'en') as LanguageCode
	return (key: string, parameters: Record<string, string | number> = {}) => LocalizableString.get(key).localize(known, parameters).value
}
