import type { APIRoute } from 'astro'
import { site, withBase } from '../../site.mjs'
import { linesOf, Release } from '../releases'

// One item per shipped minor and per patch, newest first. The draft is not news yet.

const escape = (text: string) => text.replace(/[<>&"']/g, character => `&#${character.charCodeAt(0)};`)

export const GET: APIRoute = () => {
	const origin = new URL(site).origin
	const items = Release.all().flatMap(release => {
		const page = `${origin}${release.url}`
		const entries = new Array<{ title: string, link: string, date: string, description: string }>()
		if (release.date && release.state !== 'draft') {
			entries.push({ title: `Mitra ${release.name}`, link: page, date: release.date, description: release.notes?.intro || release.summary })
		}
		for (const patch of release.patches) {
			if (patch.date) {
				entries.push({
					title: `Mitra ${patch.version}`,
					link: `${page}#patches`,
					date: patch.date,
					description: patch.categories.flatMap(linesOf).map(line => line.subject).join('. '),
				})
			}
		}
		return entries
	}).sort((a, b) => b.date.localeCompare(a.date))

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Mitra releases</title>
<link>${origin}${withBase('/releases/')}</link>
<atom:link href="${origin}${withBase('/releases.xml')}" rel="self" type="application/rss+xml" />
<description>What changed in each version of Mitra, written for the people who use it.</description>
<language>en</language>
${items.map(item => `<item>
<title>${escape(item.title)}</title>
<link>${item.link}</link>
<guid>${item.link}</guid>
<pubDate>${new Date(`${item.date}T12:00:00Z`).toUTCString()}</pubDate>
<description>${escape(item.description)}</description>
</item>`).join('\n')}
</channel>
</rss>
`
	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
