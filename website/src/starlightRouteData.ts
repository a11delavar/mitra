import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import { docsBase } from '../site.mjs'
import { linkPreview } from './linkPreview'

// `filePath` goes through prepare.mjs's link, so edit URL and last-updated are resolved against
// the real file in ../docs. From cwd, not `import.meta.dirname`: this module is bundled.
const repoRoot = path.resolve(process.cwd(), '..')
const linkPrefix = `src/content/docs/${docsBase}/`

const lastCommitDates = new Map<string, Date | undefined>()

/** When `file` (repo-relative) was last committed, or undefined outside a git checkout. */
function lastCommitDate(file: string) {
	if (!lastCommitDates.has(file)) {
		let date: Date | undefined
		try {
			const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
				cwd: repoRoot,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}).trim()
			date = iso ? new Date(iso) : undefined
		} catch {
			date = undefined
		}
		lastCommitDates.set(file, date)
	}
	return lastCommitDates.get(file)
}

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

	route.lastUpdated = lastCommitDate(source)
})
