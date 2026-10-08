import fs from 'node:fs'
import path from 'node:path'
import { languages } from '../site.mjs'

// The site's own words over the app's dictionaries: a word the app already translates (Latest, Features, Patches) is taken
// from there, never written again. `npm run i18n:analyze` checks these against the site's `t()` calls. The app's engine,
// @3mo/localization, needs a bundler for a CommonJS dependency, so the site reads the same dictionaries the same way:
// `${name}` parameters, numbers in the language's digits, and an array picking its form by `${count:pluralityNumber}`.

type Dictionary = Record<string, string | Array<string>>

// From cwd, not `import.meta`: this module is bundled, so its own path would point into dist.
const repoRoot = path.resolve(process.cwd(), '..')
const read = (file: string): Dictionary => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
const files = languages.flatMap(language => [`src/infrastructure/i18n/${language}.json`, `website/i18n/${language}.json`].map(file => path.join(repoRoot, file)))
let cached: { stamp: string, dictionaries: Map<string, Dictionary> } | undefined

/** Read once for a build. The dev server does not watch these files, so there they are read again once one changed. */
function dictionaries() {
	const stamp = import.meta.env.DEV ? files.map(file => fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0).join() : ''
	if (cached?.stamp !== stamp) {
		cached = {
			stamp,
			dictionaries: new Map(languages.map(language => [language, {
				...read(path.join(repoRoot, `src/infrastructure/i18n/${language}.json`)),
				...read(path.join(repoRoot, `website/i18n/${language}.json`)),
			}])),
		}
	}
	return cached.dictionaries
}

/** The plural categories in the order a dictionary array lists its forms, as @3mo/localization orders them. */
const categories = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

function pluralForm(forms: Array<string>, language: string, count: number) {
	const rules = new Intl.PluralRules(language)
	const used = categories.filter(category => rules.resolvedOptions().pluralCategories.includes(category))
	return forms[used.indexOf(rules.select(count) as typeof categories[number])] ?? forms.at(-1)!
}

/** `t()` in the language of the page; a key without a translation reads in English. */
export function localize(language: string) {
	return (key: string, parameters: Record<string, string | number> = {}) => {
		const all = dictionaries()
		const own = all.get(language)?.[key]
		const [entry, from] = own !== undefined ? [own, language] : [all.get(languages[0]!)?.[key] ?? key, languages[0]!]
		const count = [...key.matchAll(/\$\{(\w+):pluralityNumber\}/g)].map(([, name]) => parameters[name!])[0]
		const text = Array.isArray(entry) ? pluralForm(entry, from, Number(count ?? 0)) : entry
		return text.replace(/\$\{(\w+)(?::\w+)?\}/g, (match, name: string) => {
			const value = parameters[name]
			return value === undefined ? match : typeof value === 'number' ? value.toLocaleString(language) : value
		})
	}
}

/** The language's own name for itself: Deutsch, فارسی. */
export function languageName(language: string) {
	return new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language
}

/** Right to left for Persian and Arabic, from the script, as the app decides it. */
export function directionOf(language: string) {
	const locale = new Intl.Locale(language) as Intl.Locale & { getTextInfo?(): { direction: 'ltr' | 'rtl' } }
	return locale.getTextInfo?.().direction ?? 'ltr'
}

export { languages }
