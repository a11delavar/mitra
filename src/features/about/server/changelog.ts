import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Changelog, type ChangelogSection } from '../Changelog.js'
import { type ReleaseFolder } from '../Release.js'
import { Version } from '../Version.js'

/** The running build's GitHub release, where it is exactly a tag. */
export function runningReleaseUrl() {
	return Version.parse(mitra.version)?.isTagged ? `https://github.com/a11delavar/mitra/releases/tag/${mitra.version}` : undefined
}

const changelogPath = `${import.meta.dirname}/../../CHANGELOG.md`
// Written by the build (scripts/releaseAssets.ts): every release's notes, and the running release's captures.
const releasesPath = path.resolve(import.meta.dirname, '../../dist/releases')

let cache: { sections: Array<ChangelogSection>, folders: Array<ReleaseFolder> } | undefined

/** What the About dialog builds its releases from: the changelog for the running build, and the release folders it carries. */
export async function getReleaseSources() {
	return cache ??= {
		sections: Changelog.parse(await readFile(changelogPath, 'utf8').catch(() => '')).for(mitra.version),
		folders: await Promise.all((await readdir(releasesPath).catch(() => new Array<string>())).map(async version => {
			const files = await readdir(path.join(releasesPath, version))
			const translations = await Promise.all(files.flatMap(file => {
				const language = file.match(/^README\.(\w+)\.md$/)?.[1]
				return language ? [readFile(path.join(releasesPath, version, file), 'utf8').then(markdown => [language, markdown] as const)] : []
			}))
			return {
				version,
				markdown: await readFile(path.join(releasesPath, version, 'README.md'), 'utf8'),
				translations: Object.fromEntries(translations),
				files: files.filter(file => !/^README(\.\w+)?\.md$/.test(file)),
			}
		})),
	}
}
