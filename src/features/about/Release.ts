// By their sources' names: scripts/releaseBody.ts runs this in Node, which finds no source behind a `.js`.
import { type ChangelogCategory, linesOf, type ParsedChangelogSection } from './Changelog.ts'
import { ReleaseNotes } from './ReleaseNotes.ts'
import { repository } from '../../../website/site.mjs'

/**
 * Where a release stands: planned (an undated folder beyond the next), in development (the next undated folder), the
 * newest shipped (what the `:latest` image runs), or earlier. Derived from the dates and the order, never written down,
 * so a release's date moves the next one into development on its own.
 */
export type ReleaseState = 'planned' | 'draft' | 'latest' | 'released'

/** A release's folder as the server hands it over: its notes, their translations by language, and the files the image carries beside them. */
export interface ReleaseFolder {
	version: string
	markdown: string
	translations: Record<string, string>
	files: Array<string>
}

/**
 * A minor release: its notes, when its folder holds them, and its changelog sections, the patches apart. The website
 * and the app build their lists with `Release.list()` from the same two sources. Pure.
 */
export class Release {
	/** The changelog's section for commits past the last tag, generated into dev builds only. */
	static readonly unreleased = 'unreleased'

	/**
	 * Every minor the changelog or a notes folder knows, newest first, the newest dated one marked latest. The oldest
	 * undated folder is the release in development, and the commits past the last tag are its; any newer undated folder
	 * is planned. Without a folder in development, those commits are a release of their own.
	 */
	static list<T extends Release>(
		this: new (version: string, notes: ReleaseNotes | undefined, sections: ReadonlyArray<ParsedChangelogSection>) => T,
		sections: ReadonlyArray<ParsedChangelogSection>,
		notes: ReadonlyMap<string, ReleaseNotes>,
	): Array<T> {
		const byMinor = Map.groupBy(sections, section => section.version === Release.unreleased ? Release.unreleased : ReleaseNotes.minorOf(section.version))
		const [draft, ...planned] = [...notes].filter(([, candidate]) => !candidate.date).map(([version]) => version).sort(Release.newestFirst).reverse()
		const unreleased = byMinor.get(Release.unreleased)
		if (draft && unreleased) {
			byMinor.set(draft, [...byMinor.get(draft) ?? [], ...unreleased])
			byMinor.delete(Release.unreleased)
		}
		const releases = [...new Set([...byMinor.keys(), ...notes.keys()])]
			.sort(Release.newestFirst)
			.map(version => new this(version, notes.get(version), byMinor.get(version) ?? []))
		const latest = releases.find(release => release.date)
		if (latest) {
			latest.latest = true
		}
		for (const release of releases.filter(release => planned.includes(release.version))) {
			release.planned = true
		}
		for (const [index, release] of releases.entries()) {
			release.previousTag = releases.slice(index + 1).find(older => older.newestTag)?.newestTag
		}
		return releases
	}

	/** Newest first, the unreleased commits above every version. */
	static newestFirst(a: string, b: string) {
		if (a === Release.unreleased || b === Release.unreleased) {
			return Number(b === Release.unreleased) - Number(a === Release.unreleased)
		}
		const [aMajor = 0, aMinor = 0] = a.split('.').map(Number)
		const [bMajor = 0, bMinor = 0] = b.split('.').map(Number)
		return (bMajor - aMajor) || (bMinor - aMinor)
	}

	readonly version: string
	readonly notes: ReleaseNotes | undefined
	/** Everything the minor shipped: its `x.y.0` section, or the unreleased commits while it is in development. */
	readonly everything: ParsedChangelogSection | undefined
	/** The `x.y.z` sections after it, newest first. */
	readonly patches: ReadonlyArray<ParsedChangelogSection>
	/** The newest release that shipped, set by `list()`. */
	latest = false
	/** An undated release beyond the one in development, set by `list()`. */
	planned = false
	/** The newest version tagged before this release, set by `list()`: where its commits start. */
	previousTag: string | undefined

	constructor(version: string, notes: ReleaseNotes | undefined, sections: ReadonlyArray<ParsedChangelogSection>) {
		this.version = version
		this.notes = notes
		this.everything = sections.find(section => section.version === `${version}.0` || section.version === Release.unreleased)
		this.patches = sections.filter(section => section !== this.everything).sort((a, b) => Number(b.version.split('.')[2]) - Number(a.version.split('.')[2]))
	}

	/** Its changelog sections, the release's own first. */
	get sections() {
		return [...this.everything ? [this.everything] : [], ...this.patches]
	}

	get unreleased() {
		return this.version === Release.unreleased
	}

	get date() {
		return this.notes?.date ?? this.everything?.date
	}

	get state(): ReleaseState {
		return this.latest ? 'latest' : this.date ? 'released' : this.planned ? 'planned' : 'draft'
	}

	/** The image channel that runs it: `:latest` the newest shipped, `:dev` the one in development. */
	get channel(): 'latest' | 'dev' | undefined {
		return this.state === 'latest' ? 'latest' : this.state === 'draft' ? 'dev' : undefined
	}

	get highlights() {
		return this.notes?.highlights ?? []
	}

	/** The kinds of commit a reader is told the number of rather than the list: tests, CI and build, chores. */
	static readonly maintenance = new Set(['tests', 'infrastructure', 'chores'])

	/** The kinds of commit a reader takes as one: a fix and a faster path both improve what is there. */
	static readonly improvements = new Set(['bug-fixes', 'performance'])

	/** What the release shipped by category as its readers see them, fixes and performance as Improvements. */
	get categories() {
		const categories = new Array<ChangelogCategory>()
		for (const category of this.everything?.categories ?? []) {
			const improvements = Release.improvements.has(category.type) ? categories.find(candidate => candidate.type === 'improvements') : undefined
			if (improvements) {
				improvements.markdown = `${improvements.markdown}\n${category.markdown}`
			} else {
				categories.push(Release.improvements.has(category.type) ? { type: 'improvements', title: 'Improvements', markdown: category.markdown } : category)
			}
		}
		return categories
	}

	/** How many commits only kept the project running. */
	get maintenanceCount() {
		return this.counts.filter(count => Release.maintenance.has(count.type)).reduce((sum, count) => sum + count.count, 0)
	}

	/** Its newest tagged version: the latest patch, else its own `x.y.0`. */
	get newestTag() {
		return this.patches[0]?.version ?? (this.everything && this.everything.version !== Release.unreleased ? this.everything.version : undefined)
	}

	/** Every commit of the release on GitHub, from the tag before it to its own, or to the main branch while in development. */
	get commitsUrl() {
		const head = this.date ? `v${this.version}.0` : 'main'
		return this.previousTag ? `${repository}/compare/v${this.previousTag}...${head}` : `${repository}/commits/${head}`
	}

	/** Commits per category, empty ones left out. */
	get counts() {
		return this.categories
			.map(category => ({ type: category.type, title: category.title, count: linesOf(category).length }))
			.filter(count => count.count > 0)
	}
}
