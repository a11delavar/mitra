import fs from 'node:fs'
import path from 'node:path'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import sharp from 'sharp'
import { base, docsBase } from '../site.mjs'
import { linesOf, parseChangelog } from '../../src/features/about/Changelog'
import { Release as ReleaseModel } from '../../src/features/about/Release'
import { ReleaseDocs, ReleaseNotes, type ReleaseCapture } from '../../src/features/about/ReleaseNotes'

export { linesOf }

// From cwd, not `import.meta`: this module is bundled, so its own path would point into dist.
const repoRoot = path.resolve(process.cwd(), '..')
const releasesDir = path.join(repoRoot, 'releases')

/** A release as the site shows it, read from `CHANGELOG.md` and the `releases/` folders. */
export class Release extends ReleaseModel {
	static #all: Array<Release> | undefined

	/** Every release, newest first. */
	static all(): Array<Release> {
		// Vite does not watch ../releases, so the dev server reads it on every request.
		if (Release.#all && !import.meta.env.DEV) {
			return Release.#all
		}
		const sections = parseChangelog(fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8'))
		const folders = !fs.existsSync(releasesDir) ? [] : fs.readdirSync(releasesDir)
			.filter(name => /^\d+\.\d+$/.test(name) && fs.existsSync(path.join(releasesDir, name, 'README.md')))
		const notes = new Map(folders.map(version => [version, ReleaseNotes.parse(fs.readFileSync(path.join(releasesDir, version, 'README.md'), 'utf8'))]))
		return Release.#all = Release.list(sections, notes)
	}

	static find(version: string) {
		return Release.all().find(release => release.version === version)
	}

	get url() {
		return `${base}/releases/${this.version}/`
	}

	/** What the release shipped that its readers would notice, by category. */
	get listed() {
		return this.categories.filter(category => !Release.maintenance.has(category.type))
	}


	/** The notes' title, or the version alone for a release without notes. */
	get title() {
		return this.notes?.title || `Mitra ${this.version}`
	}

	/** `0.6: Calendars in Mitra…`, for a `<title>` and a feed item. */
	get name() {
		return this.notes?.title ? `${this.version}: ${this.notes.title}` : this.title
	}

	get description() {
		return this.notes?.intro.replace(/\s+/g, ' ') || `What changed in Mitra ${this.version}: ${this.summary}.`
	}

	/** "24 features and 6 improvements", or the total when a release has neither. */
	get summary() {
		const count = (type: string) => this.counts.find(candidate => candidate.type === type)?.count ?? 0
		const parts = [
			count('features') ? plural(count('features'), 'feature', 'features') : '',
			count('improvements') ? plural(count('improvements'), 'improvement', 'improvements') : '',
		].filter(Boolean)
		if (parts.length) {
			return parts.join(' and ')
		}
		const total = this.counts.reduce((sum, candidate) => sum + candidate.count, 0)
		return total ? plural(total, 'change', 'changes') : ''
	}

	/** The `view-transition-name` of one of the release's parts, the same on the list and on its page so it travels between them, and its class for how. */
	transition(part: string, kind?: 'text') {
		return `view-transition-name: release-${this.version.replace(/\W/g, '-')}-${part};${kind ? ` view-transition-class: ${kind};` : ''}`
	}

	/** A capture the notes name, as the release's folder holds it. */
	capture(capture: ReleaseCapture) {
		return new Capture(this, capture)
	}
}

/** A frozen capture in a release's folder, served from `/releases/<minor>/` as prepare.mjs copies it. */
export class Capture {
	readonly release: Release
	readonly capture: ReleaseCapture

	constructor(release: Release, capture: ReleaseCapture) {
		this.release = release
		this.capture = capture
	}

	get alt() {
		return this.capture.alt
	}

	/** Whether the release's folder holds the capture yet: the notes may name one before it is shot. */
	get exists() {
		return fs.existsSync(this.path('light')) || this.film
	}

