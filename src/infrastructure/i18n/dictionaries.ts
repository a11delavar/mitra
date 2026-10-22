import { Localizer, LocalizableString, type LanguageCode } from '@3mo/localization'
import en from './en.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }
import fa from './fa.json' with { type: 'json' }
import zh from './zh.json' with { type: 'json' }
import pl from './pl.json' with { type: 'json' }
import nl from './nl.json' with { type: 'json' }
import ar from './ar.json' with { type: 'json' }
import ru from './ru.json' with { type: 'json' }

const dictionaries = { en, de, fr, es, pt, it, fa, zh, pl, nl, ar, ru }
Localizer.dictionaries.add(dictionaries)

/** `t()` in a locale's language (`en-GB` reads English), for the server, which has no current one. Unknown languages read English. */
export function localizeIn(locale: string | null | undefined) {
	const language = locale?.split('-')[0]
	const known = (language && language in dictionaries ? language : 'en') as LanguageCode
	return (key: string, parameters: Record<string, string | number> = {}) => LocalizableString.get(key).localize(known, parameters).value
}
