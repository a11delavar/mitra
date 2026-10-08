import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseChangelog, type ChangelogSection, type ParsedChangelogSection } from '../Changelog.js'
import { type ReleaseFolder } from '../Release.js'
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
// Written by the build (scripts/releaseAssets.ts): every release's notes, and the running release's captures.
const releasesPath = path.resolve(import.meta.dirname, '../../dist/releases')

let cache: { sections: Array<ChangelogSection>, folders: Array<ReleaseFolder> } | undefined

/** What the About dialog builds its releases from: the changelog for the running build, and the release folders it carries. */
export async function getReleaseSources() {
	return cache ??= {
		sections: annotateChangelog(parseChangelog(await readFile(changelogPath, 'utf8').catch(() => '')), mitra.version),
		folders: await Promise.all((await readdir(releasesPath).catch(() => new Array<string>())).map(async version => {
			const files = await readdir(path.join(releasesPath, version))
			return { version, markdown: await readFile(path.join(releasesPath, version, 'README.md'), 'utf8'), files: files.filter(file => file !== 'README.md') }
		})),
	}
}
