import { Localizer, type LanguageCode } from '@3mo/localization'
import { localizeIn } from '../../../infrastructure/i18n/dictionaries.js'
import de from './de.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }
import fa from './fa.json' with { type: 'json' }

// The sample calendar's words in every language the app speaks, kept out of the app's dictionaries. Only the server
// imports this module (the seed on demand, since the client bundles the Demo class; the sign-in that opens a sandbox), so
// these keys join the engine there alone. `npm run i18n:analyze` checks them against the seed's `t()` calls, as it checks the app's dictionaries against the rest of the code.
const dictionaries = { de, fr, es, pt, it, fa }
Localizer.dictionaries.add(dictionaries)

/** The languages the sample calendar can be written in, English first: what a visitor's Accept-Language is matched against. */
export const languages = ['en', ...Object.keys(dictionaries)] as Array<LanguageCode>

/** `t()` for the sample calendar in a given language. */
export const localizeSample = localizeIn
