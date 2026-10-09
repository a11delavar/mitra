import path from 'node:path'
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import { base, docsBase, languageOf, languages, localized } from '../site.mjs'
import { lastCommitDate } from '../tools/git.mjs'
import { translationState } from '../tools/translations.mjs'
import { linkPreview } from './linkPreview'

// `filePath` goes through prepare.mjs's link, so edit URL and last-updated are resolved against
// the real file in ../docs. From cwd, not `import.meta.dirname`: this module is bundled.
const repoRoot = path.resolve(process.cwd(), '..')
const linkPrefix = `src/content/docs/${docsBase}/`
const translation = new RegExp(`\\.(${languages.slice(1).join('|')})(\\.mdx?)$`, 'i')

export const onRequest = defineRouteMiddleware(async context => {
	const route = context.locals.starlightRoute
	route.head.push({ tag: 'meta', attrs: { property: 'og:image', content: (await linkPreview(context.site)).href } })

	const filePath = route.entry.filePath
	if (!filePath?.startsWith(linkPrefix)) {
		return
	}

	const source = `docs/${filePath.slice(linkPrefix.length)}`

	if (route.editUrl) {
		route.editUrl = new URL(route.editUrl.href.replace(linkPrefix, ''))
	}

	route.lastUpdated = lastCommitDate(source, repoRoot)

	// Starlight names every language as an alternate of every page and calls each its own canonical. Only a page that is
	// written in a language is one: a page showing the English text while untranslated sends search engines to the
	// English page, and the others list only the languages the page exists in.
	const english = source.replace(translation, '$2')
	const { path: page } = languageOf(context.url.pathname.slice(base.length))
	const existing = languages.filter(language => language === languages[0] || translationState(english, language, repoRoot) !== 'missing')
	const url = (language: string) => new URL(`${base}${localized(page, language)}`, context.site).href
	route.head = route.head.filter(tag => !(tag.tag === 'link' && (tag.attrs?.rel === 'canonical' || tag.attrs?.hreflang)))
	route.head.push({ tag: 'link', attrs: { rel: 'canonical', href: url(route.isFallback ? languages[0]! : route.lang) } })
	if (!route.isFallback && existing.length > 1) {
		route.head.push(
			...existing.map(language => ({ tag: 'link' as const, attrs: { rel: 'alternate', hreflang: language, href: url(language) } })),
			{ tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: url(languages[0]!) } },
		)
	}
})
