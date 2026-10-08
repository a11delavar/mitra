import fs from 'node:fs'
import path from 'node:path'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import sharp from 'sharp'
import { base, docsBase } from '../site.mjs'
import { linesOf, parseChangelog, type ChangelogCategory, type ParsedChangelogSection } from '../../src/features/about/Changelog'
import { ReleaseNotes, type ReleaseCapture } from '../../src/features/about/ReleaseNotes'

export { linesOf }

// From cwd, not `import.meta`: this module is bundled, so its own path would point into dist.
const repoRoot = path.resolve(process.cwd(), '..')
const releasesDir = path.join(repoRoot, 'releases')

/** Where a release stands: in development, the newest shipped (what the `:latest` image runs), or earlier. */
export type ReleaseState = 'draft' | 'latest' | 'released'

/** A minor release as the site shows it: its notes, if its folder has them, and its changelog sections. */
export class Release {
	static #all: Array<Release> | undefined

	/** Every release, newest first: each `releases/<minor>/` folder and each minor the changelog lists. */
	static all(): Array<Release> {
		// Vite does not watch ../releases, so the dev server reads it on every request.
		if (Release.#all && !import.meta.env.DEV) {
			return Release.#all
		}
		const sections = Map.groupBy(parseChangelog(fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8')), section => ReleaseNotes.minorOf(section.version))
		sections.delete('unreleased')
		const folders = !fs.existsSync(releasesDir) ? [] : fs.readdirSync(releasesDir)
			.filter(name => /^\d+\.\d+$/.test(name) && fs.existsSync(path.join(releasesDir, name, 'README.md')))
		const releases = [...new Set([...sections.keys(), ...folders])].sort(Release.newestFirst).map(version => {
			const notes = folders.includes(version) ? ReleaseNotes.parse(fs.readFileSync(path.join(releasesDir, version, 'README.md'), 'utf8')) : undefined
			return new Release(version, notes, sections.get(version) ?? [])
		})
		// The newest release that shipped is the one the `:latest` image runs.
		releases.find(release => release.date)?.markLatest()
		return Release.#all = releases
	}

	static find(version: string) {
		return Release.all().find(release => release.version === version)
	}

	static newestFirst(a: string, b: string) {
		const [aMajor = 0, aMinor = 0] = a.split('.').map(Number)
		const [bMajor = 0, bMinor = 0] = b.split('.').map(Number)
		return (bMajor - aMajor) || (bMinor - aMinor)
	}

	readonly version: string
	readonly notes: ReleaseNotes | undefined
	/** The `x.y.0` changelog section: everything the minor shipped. */
	readonly everything: ParsedChangelogSection | undefined
	/** The `x.y.z` sections after it, newest first. */
	readonly patches: Array<ParsedChangelogSection>
	#latest = false

	constructor(version: string, notes: ReleaseNotes | undefined, sections: Array<ParsedChangelogSection>) {
		this.version = version
		this.notes = notes
		this.everything = sections.find(section => section.version === `${version}.0`)
		this.patches = sections.filter(section => section !== this.everything).sort((a, b) => Number(b.version.split('.')[2]) - Number(a.version.split('.')[2]))
	}

	markLatest() {
		this.#latest = true
	}

	get date() {
		return this.notes?.date ?? this.everything?.date
	}

	get state(): ReleaseState {
		return this.#latest ? 'latest' : this.date ? 'released' : 'draft'
	}

	get url() {
		return `${base}/releases/${this.version}/`
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

	get highlights() {
		return this.notes?.highlights ?? []
	}

	get counts() {
		return (this.everything?.categories ?? [])
			.map(category => ({ type: category.type, label: labelOf(category), count: linesOf(category).length }))
			.filter(count => count.count > 0)
	}

	/** "24 features and 6 fixes", or the total when a release has neither. */
	get summary() {
		const count = (type: string) => this.counts.find(candidate => candidate.type === type)?.count ?? 0
		const parts = [
			count('features') ? plural(count('features'), 'feature', 'features') : '',
			count('bug-fixes') ? plural(count('bug-fixes'), 'fix', 'fixes') : '',
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

	/** A film is an `.mp4` under the capture's name rather than a still. */
	get film() {
		return fs.existsSync(this.path('light', 'mp4'))
	}

	url(theme: 'light' | 'dark') {
		return `${base}/releases/${this.release.version}/${this.capture.file(theme, this.film ? 'mp4' : 'webp')}`
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
	'bug-fixes': 'Fixes',
	'performance': 'Performance',
	'documentation': 'Documentation',
	'refactors': 'Refactors',
	'tests': 'Tests',
	'infrastructure': 'Infrastructure',
	'chores': 'Chores',
	'other': 'Other',
}

/** A category's label without cliff's glyph. */
export function labelOf(category: ChangelogCategory): string {
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

/** Renders a fragment of the notes, with the docs' relative links mapped onto the site's routes. */
export async function renderMarkdown(markdown: string): Promise<string> {
	return (await (await processor).render(markdown.replace(/\]\(((?:\.\.\/)+docs\/[^)\s]*)\)/g, (_match, href: string) => `](${docsUrl(href)})`))).code
}

/** The site's route of a docs page as the notes link it, `../../docs/views/table.md` being `/docs/views/table/`. */
export function docsUrl(href: string) {
	const match = href.match(/^(?:\.\.\/)+docs\/([^#]*?)(?:README)?\.md(#.*)?$/)
	if (!match) {
		return href
	}
	const route = match[1]!.replace(/\/$/, '')
	return `${base}/${docsBase}/${route}${route ? '/' : ''}${match[2] ?? ''}`
}
