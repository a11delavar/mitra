// @ts-check
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import starlight from '@astrojs/starlight'
import starlightLlmsTxt from 'starlight-llms-txt'
import { remarkAlert } from 'remark-github-blockquote-alert'
import { visit } from 'unist-util-visit'
import { base, demo, docsBase, site } from './site.mjs'

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
 * The docs' shape, declared once: it drives the sidebar AND the redirects from the pre-/docs/ routes.
 * @type {Array<{ label: string, items: Array<{ slug: string, label?: string, hidden?: boolean }> }>}
 */
const sections = [
	{
		label: 'Getting Started',
		items: [
			{ slug: '', label: 'Overview' },
			{ slug: 'getting-started/installation' },
			{ slug: 'getting-started/configuration' },
		],
	},
	{
		label: 'Using Mitra',
		items: [
			{ slug: 'guides/views' },
			{ slug: 'guides/calendars' },
			{ slug: 'guides/unscheduled-tasks' },
			{ slug: 'guides/routines' },
			{ slug: 'guides/availability' },
			{ slug: 'guides/participants' },
			{ slug: 'guides/notifications' },
			{ slug: 'guides/location-autocomplete' },
			// Reached from Views; listed only so its old URL keeps redirecting.
			{ slug: 'guides/table-view', hidden: true },
			{ slug: 'guides/keyboard-shortcuts' },
			{ slug: 'guides/settings' },
			{ slug: 'guides/default-calendar-app' },
		],
	},
	{
		label: 'Relationships',
		items: [
			{ slug: 'guides/relationships', label: 'Overview' },
			{ slug: 'guides/relationships/hierarchy', label: 'Hierarchy & Subtasks' },
			{ slug: 'guides/relationships/dependencies' },
		],
	},
	{
		label: 'Integrations',
		items: [
			{ slug: 'integrations', label: 'Overview' },
			{ slug: 'integrations/mitra' },
			{ slug: 'integrations/caldav' },
			{ slug: 'integrations/google-calendar' },
			{ slug: 'integrations/apple-calendar' },
			{ slug: 'integrations/calendar-subscriptions' },
			{ slug: 'integrations/notion' },
			{ slug: 'integrations/tempo' },
		],
	},
	{
		label: 'Administration',
		items: [
			{ slug: 'guides/multi-user' },
			{ slug: 'guides/backups' },
			{ slug: 'guides/updates' },
			{ slug: 'guides/health-checks' },
			{ slug: 'guides/logging' },
		],
	},
	{
		label: 'Reference',
		items: [
			{ slug: 'reference/environment-variables' },
		],
	},
]

/** A docs slug as Starlight's collection id. */
const docId = (/** @type {string} */ slug) => slug ? `${docsBase}/${slug}` : docsBase

const sidebar = sections.map(section => ({
	label: section.label,
	items: section.items.filter(item => !item.hidden).map(({ slug, label }) => ({
		slug: docId(slug),
		...(label ? { label } : {}),
	})),
}))

// The docs as plain Markdown for language models (llmstxt.org), in sidebar order, one set per section.
const llmsTxt = starlightLlmsTxt({
	description: 'Mitra is a free, open source, self-hosted calendar that puts tasks on the same timeline as events. '
		+ 'It syncs with the calendars people already use (CalDAV, Google Calendar, iCloud, calendar subscriptions, Notion and Tempo) '
		+ 'and runs as a single Docker container.',
	customSets: sections.map(section => ({ label: section.label, paths: section.items.map(item => docId(item.slug)) })),
	promote: sections.flatMap(section => section.items.map(item => docId(item.slug))),
	optionalLinks: [
		{ label: 'Source code', url: 'https://github.com/a11delavar/mitra', description: 'the repository, AGPL-3.0' },
		{ label: 'Demo', url: demo, description: 'a public instance with sample data, reset per visitor' },
	],
})

// The docs used to live at the site root; those URLs keep resolving.
const redirects = Object.fromEntries(
	sections
		.flatMap(section => section.items.map(item => item.slug))
		.filter(Boolean)
		.map(slug => [`/${slug}`, `/${docsBase}/${slug}/`])
)

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
