import { readFile } from 'node:fs/promises'
import { type ChangelogCategory, type ChangelogSection } from '../Changelog.js'
const repository = 'https://github.com/a11delavar/mitra'

type ParsedSection = Pick<ChangelogSection, 'version' | 'date' | 'categories'>

/**
 * Splits changelog markdown into version sections matching cliff format (`## [0.3.0] - 2026-07-10`).
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

function categoryType(title: string) {
	return title.replace(/^[^\p{L}]+/u, '').trim().toLowerCase().replace(/\s+/g, '-')
}

function isReleaseVersion(version: string) {
	return /^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) && !version.endsWith('-dirty')
}

function currentSectionVersion(version: string) {
	return isReleaseVersion(version) ? version.replace(/^v/, '') : 'unreleased'
}

function sectionUrl(version: string) {
	return version === 'unreleased' ? `${repository}/releases` : `${repository}/releases/tag/v${version}`
}

/**
 * Annotates parsed sections with `current` indicator and GitHub release URLs for the running version.
 */
export function annotateChangelog(sections: Array<ParsedSection>, version: string): Array<ChangelogSection> {
	const wanted = currentSectionVersion(version)
	const match = sections.findIndex(section => section.version === wanted)
	const currentIndex = match < 0 ? 0 : match
	return sections.map((section, index) => ({ ...section, current: index === currentIndex, url: sectionUrl(section.version) }))
}

export function runningReleaseUrl() {
	return isReleaseVersion(mitra.version) ? `${repository}/releases/tag/${mitra.version}` : undefined
}

const changelogPath = `${import.meta.dirname}/../../CHANGELOG.md`

let cache: Array<ChangelogSection> | undefined

/** Returns the parsed, cached changelog for the running build. */
export async function getChangelog(): Promise<Array<ChangelogSection>> {
	return cache ??= annotateChangelog(parseChangelog(await readFile(changelogPath, 'utf8').catch(() => '')), mitra.version)
}
