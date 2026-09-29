/** The ONE statement of the public origin. A subdirectory host includes its path; links use `withBase()`. */
export const site = 'https://mitracal.com'

const url = new URL(site)

/** `''` at a root domain. */
export const base = url.pathname.replace(/\/+$/, '')

export function withBase(path) {
	return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** The docs' route prefix; the Markdown itself never leaves ../docs. */
export const docsBase = 'docs'