	/** A film is an `.mp4` under the capture's name rather than a still. */
	get film() {
		return fs.existsSync(this.path('light', 'mp4'))
	}

	url(theme: 'light' | 'dark') {
		return `${base}/releases/${this.release.version}/${this.capture.file(theme, this.film ? 'mp4' : 'webp')}`
	}

	/** The still under the capture's name: the capture itself, or a film's first frame, its poster. */
	poster(theme: 'light' | 'dark') {
		return `${base}/releases/${this.release.version}/${this.capture.file(theme)}`
	}

	/** The pixel size of the light take, which the dark one shares, so the page lays the capture out before it loads. */
	async size() {
		return this.film ? mp4Size(this.path('light', 'mp4')) : webpSize(this.path('light'))
	}

	private path(theme: 'light' | 'dark', extension: 'webp' | 'mp4' = 'webp') {
		return path.join(releasesDir, this.release.version, this.capture.file(theme, extension))
	}
}

async function webpSize(file: string) {
	const { width, height } = await sharp(file).metadata()
	return { width, height }
}

/** The video track's size from the file's `moov/trak/tkhd` box, where it sits as 16.16 fixed-point numbers. */
function mp4Size(file: string) {
	const bytes = fs.readFileSync(file)
	const boxes = function* (start: number, end: number): Generator<{ type: string, start: number, end: number }> {
		for (let offset = start; offset + 8 <= end;) {
			const size = bytes.readUInt32BE(offset) || end - offset
			const type = bytes.toString('latin1', offset + 4, offset + 8)
			const header = size === 1 ? 16 : 8
			const length = size === 1 ? Number(bytes.readBigUInt64BE(offset + 8)) : size
			yield { type, start: offset + header, end: offset + length }
			offset += length
		}
	}
	const find = (type: string, start: number, end: number) => [...boxes(start, end)].find(box => box.type === type)
	const moov = find('moov', 0, bytes.length)
	for (const trak of moov ? [...boxes(moov.start, moov.end)].filter(box => box.type === 'trak') : []) {
		const tkhd = find('tkhd', trak.start, trak.end)
		if (tkhd) {
			const at = tkhd.start + (bytes[tkhd.start] === 1 ? 88 : 76)
			const width = bytes.readUInt32BE(at) / 65536
			const height = bytes.readUInt32BE(at + 4) / 65536
			if (width && height) {
				return { width, height }
			}
		}
	}
	return { width: undefined, height: undefined }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const labels: Record<string, string> = {
	'features': 'Features',
	'improvements': 'Improvements',
	'documentation': 'Documentation',
	'refactors': 'Refactors',
	'tests': 'Tests',
	'infrastructure': 'Infrastructure',
	'chores': 'Chores',
	'other': 'Other',
}

/** A category's label without cliff's glyph. */
export function labelOf(category: { type: string, title: string }): string {
	return labels[category.type] ?? category.title.replace(/^[^\p{L}]+/u, '').trim()
}

/** A heading's anchor on its release's page. */
export function anchorOf(heading: string) {
	return heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

const dateFormats = {
	short: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
	long: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }),
}

export function formatDate(iso: string, style: 'short' | 'long' = 'short') {
	return dateFormats[style].format(new Date(`${iso}T00:00:00Z`))
}

const processor = createMarkdownProcessor()
const docsPage = (page: string) => `${base}/${docsBase}/${page}`

/** Renders a fragment of the notes, with the docs' relative links mapped onto the site's routes. */
export async function renderMarkdown(markdown: string): Promise<string> {
	return (await (await processor).render(ReleaseDocs.linked(markdown, docsPage))).code
}

/** The site's route of a docs page as the notes link it, `../../docs/views/table.md` being `/docs/views/table/`. */
export function docsUrl(href: string) {
	const page = ReleaseDocs.pageOf(href)
	return page === undefined ? href : docsPage(page)
}
