/** The ONE statement of the public origin. A subdirectory host includes its path; links use `withBase()`. */
export const site = 'https://mitracal.com'

const url = new URL(site)

/** `''` at a root domain. */
export const base = url.pathname.replace(/\/+$/, '')

export function withBase(path) {
	return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * The languages the site is written in, English first and at the root, every other under its own prefix (`/de/docs/`).
 * A page's translation is the file beside it with the language before the extension (`week.de.md`, `README.de.md`).
 */
export const languages = ['en', 'de', 'fr', 'es', 'pt', 'it', 'fa']

/** A site path in `language`: `/docs/` is `/de/docs/` in German. */
export function localized(path, language) {
	return language === languages[0] ? path : `/${language}${path}`
}

/** The language a site path is in, and the path in English. */
export function languageOf(path) {
	const [, prefix = '', rest = ''] = path.match(/^\/([a-z]{2,3})(\/.*|$)/) ?? []
	return languages.includes(prefix) && prefix !== languages[0] ? { language: prefix, path: rest || '/' } : { language: languages[0], path }
}

/** The docs' route prefix; the Markdown itself never leaves ../docs. */
export const docsBase = 'docs'

/** Where the code and its releases live. */
export const repository = 'https://github.com/a11delavar/mitra'

/** The public demo instance (`MITRA_DEMO=true`). */
export const demo = 'https://demo.mitracal.com'

