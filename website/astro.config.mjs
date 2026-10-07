// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'
import starlightLlmsTxt from 'starlight-llms-txt'
import { remarkAlert } from 'remark-github-blockquote-alert'
import { visit } from 'unist-util-visit'
import { base, demo, docsBase, site } from './site.mjs'
import { lastCommitDate } from './tools/git.mjs'

// ../docs stays GitHub-browsable Markdown; the plugins below translate it for the site.

const here = path.dirname(fileURLToPath(import.meta.url))
const docsRoots = [path.resolve(here, '../docs'), path.resolve(here, 'src/content/docs', docsBase)]

/** Maps the docs' relative `*.md` links onto the site's routes, anchor kept. */
function rehypeMarkdownLinks() {
	/** @param {import('hast').Root} tree @param {import('vfile').VFile} file */
	return (tree, file) => {
		visit(tree, 'element', node => {
			const href = node.properties.href
			if (node.tagName !== 'a' || typeof href !== 'string') {
				return
			}
			const match = href.match(/^(?!https?:|mailto:|\/|#)(.+?)\.md(#.*)?$/i)
			if (!match || !file.path) {
				return
			}
			const target = path.resolve(path.dirname(file.path), `${match[1]}.md`)
			const relative = docsRoots
				.map(root => path.relative(root, target))
				.find(candidate => !candidate.startsWith('..'))
			if (relative === undefined) {
				return
			}
			const route = relative
				.replace(/\\/g, '/')
				.replace(/\.md$/i, '')
				.replace(/(^|\/)(index|readme)$/i, '')
			node.properties.href = `${base}/${docsBase}/${route}${route ? '/' : ''}${match[2] ?? ''}`
		})
	}
}

/**
 * Turns a docs `<picture>` (which GitHub needs) into two lazy `<img>`s switched on `data-theme`, so
 * the site's theme toggle wins over the OS. Raw HTML never becomes rehype elements, hence a text
 * rewrite in the remark stage.
 */
function remarkDocsAssets() {
	const asset = /(?:\.\.\/)*assets\/([A-Za-z0-9._/-]+)\.png/g
	const picture = /<picture>\s*<source[^>]*srcset="([^"]+)"[^>]*>\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"\s*\/?>\s*<\/picture>/g

	/** @param {import('mdast').Root} tree */
	return tree => {
		visit(tree, 'html', node => {
			node.value = node.value
				.replace(asset, (_match, file) => `${base}/assets/${file}.webp`)
				.replace(picture, (_match, dark, light, alt) =>
					`<img class="theme-light" src="${light}" alt="${alt}" loading="lazy" />` +
					`<img class="theme-dark" src="${dark}" alt="${alt}" loading="lazy" />`)
		})
	}
}

/**
 * The docs' shape, declared once: it drives the sidebar AND the redirects from the pre-/docs/ routes. An entry is a
 * group of pages, or one page on its own.
 * @type {Array<{ label: string, items: Array<{ slug: string, label?: string }> } | { slug: string, label: string }>}
 */
const sections = [
	{ slug: '', label: 'Getting started' },
	{
		label: 'Views',
		items: [
			{ slug: 'views', label: 'Overview' },
			{ slug: 'views/week' },
			{ slug: 'views/month' },
			{ slug: 'views/year' },
			{ slug: 'views/timeline' },
			{ slug: 'views/table' },
		],
	},
	{
		label: 'Features',
		items: [
			{ slug: 'entries' },
			{ slug: 'repeats' },
			{ slug: 'time-zones' },
			{ slug: 'calendars' },
			{ slug: 'planning' },
			{ slug: 'routines' },
			{ slug: 'availability' },
			{ slug: 'subtasks' },
			{ slug: 'dependencies' },
			{ slug: 'participants' },
			{ slug: 'links' },
			{ slug: 'reminders' },
			{ slug: 'location' },
			// The app around the features, last.
			{ slug: 'settings' },
			{ slug: 'install-app' },
			{ slug: 'calendar-files' },
			{ slug: 'shortcuts' },
		],
	},
	{
		label: 'Integrations',
		items: [
			{ slug: 'integrations', label: 'Overview' },
			{ slug: 'integrations/mitra' },
			{ slug: 'integrations/caldav' },
			{ slug: 'integrations/google' },
			{ slug: 'integrations/apple' },
			{ slug: 'integrations/subscriptions' },
			{ slug: 'integrations/notion' },
			{ slug: 'integrations/tempo' },
		],
	},
	{
		label: 'Administration',
		items: [
			{ slug: 'configuration' },
			{ slug: 'sso' },
			{ slug: 'backups' },
			{ slug: 'updates' },
			{ slug: 'health-checks' },
			{ slug: 'logging' },
		],
	},
]

