import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type ParsedChangelogSection } from './Changelog.js'
import { Release } from './Release.js'
import { ReleaseNotes } from './ReleaseNotes.js'

const section = (version: string, date?: string): ParsedChangelogSection => ({
	version,
	date,
	categories: [{ type: 'features', title: '✨ Features', markdown: `- Something in ${version}` }],
})

describe('Release', () => {
	it('lists every minor newest first, its patches apart, and marks the newest shipped one latest', () => {
		const releases = Release.list([section('0.6.1', '2026-10-09'), section('0.6.0', '2026-10-05'), section('0.5.0', '2026-08-25')], new Map())
		assert.deepEqual(releases.map(release => [release.version, release.state]), [['0.6', 'latest'], ['0.5', 'released']])
		assert.equal(releases[0]!.everything?.version, '0.6.0')
		assert.deepEqual(releases[0]!.patches.map(patch => patch.version), ['0.6.1'])
		assert.deepEqual(releases[0]!.counts, [{ type: 'features', title: '✨ Features', count: 1 }])
	})

	it('reads fixes and performance as one category of improvements, where the first of them stood', () => {
		const [release] = Release.list([{
			version: '0.6.0',
			date: '2026-10-05',
			categories: [
				{ type: 'features', title: '✨ Features', markdown: '- A feature' },
				{ type: 'performance', title: '⚡ Performance', markdown: '- Faster' },
				{ type: 'bug-fixes', title: '🐛 Bug Fixes', markdown: '- A fix\n- Another fix' },
				{ type: 'chores', title: '🔧 Chores', markdown: '- A chore' },
			],
		}], new Map())
		assert.deepEqual(release!.counts.map(count => [count.type, count.count]), [['features', 1], ['improvements', 3], ['chores', 1]])
	})

	it('gives the commits past the last tag to the release in development', () => {
		const notes = new Map([['0.7', ReleaseNotes.parse('---\ntitle: Next\n---\nSoon.\n')]])
		const [draft, latest] = Release.list([section(Release.unreleased), section('0.6.0', '2026-10-05')], notes)
		assert.equal(draft!.version, '0.7')
		assert.equal(draft!.state, 'draft')
		assert.equal(draft!.everything?.version, Release.unreleased)
		assert.equal(latest!.state, 'latest')
	})

	it('develops the next undated release and plans the ones beyond it', () => {
		const undated = (title: string) => ReleaseNotes.parse(`---\ntitle: ${title}\n---\nSoon.\n`)
		const notes = new Map([['0.8', undated('Later')], ['0.7', undated('Next')]])
		const [planned, draft, latest] = Release.list([section(Release.unreleased), section('0.6.0', '2026-10-05')], notes)
		assert.deepEqual([planned!.version, planned!.state, planned!.everything], ['0.8', 'planned', undefined])
		assert.deepEqual([draft!.version, draft!.state, draft!.everything?.version], ['0.7', 'draft', Release.unreleased])
		assert.equal(latest!.state, 'latest')
	})

	it('keeps the commits past the last tag a release of their own when nothing is in development', () => {
		const [unreleased] = Release.list([section(Release.unreleased), section('0.6.0', '2026-10-05')], new Map())
		assert.equal(unreleased!.unreleased, true)
		assert.equal(unreleased!.state, 'draft')
	})
})
