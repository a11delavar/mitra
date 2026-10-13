import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Generates CHANGELOG.md (gitignored) from the commits and tags, as CI does before the image, the release and the site
// read it. git-cliff only walks back from HEAD, so a patch tagged off a side line (a backport) is generated from its own
// range and slotted in by version. Usage: npm run changelog [-- --tag vX.Y.Z] [--unreleased]

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (command: string) => execSync(command, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

class Version {
	static of(tag: string) {
		const match = /^v(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/.exec(tag)
		return match ? new Version(tag, [Number(match[1]), Number(match[2]), Number(match[3])], match[4]) : undefined
	}

	readonly tag: string
	readonly numbers: [number, number, number]
	readonly preRelease?: string

	constructor(tag: string, numbers: [number, number, number], preRelease?: string) {
		this.tag = tag
		this.numbers = numbers
		this.preRelease = preRelease
	}

	/** SemVer precedence, a pre-release before its release. */
	compare(other: Version) {
		const [difference = 0] = this.numbers.map((number, index) => number - other.numbers[index]!).filter(Boolean)
		return difference
			|| Number(!this.preRelease) - Number(!other.preRelease)
			|| (this.preRelease ?? '').localeCompare(other.preRelease ?? '', undefined, { numeric: true })
	}

	/** Whether it belongs to a minor no newer than the other's. */
	minorAtMost(other: Version) {
		return this.numbers[0] < other.numbers[0] || this.numbers[0] === other.numbers[0] && this.numbers[1] <= other.numbers[1]
	}
}

const isAncestor = (ancestor: string, descendant: string) => {
	try {
		run(`git merge-base --is-ancestor ${ancestor} ${descendant}`)
		return true
	} catch {
		return false
	}
}

/** The markdown split at its `## [version]` headings: what precedes the first, and each section with its version. */
function sectionsOf(markdown: string) {
	// A newline first: a split never cuts at the very start, which took a heading-led output's first section for the header.
	const [header = '', ...sections] = `\n${markdown}`.split(/\n(?=## \[)/)
	return { header, sections: sections.map(section => ({ version: /^## \[([^\]]+)\]/.exec(section)![1]!, markdown: `${section.trimEnd()}\n` })) }
}

/**
 * The changelog of HEAD's line, with the backports of its minors or older beside their minor. `tag` names the commits
 * past the last tag (a release being cut, before its tag exists); without it they are `[Unreleased]`, kept on request.
 */
export function generateChangelog({ tag, unreleased = false }: { tag?: string, unreleased?: boolean } = {}) {
	const { header, sections } = sectionsOf(run(`npx git-cliff${tag ? ` --tag ${tag}` : ''}`))
	const own = sections.filter(section => unreleased || section.version !== 'Unreleased')

	const tags = run('git tag -l v*').split('\n').map(name => Version.of(name.trim())).filter(version => !!version)
	const base = Version.of(tag ?? (() => {
		try {
			return run('git describe --tags --abbrev=0 --match v*').trim()
		} catch {
			return ''
		}
	})())
	const backports = !base ? [] : tags
		.filter(version => version.minorAtMost(base) && !isAncestor(version.tag, 'HEAD'))
		.flatMap(version => {
			const previous = tags.filter(candidate => candidate.compare(version) < 0 && isAncestor(candidate.tag, version.tag)).sort((a, b) => b.compare(a))[0]
			return previous ? sectionsOf(run(`npx git-cliff --strip all ${previous.tag}..${version.tag}`)).sections : []
		})

	const order = (version: string) => version === 'Unreleased' ? undefined : Version.of(`v${version}`)
	const ordered = [...own, ...backports].sort((a, b) => {
		const [left, right] = [order(a.version), order(b.version)]
		return !left ? -1 : !right ? 1 : right.compare(left)
	})
	return `${header.trim()}\n\n${ordered.map(section => section.markdown).join('\n')}`
}

export function writeChangelog(options?: Parameters<typeof generateChangelog>[0]) {
	fs.writeFileSync(path.join(rootDir, 'CHANGELOG.md'), generateChangelog(options))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const flag = (name: string) => process.argv.indexOf(`--${name}`)
	const tagIndex = flag('tag')
	writeChangelog({ tag: tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined, unreleased: flag('unreleased') >= 0 })
}
