// @ts-check
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import starlight from '@astrojs/starlight'
import lucode from 'lucode-starlight'
import { remarkAlert } from 'remark-github-blockquote-alert'
import { visit } from 'unist-util-visit'

// This site is a rendering of the repo's ./docs — plain, GitHub-browsable Markdown that never needs
// site-specific syntax. Two build-time translations make that possible: GitHub `> [!NOTE]` alerts
// become styled callouts (remark-github-blockquote-alert), and relative `*.md` links become the
// site's clean routes (rehypeMarkdownLinks, below). Content in ../docs is linked into
// src/content/docs by prepare.mjs before every dev/build.

// Deploy target. Set via env so switching hosts is a one-line change in the workflow (the GitHub
// Pages project site lives under /mitra; a future host at a root domain sets no base at all).
const site = process.env.MITRA_DOCS_SITE || undefined
const base = process.env.MITRA_DOCS_BASE || undefined
// The prefix rewritten links carry — the base without a trailing slash (`''` at a root domain).
const linkBase = (base ?? '').replace(/\/+$/, '')

// The docs are reachable under two roots — ../docs and the src/content/docs link into it — and a
// file's path can arrive via either, so routes resolve against whichever root contains it.
const here = path.dirname(fileURLToPath(import.meta.url))
const docsRoots = [path.resolve(here, '../docs'), path.resolve(here, 'src/content/docs')]

/**
 * Rewrites the docs' relative `*.md` links to the site's routes.
 *
 * ./docs links between files with plain relative paths (`installation.md`,
 * `../guides/logging.md#which-level-to-use`) so the folder is navigable on GitHub. On the site those
 * files render at extension-less, base-prefixed routes, so each link is resolved against its source
 * file and mapped onto its route — base applied, anchor preserved, external/absolute/anchor-only
 * links left untouched.
 */
function rehypeMarkdownLinks() {
	return (/** @type {any} */ tree, /** @type {any} */ file) => {
		visit(tree, 'element', (/** @type {any} */ node) => {
			if (node.tagName !== 'a' || typeof node.properties?.href !== 'string') {
				return
			}
			const match = node.properties.href.match(/^(?!https?:|mailto:|\/|#)(.+?)\.md(#.*)?$/i)
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
			node.properties.href = `${linkBase}/${route}${route ? '/' : ''}${match[2] ?? ''}`
		})
	}
}

export default defineConfig({
	...(site ? { site } : {}),
	...(base ? { base } : {}),
	markdown: {
		processor: unified({
			remarkPlugins: [remarkAlert],
			rehypePlugins: [rehypeMarkdownLinks],
		}),
	},
	integrations: [
		starlight({
			title: 'Mitra',
			description: 'Documentation for Mitra — one calendar to plan your events and tasks, self-hosted and synced with the calendars you already use.',
			logo: { src: './src/assets/mitra.svg' },
			favicon: '/favicon.svg',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/a11delavar/mitra' },
			],
			editLink: { baseUrl: 'https://github.com/a11delavar/mitra/edit/main/docs/' },
			sidebar: [
				{ label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
				{ label: 'Integrations', items: [{ autogenerate: { directory: 'integrations' } }] },
				{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
				{ label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
			],
			customCss: ['./src/styles/custom.css'],
			plugins: [
				// No top-nav links — the sidebar is the only navigation for now.
				lucode(),
			],
		}),
	],
})
