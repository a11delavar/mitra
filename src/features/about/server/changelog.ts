import { readFile } from 'node:fs/promises'
import { parseChangelog, type ChangelogSection, type ParsedChangelogSection } from '../Changelog.js'
export { parseChangelog }
const repository = 'https://github.com/a11delavar/mitra'

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
export function annotateChangelog(sections: Array<ParsedChangelogSection>, version: string): Array<ChangelogSection> {
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
