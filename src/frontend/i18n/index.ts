import { Localizer, LocalizableString } from '@3mo/localization'
import en from './en.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }

// The global `t` is assigned as a side effect of @3mo/localization's LocalizableString module. Some
// components call `t(…)` at MODULE-EVALUATION time (e.g. a status→label map), so that assignment must
// happen before they load — and this file is the app's very first import (see frontend/index.ts).
// Importing the `LocalizableString` binding forces esbuild to keep and run that otherwise-tree-shakeable
// side effect here, first; the guard turns a regression into a loud failure instead of a silent one.
if (typeof globalThis.t !== 'function') {
	throw new Error(`@3mo/localization did not initialize the global t() (${LocalizableString.name})`)
}

/**
 * Localization wiring. English is the SOURCE language: every `t('…')` key IS its English text, so a key
 * with no dictionary entry renders as itself (see @3mo/localization's LocalizedString fallback). `en.json`
 * therefore holds only what a key can't carry by itself, and there are two such cases:
 *
 * - Plural forms, where `t('${count:pluralityNumber} weeks', { count: 1 })` must become "1 week".
 * - SYMBOLIC keys — dotted names like `Notion.TokenHint` or `ShowOnlySource.Keywords` — for text that
 *   makes a poor key: a paragraph nobody wants inlined in the source, or a bag of palette search terms,
 *   which isn't prose at all and wants the words each language's own users would type rather than a
 *   translation of the English ones. Everything else stays a natural English key.
 *
 * Everything but English lives in the translation files (`de.json`); all five are kept fully translated.
 * Drop another language beside them, import it, and register.
 *
 * The active language auto-resolves (see Localizer): `?lang=xx` query param → `localStorage` → the
 * browser's `navigator.language` → `en`. @3mo/localization's LanguageController re-renders every
 * component when it changes, so switching language needs no reload.
 *
 * Keys are kept in sync with the code by `npm run i18n:generate` (see scripts/i18n.ts), which scans every
 * `t('…')` call and rewrites `keys.auto-generated.ts` (autocomplete) — run it after adding or removing a
 * string. `npm run i18n:analyze` reports keys missing from, or unused in, the dictionaries.
 */
Localizer.dictionaries.add({ en, de, fr, es, pt, it })
