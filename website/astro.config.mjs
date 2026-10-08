// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'
import starlightLlmsTxt from 'starlight-llms-txt'
import GithubSlugger from 'github-slugger'
import { remarkAlert } from 'remark-github-blockquote-alert'
import { visit } from 'unist-util-visit'
import { base, demo, docsBase, languageOf, languages, localized, site } from './site.mjs'
import { lastCommitDate } from './tools/git.mjs'
import { translationOf, translationState } from './tools/translations.mjs'

// ../docs stays GitHub-browsable Markdown; the plugins below translate it for the site.

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const docsRoots = [path.resolve(here, '../docs'), path.resolve(here, 'src/content/docs', docsBase)]
const translated = new RegExp(`\\.(${languages.slice(1).join('|')})\\.mdx?$`, 'i')

/** The site's dictionaries, the app's words under the site's own, by language. */
const dictionaries = Object.fromEntries(languages.slice(1).map(language => [language, {
	...JSON.parse(fs.readFileSync(path.join(repoRoot, `src/infrastructure/i18n/${language}.json`), 'utf8')),
	...JSON.parse(fs.readFileSync(path.join(here, `i18n/${language}.json`), 'utf8')),
}]))

/** A label and its translations, as Starlight's sidebar takes them. */
const t = (/** @type {string} */ label) => ({
	label,
	translations: Object.fromEntries(languages.slice(1).map(language => [language, dictionaries[language][label] ?? label])),
})

/** Maps the docs' relative `*.md` links onto the site's routes, anchor kept, in the language of the page linking. */
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
			const language = file.path.match(translated)?.[1]?.toLowerCase() ?? languages[0]
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
			node.properties.href = `${base}${localized(`/${docsBase}/${route}${route ? '/' : ''}`, language)}${match[2] ?? ''}`
		})
	}
}

/** The anchors of a Markdown file's headings, in order, as Astro slugs them. */
function headingAnchors(/** @type {string} */ markdown) {
	const slugger = new GithubSlugger()
	return markdown
		.replace(/^(```|~~~)[\s\S]*?^\1/gm, '')
		.split(/\r?\n/)
		.flatMap(line => line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1] ?? [])
		.map(text => slugger.slug(text))
}

/**
 * Gives a translation's headings the anchors of the English headings in the same places, so `page#section` is one
 * address in every language and a link into a page survives its translation. A translation keeps the English headings'
 * number and order (the i18n check says when one does not); where it does not, its own anchors stand.
 */
function rehypeEnglishAnchors() {
	/** @param {import('hast').Root} tree @param {import('vfile').VFile} file */
	return (tree, file) => {
		if (!file.path || !translated.test(file.path)) {
			return
		}
		const english = file.path.replace(translated, '.md')
		if (!fs.existsSync(english)) {
			return
		}
		const anchors = headingAnchors(fs.readFileSync(english, 'utf8'))
		/** @type {Array<import('hast').Element>} */
		const headings = []
		visit(tree, 'element', node => {
			if (/^h[1-6]$/.test(node.tagName)) {
				headings.push(node)
			}
		})
		if (headings.length === anchors.length) {
			headings.forEach((heading, index) => heading.properties.id = anchors[index])
		}
	}
}

/**
 * Turns a docs `<picture>` (which GitHub needs) into two lazy `<img>`s switched on `data-theme`, so
 * the site's theme toggle wins over the OS. Raw HTML never becomes rehype elements, hence a text
 * rewrite in the remark stage.
 */
function remarkDocsAssets() {
	const asset = /(?:\.\.\/)*assets\/screenshots\/([A-Za-z0-9._-]+)\.webp/g
	const picture = /<picture>\s*<source[^>]*srcset="([^"]+)"[^>]*>\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"\s*\/?>\s*<\/picture>/g

	/** @param {import('mdast').Root} tree @param {import('vfile').VFile} file */
	return (tree, file) => {
		// A translation shows its language's capture where the website's build shot one, the English one where not.
		const language = file.path?.match(translated)?.[1]?.toLowerCase()
		const shot = (/** @type {string} */ name) => language && fs.existsSync(path.join(repoRoot, `assets/screenshots/${language}/${name}.webp`))
			? `${base}/assets/screenshots/${language}/${name}.webp`
			: `${base}/assets/screenshots/${name}.webp`
		visit(tree, 'html', node => {
			node.value = node.value
				.replace(asset, (_match, name) => shot(name))
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

// A page without a label is named by its title, in whichever language it is read.
const sidebar = sections.map(section => 'items' in section
	? {
		...t(section.label),
		items: section.items.map(({ slug, label }) => ({
			slug: docId(slug),
			...(label ? t(label) : {}),
		})),
	}
	: { slug: docId(section.slug), ...t(section.label) })

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

/** The English file a page is built from, repo-relative. */
function englishSourceOf(/** @type {string} */ route) {
	if (route === '/') {
		return 'website/src/pages/index.astro'
	}
	if (route === '/releases/') {
		return 'website/src/pages/[...language]/releases/index.astro'
	}
	const release = route.match(/^\/releases\/(\d+\.\d+)\/$/)
	if (release) {
		return `releases/${release[1]}/README.md`
	}
	const slug = route.replace(new RegExp(`^/${docsBase}/?`), '').replace(/\/$/, '')
	return [`docs/${slug}.md`, `docs/${slug ? `${slug}/` : ''}README.md`]
		.find(file => fs.existsSync(path.join(repoRoot, file)))
}

/**
 * The file a page is built from, so the sitemap can date it. A page in another language that shows the English text,
 * its translation missing, is `fallback`: it points search engines at the English page, so the sitemap leaves it out.
 */
function sourceOf(/** @type {string} */ url) {
	const { language, path: route } = languageOf(new URL(url).pathname.slice(base.length))
	const english = englishSourceOf(route)
	if (!english || language === languages[0] || !english.endsWith('.md')) {
		return { file: english, fallback: false }
	}
	return translationState(english, language, repoRoot) === 'missing'
		? { file: english, fallback: true }
		: { file: translationOf(english, language), fallback: false }
}

// Starlight brings its own sitemap only when the site has none. This one dates every page by its last commit and lists
// each page's languages as alternates of one another, as the pages' own `hreflang` links do.
const datedSitemap = sitemap({
	i18n: { defaultLocale: languages[0], locales: Object.fromEntries(languages.map(language => [language, language])) },
	filter: url => !sourceOf(url).fallback,
	serialize(item) {
		const { file } = sourceOf(item.url)
		const date = file && lastCommitDate(file, repoRoot)
		return date ? { ...item, lastmod: date.toISOString() } : item
	},
})

export default defineConfig({
	site: new URL(site).origin,
	...(base ? { base } : {}),
	redirects,
	// The releases pages read ../releases and the parsers in ../src, which Vite's dev server serves only when allowed to.
	vite: { server: { fs: { allow: [path.resolve(here, '..')] } } },
	markdown: {
		processor: unified({
			remarkPlugins: [remarkAlert, remarkDocsAssets],
			rehypePlugins: [rehypeMarkdownLinks, rehypeEnglishAnchors],
		}),
	},
	integrations: [
		caddyRedirects,
		datedSitemap,
		starlight({
			title: 'Mitra',
			// English at the root, every other language under its prefix. A page not translated yet shows the English
			// text there, with Starlight's notice; starlightRouteData.ts points search engines at the English page.
			defaultLocale: 'root',
			locales: Object.fromEntries(languages.map((language, index) => [index ? language : 'root', {
				label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
				lang: language,
			}])),
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