/** A docs slug as Starlight's collection id. */
const docId = (/** @type {string} */ slug) => slug ? `${docsBase}/${slug}` : docsBase

/** A docs slug as its route. */
const docPath = (/** @type {string} */ slug) => slug ? `/${docsBase}/${slug}/` : `/${docsBase}/`

/** The pages of an entry, whether a group or a page on its own. */
const pagesOf = (/** @type {typeof sections[number]} */ section) => 'items' in section ? section.items : [section]

const sidebar = sections.map(section => 'items' in section
	? {
		label: section.label,
		items: section.items.map(({ slug, label }) => ({
			slug: docId(slug),
			...(label ? { label } : {}),
		})),
	}
	: { slug: docId(section.slug), label: section.label })

// The docs as plain Markdown for language models (llmstxt.org), in sidebar order, one set per section.
const llmsTxt = starlightLlmsTxt({
	description: 'Mitra is a free, open source, self-hosted calendar that puts tasks on the same timeline as events. '
		+ 'It keeps calendars itself, with no account behind them, and syncs with the calendars people already use '
		+ '(CalDAV, Google Calendar, iCloud, calendar subscriptions, Notion and Tempo). It runs as a single Docker container.',
	customSets: sections.map(section => ({ label: section.label, paths: pagesOf(section).map(item => docId(item.slug)) })),
	promote: sections.flatMap(section => pagesOf(section).map(item => docId(item.slug))),
	optionalLinks: [
		{ label: 'Source code', url: 'https://github.com/a11delavar/mitra', description: 'the repository, AGPL-3.0' },
		{ label: 'Demo', url: demo, description: 'a public instance with sample data, reset per visitor' },
	],
})

/** Pages that moved inside the docs, old slug to new. */
const moved = {
	'guides/table-view': 'views/table',
	'guides/relationships': 'subtasks',
	'guides/relationships/hierarchy': 'subtasks',
	'guides/relationships/dependencies': 'dependencies',
	'guides/multi-user': 'sso',
	'guides/unscheduled-tasks': 'planning',
	'guides/notifications': 'reminders',
	'guides/location-autocomplete': 'location',
	'guides/default-calendar-app': 'calendar-files',
	'guides/single-sign-on': 'sso',
	'guides/keyboard-shortcuts': 'shortcuts',
	'integrations/google-calendar': 'integrations/google',
	'integrations/apple-calendar': 'integrations/apple',
	'integrations/calendar-subscriptions': 'integrations/subscriptions',
	'getting-started/configuration': 'configuration',
	'reference/environment-variables': 'configuration',
	'getting-started/installation': '',
	'getting-started/first-steps': '',
	'guides/availability': 'availability',
	'guides/backups': 'backups',
	'guides/calendar-files': 'calendar-files',
	'guides/calendars': 'calendars',
	'guides/configuration': 'configuration',
	'guides/dependencies': 'dependencies',
	'guides/health-checks': 'health-checks',
	'guides/install-app': 'install-app',
	'guides/links': 'links',
	'guides/location': 'location',
	'guides/logging': 'logging',
	'guides/participants': 'participants',
	'guides/planning': 'planning',
	'guides/reminders': 'reminders',
	'guides/routines': 'routines',
	'guides/settings': 'settings',
	'guides/shortcuts': 'shortcuts',
	'guides/sso': 'sso',
	'guides/subtasks': 'subtasks',
	'guides/updates': 'updates',
	'guides/views': 'views',
	'guides/views/month': 'views/month',
	'guides/views/table': 'views/table',
	'guides/views/timeline': 'views/timeline',
	'guides/views/week': 'views/week',
	'guides/views/year': 'views/year',
}

