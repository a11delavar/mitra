import { Localizer, LocalizableString } from '@3mo/localization'
import en from './en.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }

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
 * therefore holds ONLY the handful of keys English can't derive from the key alone — plural forms, where
 * `t('${count:pluralityNumber} weeks', { count: 1 })` must become "1 week", not "1 weeks". Everything else
 * lives in the translation files (`de.json`). Drop another language beside them, import it, and register.
 *
 * The active language auto-resolves (see Localizer): `?lang=xx` query param → `localStorage` → the
 * browser's `navigator.language` → `en`. @3mo/localization's LanguageController re-renders every
 * component when it changes, so switching language needs no reload.
 *
 * Keys are kept in sync with the code by `npm run i18n:generate` (see scripts/i18n.ts), which scans every
 * `t('…')` call and rewrites `keys.auto-generated.ts` (autocomplete) — run it after adding or removing a
 * string. `npm run i18n:analyze` reports keys missing from, or unused in, the dictionaries.
 */
Localizer.dictionaries.add({ en, de })
