import { readFile } from 'node:fs/promises'

/** One version's section of CHANGELOG.md — the What's-New dialog's data. A plain DTO. */
export interface ChangelogSection {
	/** The bare version the heading names (`0.3.0`) — or `unreleased` for the section git-cliff emits
	 * above the tags (dev images carry one; see docker.yml's prepend step). */
	version: string
	/** The release date (`2026-07-10`); the unreleased section has none. */
	date?: string
	/** The section's body, verbatim markdown — the `### ✨ Features` groups and commit links the
	 * frontend's Markdown component renders as-is. */
	markdown: string
}

/**
 * Split a changelog into its version sections. The heading shape is exactly what cliff.toml emits
 * (and what release.yml's awk mirrors): `## [0.3.0] - 2026-07-10`, or `## [Unreleased]` for commits
 * past the last tag. Everything until the next `## [` heading is that section's body; anything
 * before the first one (the file's preamble) is dropped.
 */
export function parseChangelog(markdown: string): Array<ChangelogSection> {
	const sections = new Array<{ version: string, date?: string, lines: Array<string> }>()
	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/)
		if (heading) {
			sections.push({ version: heading[1] === 'Unreleased' ? 'unreleased' : heading[1]!, date: heading[2], lines: [] })
		} else {
			sections.at(-1)?.lines.push(line)
		}
	}
	return sections.map(({ version, date, lines }) => ({ version, date, markdown: lines.join('\n').trim() }))
}

/** Resolved like the data dir (see orm.ts): `/app/CHANGELOG.md` inside the image (the Dockerfile
 * copies it), the repo root in local dev — where its `[Unreleased]` section is whatever was last
 * generated, acceptable staleness for developers (`npm run changelog` refreshes it). */
const changelogPath = `${import.meta.dirname}/../../CHANGELOG.md`

let cache: Array<ChangelogSection> | undefined

/** The shipped changelog, newest-first. Read and parsed once, lazily — the file is immutable inside
 * a container. A missing file (source tarballs, odd deployments) reads as empty, never as an error. */
export async function getChangelog(): Promise<Array<ChangelogSection>> {
	return cache ??= parseChangelog(await readFile(changelogPath, 'utf8').catch(() => ''))
}