// The docs used to live at the site root, and some pages have moved since; those URLs keep resolving.
const redirects = Object.fromEntries([
	...sections
		.flatMap(section => pagesOf(section).map(item => item.slug))
		.filter(Boolean)
		.map(slug => [`/${slug}`, docPath(slug)]),
	...Object.entries(moved).flatMap(([from, to]) => [
		[`/${from}`, docPath(to)],
		[`/${docsBase}/${from}`, docPath(to)],
	]),
])

/**
 * The same redirects as Caddy rules, imported by the Caddyfile in ./Dockerfile: Astro alone can only write pages that
 * jump on load, and a moved page should answer with a real 301.
 * @type {import('astro').AstroIntegration}
 */
const caddyRedirects = {
	name: 'caddy-redirects',
	hooks: {
		'astro:build:done': () => {
			const rules = Object.entries(redirects).flatMap(([from, to]) => [`${base}${from}`, `${base}${from}/`]
				.map(address => `redir ${address} ${base}${to} permanent`))
			fs.writeFileSync(path.join(here, 'redirects.caddy'), `${rules.join('\n')}\n`)
		},
	},
}

/** The file a page is built from, repo-relative, so the sitemap can date it. */
function sourceOf(/** @type {string} */ url) {
	const route = new URL(url).pathname.slice(base.length)
	if (route === '/') {
		return 'website/src/pages/index.astro'
	}
	const slug = route.replace(new RegExp(`^/${docsBase}/?`), '').replace(/\/$/, '')
	return [`docs/${slug}.md`, `docs/${slug ? `${slug}/` : ''}README.md`]
		.find(file => fs.existsSync(path.resolve(here, '..', file)))
}

// Starlight brings its own sitemap only when the site has none; this one dates every page by its last commit.
const datedSitemap = sitemap({
	serialize(item) {
		const source = sourceOf(item.url)
		const date = source && lastCommitDate(source, path.resolve(here, '..'))
		return date ? { ...item, lastmod: date.toISOString() } : item
	},
})

export default defineConfig({
	site: new URL(site).origin,
	...(base ? { base } : {}),
	redirects,
	markdown: {
		processor: unified({
			remarkPlugins: [remarkAlert, remarkDocsAssets],
			rehypePlugins: [rehypeMarkdownLinks],
		}),
	},
	integrations: [
		caddyRedirects,
		datedSitemap,
		starlight({
			title: 'Mitra',
			plugins: [llmsTxt],
			description: 'Documentation for Mitra, a self-hosted calendar for your events and tasks.',
			logo: { src: './src/assets/mitra.svg', alt: 'Mitra' },
			favicon: '/favicon.svg',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/a11delavar/mitra' },
			],
			// Remapped from the link to ../docs in starlightRouteData.ts.
			editLink: { baseUrl: 'https://github.com/a11delavar/mitra/edit/main/docs/' },
			routeMiddleware: './src/starlightRouteData.ts',
			sidebar,
			customCss: ['./src/styles/docs.css'],
			components: {
				Header: './src/overrides/Header.astro',
				PageTitle: './src/overrides/PageTitle.astro',
				ThemeSelect: './src/overrides/ThemeSelect.astro',
				Footer: './src/overrides/Footer.astro',
			},
			expressiveCode: {
				themes: ['github-dark-default', 'github-light-default'],
				styleOverrides: {
					borderRadius: '8px',
					borderColor: 'var(--mitra-hairline)',
					codeBackground: 'var(--color-surface)',
					frames: {
						editorActiveTabBackground: 'var(--color-surface)',
						editorTabBarBackground: 'transparent',
						terminalBackground: 'var(--color-surface)',
						terminalTitlebarBackground: 'transparent',
						shadowColor: 'transparent',
					},
				},
			},
			pagination: false,
			credits: false,
		}),
	],
})
