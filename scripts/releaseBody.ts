import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseChangelog } from '../src/features/about/Changelog.ts'
import { ReleaseNotes } from '../src/features/about/ReleaseNotes.ts'
import { site, withBase } from '../website/site.mjs'

// The GitHub release body for a tag, on stdout. A minor's is its notes in short (title, intro, each highlight's first
// sentence) pointing at its page on the website, which lists its commits; GitHub links its tag's own. A patch has no
// notes of its own, so its body is a pointer at its minor and its changelog section.
// Usage: node scripts/releaseBody.ts v0.6.0 > RELEASE_NOTES.md

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tag = process.argv[2]
if (!tag) {
	console.error('Usage: node scripts/releaseBody.ts <tag>')
	process.exit(1)
}

const version = tag.replace(/^v/, '')
const minor = ReleaseNotes.minorOf(version)
const origin = new URL(site)
const page = `${origin.origin}${withBase(`/releases/${minor}/`)}`

const notesPath = path.join(rootDir, 'releases', minor, 'README.md')
const notes = fs.existsSync(notesPath) ? ReleaseNotes.parse(fs.readFileSync(notesPath, 'utf8')) : undefined
const sections = parseChangelog(fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8'))
const section = sections.find(candidate => candidate.version === version)

const lines = new Array<string>()
if (notes?.title && ReleaseNotes.isMinorRelease(version)) {
	lines.push(
		`## ${notes.title}`,
		'',
		notes.intro,
		'',
		...notes.highlights.map(highlight => `- **${highlight.heading}:** ${highlight.lead}`),
		'',
		`**[Read the full release notes](${page})**`,
	)
} else {
	if (notes?.title) {
		lines.push(`A patch of [${minor}: ${notes.title}](${page}).`, '')
	}
	for (const category of section?.categories ?? []) {
		lines.push(`### ${category.title.replace(/^[^\p{L}]+/u, '')}`, category.markdown, '')
	}
}
if (!lines.length) {
	lines.push(`No CHANGELOG.md section found. Run 'npm run changelog -- --tag ${tag}' before tagging.`)
}
process.stdout.write(`${lines.join('\n').trim()}\n`)
