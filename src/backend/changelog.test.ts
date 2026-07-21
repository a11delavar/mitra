import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseChangelog } from './changelog.js'

// The parser must accept exactly what cliff.toml emits (see that file's `body` template): release
// headings `## [0.3.0] - 2026-07-10`, an optional `## [Unreleased]` on top (dev images), and a file
// preamble before the first section.

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

	it('keeps each section\'s body verbatim, trimmed, without leaking into its neighbors', () => {
		const sections = parseChangelog(fixture)
		assert.match(sections[1]!.markdown, /^### ✨ Features/)
		assert.match(sections[1]!.markdown, /Command Palette/)
		assert.match(sections[1]!.markdown, /Fix a thing/)
		assert.doesNotMatch(sections[1]!.markdown, /Recurring Entries/)
		assert.doesNotMatch(sections[1]!.markdown, /What's New dialog/)
	})

	it('drops the preamble before the first section', () => {
		const sections = parseChangelog(fixture)
		assert.doesNotMatch(sections[0]!.markdown, /All notable changes/)
	})

	it('reads an empty or section-less file as no sections', () => {
		assert.deepEqual(parseChangelog(''), [])
		assert.deepEqual(parseChangelog('# Changelog\n\nNothing tagged yet.'), [])
	})

	it('treats a malformed heading as body text, not a new section', () => {
		const sections = parseChangelog('## [0.1.0] - 2026-06-07\n## Not a version heading\n- a change')
		assert.equal(sections.length, 1)
		assert.match(sections[0]!.markdown, /Not a version heading/)
	})

	it('tolerates CRLF line endings and trailing whitespace on headings', () => {
		const sections = parseChangelog('## [0.1.0] - 2026-06-07 \r\n- a change\r\n')
		assert.equal(sections.length, 1)
		assert.equal(sections[0]!.version, '0.1.0')
		assert.equal(sections[0]!.markdown, '- a change')
	})
})
