import fs from 'node:fs'
import path from 'node:path'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import sharp from 'sharp'
import { base, docsBase, languages, localized } from '../site.mjs'
import { translationOf, translationState } from '../tools/translations.mjs'
import { linesOf, parseChangelog } from '../../src/features/about/Changelog'
import { Release as ReleaseModel } from '../../src/features/about/Release'
import { ReleaseDocs, ReleaseNotes, type ReleaseCapture, type ReleaseSection } from '../../src/features/about/ReleaseNotes'
import { localize } from './i18n'

export { linesOf }

// From cwd, not `import.meta`: this module is bundled, so its own path would point into dist.
const repoRoot = path.resolve(process.cwd(), '..')
const releasesDir = path.join(repoRoot, 'releases')

/** A release as the site shows it, read from `CHANGELOG.md` and the `releases/` folders, in one of the site's languages. */
export class Release extends ReleaseModel {
	static readonly #all = new Map<string, Array<Release>>()

	/** Every release, newest first, its notes in `language` where translated (`README.de.md`) and in English where not. */
	static all(language = languages[0]!): Array<Release> {
		// Vite does not watch ../releases, so the dev server reads it on every request.
		const cached = Release.#all.get(language)
		if (cached && !import.meta.env.DEV) {
			return cached
		}
		const sections = parseChangelog(fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8'))
		const folders = !fs.existsSync(releasesDir) ? [] : fs.readdirSync(releasesDir)
			.filter(name => /^\d+\.\d+$/.test(name) && fs.existsSync(path.join(releasesDir, name, 'README.md')))
		const notes = new Map(folders.map(version => [version, ReleaseNotes.parse(fs.readFileSync(path.join(releasesDir, version, 'README.md'), 'utf8'))]))
		const translated = new Map(folders.flatMap(version => {
			const file = path.join(repoRoot, translationOf(`releases/${version}/README.md`, language))
			const translation = language !== languages[0] && fs.existsSync(file) ? notes.get(version)!.translation(fs.readFileSync(file, 'utf8')) : undefined
			return translation ? [[version, translation] as const] : []
		}))
		const releases = Release.list(sections, new Map([...notes].map(([version, english]) => [version, translated.get(version) ?? english])))
		for (const release of releases) {
			release.language = language
			release.translated = language === languages[0] || translated.has(release.version)
			release.english = notes.get(release.version)
		}
		Release.#all.set(language, releases)
		return releases
	}

	static find(version: string, language = languages[0]!) {
		return Release.all(language).find(release => release.version === version)
	}

	/** The language of the page it is read on, set by `all()`. */
	language = languages[0]!
	/** Whether its notes read in that language rather than in English, set by `all()`. */
	translated = true
	/** Its notes in English, whichever language they read in, set by `all()`. */
	english: ReleaseNotes | undefined

	/** A section's anchor on the page: the English heading's in the same place, so `page#section` is one in every language. */
	anchorOf(section: ReleaseSection) {
		const index = this.notes?.sections.indexOf(section) ?? -1
		return anchorOf((this.english?.sections[index] ?? section).heading)
	}

	/** The languages its notes are written in, English first. */
	get languages() {
		return languages.filter(language => language === languages[0] || translationState(this.file, language, repoRoot) !== 'missing')
	}

	/** Whether its notes in this language are older than the English ones. */
	get outdated() {
		return this.language !== languages[0] && this.translated && translationState(this.file, this.language, repoRoot) === 'outdated'
	}

	/** Its English notes, repo-relative. */
	get file() {
		return `releases/${this.version}/README.md`
	}

	get t() {
		return localize(this.language)
	}

	get url() {
		return `${base}${localized(`/releases/${this.version}/`, this.language)}`
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
		return this.notes?.intro.replace(/\s+/g, ' ') || this.t('What changed in Mitra ${version}: ${summary}.', { version: this.version, summary: this.summary })
	}

	/** "24 features and 6 improvements", or the total when a release has neither. */
	get summary() {
		const count = (type: string) => this.counts.find(candidate => candidate.type === type)?.count ?? 0
		const parts = [
			count('features') ? this.t('${count:pluralityNumber} features', { count: count('features') }) : '',
			count('improvements') ? this.t('${count:pluralityNumber} improvements', { count: count('improvements') }) : '',
		].filter(Boolean)
		if (parts.length) {
			return new Intl.ListFormat(this.language, { type: 'conjunction' }).format(parts)
		}
		const total = this.counts.reduce((sum, candidate) => sum + candidate.count, 0)
		return total ? this.t('${count:pluralityNumber} changes', { count: total }) : ''
	}

	/** A changelog category's label in the release's language, without cliff's glyph. */
	labelOf(category: { type: string, title: string }): string {
		const labels: Record<string, () => string> = {
			'features': () => this.t('Features'),
			'improvements': () => this.t('Improvements'),
			'documentation': () => this.t('Documentation'),
			'refactors': () => this.t('Refactors'),
			'tests': () => this.t('Tests'),
			'other': () => this.t('Other'),
		}
		return labels[category.type]?.() ?? category.title.replace(/^[^\p{L}]+/u, '').trim()
	}

	/** "24 features", a category's count of commits in the release's language. */
	countOf(count: { type: string, title: string, count: number }) {
		const counts: Record<string, () => string> = {
			'features': () => this.t('${count:pluralityNumber} features', { count: count.count }),
			'improvements': () => this.t('${count:pluralityNumber} improvements', { count: count.count }),
			'documentation': () => this.t('${count:pluralityNumber} documentation changes', { count: count.count }),
			'refactors': () => this.t('${count:pluralityNumber} refactors', { count: count.count }),
		}
		return counts[count.type]?.() ?? this.t('${count:pluralityNumber} other changes', { count: count.count })
	}

	/** A day the release or a patch shipped, in the release's language. */
	formatDate(iso: string, style: 'short' | 'long' = 'short') {
		const options: Intl.DateTimeFormatOptions = style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' } : { dateStyle: 'long' }
		// British English reads the day before the month, as the rest of Europe does.
		return new Intl.DateTimeFormat(this.language === 'en' ? 'en-GB' : this.language, { ...options, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
	}

	/** Renders a fragment of its notes, with the docs' relative links mapped onto the site's routes in its language. */
	async render(markdown: string) {
		return (await (await processor).render(ReleaseDocs.linked(markdown, page => this.docsPage(page)))).code
	}

	/** The site's route of a docs page as the notes link it, `../../docs/views/table.md` being `/docs/views/table/`. */
	docsUrl(href: string) {
		const page = ReleaseDocs.pageOf(href)
		return page === undefined ? href : this.docsPage(page)
	}

	private docsPage(page: string) {
		return `${base}${localized(`/${docsBase}/`, this.language)}${page}`
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

/** A heading's anchor on its release's page. */
function anchorOf(heading: string) {
	return heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

const processor = createMarkdownProcessor()
