import type { APIRoute, GetStaticPaths } from 'astro'
import { languages, localized, site, withBase } from '../../../site.mjs'
import { localize } from '../../i18n'
import { linesOf, Release } from '../../releases'

// One item per shipped minor and per patch, newest first. The draft is not news yet. One feed per language, its releases
// read as its pages read them; patches are listed by their commits, in English.

export const getStaticPaths = (() => languages.map(language => ({
	params: { language: language === languages[0] ? undefined : language },
	props: { language },
}))) satisfies GetStaticPaths

const escape = (text: string) => text.replace(/[<>&"']/g, character => `&#${character.charCodeAt(0)};`)

export const GET: APIRoute = ({ props }) => {
	const language = props.language as string
	const t = localize(language)
	const origin = new URL(site).origin
	const items = Release.all(language).flatMap(release => {
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
<title>${escape(t('Mitra releases'))}</title>
<link>${origin}${withBase(localized('/releases/', language))}</link>
<atom:link href="${origin}${withBase(localized('/releases.xml', language))}" rel="self" type="application/rss+xml" />
<description>${escape(t('What changed in each version of Mitra, written for the people who use it.'))}</description>
<language>${language}</language>
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
