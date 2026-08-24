import { readFile } from 'node:fs/promises'
import { type ChangelogCategory, type ChangelogSection } from '../Changelog.js'
/** Where the project lives — every changelog link the frontend renders is resolved from this here,
 * so the frontend never builds a GitHub URL out of a version string. */
const repository = 'https://github.com/a11delavar/mitra'

/** A section as read from the file — before the running build stamps it with {@link annotateChangelog}. */
type ParsedSection = Pick<ChangelogSection, 'version' | 'date' | 'categories'>

/**
 * Split a changelog into its version sections. The heading shape is exactly what cliff.toml emits
 * (and what release.yml's awk mirrors): `## [0.3.0] - 2026-07-10`, or `## [Unreleased]` for commits
 * past the last tag. Everything until the next `## [` heading is that section's body; anything
 * before the first one (the file's preamble) is dropped. Each body is broken down into typed
 * categories here — the frontend keys off {@link ChangelogCategory.type} rather than parsing the
 * markdown itself.
 */
export function parseChangelog(markdown: string): Array<ParsedSection> {
	const sections = new Array<{ version: string, date?: string, lines: Array<string> }>()
	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/)
		if (heading) {
			sections.push({ version: heading[1] === 'Unreleased' ? 'unreleased' : heading[1]!, date: heading[2], lines: [] })
		} else {
			sections.at(-1)?.lines.push(line)
		}
	}
	return sections.map(({ version, date, lines }) => ({ version, date, categories: parseCategories(lines) }))
}

/**
 * Group a section's lines into its `### <emoji> <Title>` categories. The heading names the category;
 * the lines under it (until the next heading) are its entries, kept as verbatim markdown. Content
 * before the first heading — only ever blank lines in a cliff-generated file — is dropped.
 */
function parseCategories(lines: Array<string>): Array<ChangelogCategory> {
	const categories = new Array<ChangelogCategory & { lines: Array<string> }>()
	for (const line of lines) {
		const heading = line.match(/^### (.+?)\s*$/)
		if (heading) {
			categories.push({ type: categoryType(heading[1]!), title: heading[1]!, markdown: '', lines: [] })
		} else {
			categories.at(-1)?.lines.push(line)
		}
	}
	return categories.map(({ type, title, lines }) => ({ type, title, markdown: lines.join('\n').trim() }))
}

/** The slug the frontend styles and filters by: the heading with its leading emoji (and any other
 * non-letter noise) stripped, lower-cased, spaces hyphenated — `🐛 Bug Fixes` → `bug-fixes`. */
function categoryType(title: string) {
	return title.replace(/^[^\p{L}]+/u, '').trim().toLowerCase().replace(/\s+/g, '-')
}

/** Whether a version string names an exact release tag (`v0.3.0`), as opposed to a describe string,
 * a dirty tree, or a git-less `dev`. */
function isReleaseVersion(version: string) {
	return /^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) && !version.endsWith('-dirty')
}

/** The bare version whose section describes a build running `version`: the tag itself (`v` stripped)
 * on a release, `unreleased` (what a dev image's CI prepend covers) for everything else. */
function currentSectionVersion(version: string) {
	return isReleaseVersion(version) ? version.replace(/^v/, '') : 'unreleased'
}

/** Where a section's notes live on GitHub: its release tag page, or the releases index for the
 * unreleased section (which has no page of its own). */
function sectionUrl(version: string) {
	return version === 'unreleased' ? `${repository}/releases` : `${repository}/releases/tag/v${version}`
}

/**
 * Stamp each parsed section with what the running build implies: which one is `current` — the exact
 * version match, or the newest as a fallback (e.g. a dev build whose committed changelog carries no
 * `[Unreleased]` section) — and its GitHub `url`. Pure and version-explicit so it is testable; the
 * frontend renders these fields instead of re-deriving them.
 */
export function annotateChangelog(sections: Array<ParsedSection>, version: string): Array<ChangelogSection> {
	const wanted = currentSectionVersion(version)
	const match = sections.findIndex(section => section.version === wanted)
	const currentIndex = match < 0 ? 0 : match
	return sections.map((section, index) => ({ ...section, current: index === currentIndex, url: sectionUrl(section.version) }))
}

/** The running build's own release page, when it is a tagged release — the About header links its
 * version there. Undefined for describe/dirty/dev builds, which have no page of their own. */
export function runningReleaseUrl() {
	return isReleaseVersion(mitra.version) ? `${repository}/releases/tag/${mitra.version}` : undefined
}

/** Resolved like the data dir (see orm.ts): `/app/CHANGELOG.md` inside the image (the Dockerfile
 * copies it), the repo root in local dev — where its `[Unreleased]` section is whatever was last
 * generated, acceptable staleness for developers (`npm run changelog` refreshes it). */
const changelogPath = `${import.meta.dirname}/../../CHANGELOG.md`

let cache: Array<ChangelogSection> | undefined

/** The shipped changelog, newest-first, annotated for the running build. Read and parsed once,
 * lazily — the file and the build version are both immutable inside a container. A missing file
 * (source tarballs, odd deployments) reads as empty, never as an error. */
export async function getChangelog(): Promise<Array<ChangelogSection>> {
	return cache ??= annotateChangelog(parseChangelog(await readFile(changelogPath, 'utf8').catch(() => '')), mitra.version)
}
