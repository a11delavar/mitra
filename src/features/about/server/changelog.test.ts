import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { annotateChangelog, parseChangelog } from './changelog.js'

const fixture = `# Changelog

All notable changes to Mitra are documented here.

## [Unreleased]

### ✨ Features
- What's New dialog ([abc1234](https://github.com/a11delavar/mitra/commit/abc1234))

## [0.3.0] - 2026-07-10

### ✨ Features
- Command Palette ([7df7313](https://github.com/a11delavar/mitra/commit/7df7313))

### 🐛 Bug Fixes
- Fix a thing ([1111111](https://github.com/a11delavar/mitra/commit/1111111))

## [0.2.0] - 2026-07-05

### ✨ Features
- Recurring Entries ([f87731e](https://github.com/a11delavar/mitra/commit/f87731e))
`

describe('parseChangelog', () => {
	it('splits the file into its version sections, newest-first as written', () => {
		const sections = parseChangelog(fixture)
		assert.deepEqual(sections.map(s => s.version), ['unreleased', '0.3.0', '0.2.0'])
	})

	it('lowercases the Unreleased marker and gives it no date', () => {
		const [unreleased] = parseChangelog(fixture)
		assert.equal(unreleased!.version, 'unreleased')
		assert.equal(unreleased!.date, undefined)
	})

	it('extracts the release date from the heading', () => {
		const sections = parseChangelog(fixture)
		assert.equal(sections[1]!.date, '2026-07-10')
		assert.equal(sections[2]!.date, '2026-07-05')
	})

	it('breaks a section into its categories, in order, without leaking into neighbors', () => {
		const [, release] = parseChangelog(fixture)
		assert.deepEqual(release!.categories.map(c => c.type), ['features', 'bug-fixes'])
		assert.deepEqual(release!.categories.map(c => c.title), ['✨ Features', '🐛 Bug Fixes'])
	})

	it('derives the type slug from the title with its emoji stripped', () => {
		const [, release] = parseChangelog(fixture)
		assert.equal(release!.categories[1]!.type, 'bug-fixes')
	})

	it('keeps each category\'s entries as verbatim markdown, trimmed', () => {
		const [, release] = parseChangelog(fixture)
		assert.equal(release!.categories[0]!.markdown, '- Command Palette ([7df7313](https://github.com/a11delavar/mitra/commit/7df7313))')
		assert.match(release!.categories[1]!.markdown, /Fix a thing/)
		assert.doesNotMatch(release!.categories[0]!.markdown, /Fix a thing/)
		assert.doesNotMatch(release!.categories[0]!.markdown, /Recurring Entries/)
	})

	it('reads an empty or section-less file as no sections', () => {
		assert.deepEqual(parseChangelog(''), [])
		assert.deepEqual(parseChangelog('# Changelog\n\nNothing tagged yet.'), [])
	})

	it('treats a malformed heading as body text, not a new section', () => {
		const sections = parseChangelog('## [0.1.0] - 2026-06-07\n## Not a version heading\n### 🐛 Bug Fixes\n- a change')
		assert.equal(sections.length, 1)
		assert.equal(sections[0]!.version, '0.1.0')
		assert.deepEqual(sections[0]!.categories.map(c => c.type), ['bug-fixes'])
	})

	it('tolerates CRLF line endings and trailing whitespace on headings', () => {
		const sections = parseChangelog('## [0.1.0] - 2026-06-07 \r\n### 🐛 Bug Fixes \r\n- a change\r\n')
		assert.equal(sections.length, 1)
		assert.equal(sections[0]!.version, '0.1.0')
		assert.equal(sections[0]!.categories[0]!.markdown, '- a change')
	})
})

describe('annotateChangelog', () => {
	const parsed = parseChangelog(fixture)

	it('marks the section matching a release build as current', () => {
		const [unreleased, release, older] = annotateChangelog(parsed, 'v0.3.0')
		assert.equal(release!.current, true)
		assert.equal(unreleased!.current, false)
		assert.equal(older!.current, false)
	})

	it('marks the unreleased section current for a describe/dev build', () => {
		const [unreleased, release] = annotateChangelog(parsed, 'v0.3.0-14-gabcdef')
		assert.equal(unreleased!.current, true)
		assert.equal(release!.current, false)
	})

	it('marks a dirty release build as unreleased, not its tag', () => {
		const [unreleased, release] = annotateChangelog(parsed, 'v0.3.0-dirty')
		assert.equal(unreleased!.current, true)
		assert.equal(release!.current, false)
	})

	it('falls back to the newest section when nothing matches', () => {
		const withoutUnreleased = parsed.filter(section => section.version !== 'unreleased')
		const [newest, older] = annotateChangelog(withoutUnreleased, 'dev')
		assert.equal(newest!.current, true)
		assert.equal(older!.current, false)
	})

	it('links each section to its GitHub notes — tag page, or releases index for unreleased', () => {
		const [unreleased, release] = annotateChangelog(parsed, 'v0.3.0')
		assert.equal(unreleased!.url, 'https://github.com/a11delavar/mitra/releases')
		assert.equal(release!.url, 'https://github.com/a11delavar/mitra/releases/tag/v0.3.0')
	})
})
