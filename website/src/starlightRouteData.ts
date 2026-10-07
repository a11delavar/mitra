import path from 'node:path'
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import { docsBase } from '../site.mjs'
import { lastCommitDate } from '../tools/git.mjs'
import { linkPreview } from './linkPreview'

// `filePath` goes through prepare.mjs's link, so edit URL and last-updated are resolved against
// the real file in ../docs. From cwd, not `import.meta.dirname`: this module is bundled.
const repoRoot = path.resolve(process.cwd(), '..')
const linkPrefix = `src/content/docs/${docsBase}/`

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
})
