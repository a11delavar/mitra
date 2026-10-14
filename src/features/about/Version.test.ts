import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Version } from './Version.js'

const version = (value: string) => Version.parse(value)!
const channel = (value: string) => Version.parse(value)?.channel ?? { channel: 'none' }
const isNewer = (candidate: string, current: string) => {
	const [a, b] = [Version.parse(candidate), Version.parse(current)]
	return !!a && !!b && a.isNewerThan(b)
}

describe('Version', () => {
	it('reads tags, pre-releases and builds past them, with or without the v', () => {
		assert.deepEqual(version('v0.7.2').numbers, [0, 7, 2])
		assert.equal(version('0.7.0-rc.1').prerelease, 'rc.1')
		assert.equal(version('v1.0.0-rc.1-14-gabc1234').prerelease, 'rc.1')
		assert.equal(version('v1.0.0-rc.1-14-gabc1234').commit, 'abc1234')
		assert.equal(version('v1.2.3-14-gabc1234').prerelease, undefined)
		assert.equal(version('v1.2.3-dirty').prerelease, undefined)
		assert.equal(version('v1.2.3-dirty').dirty, true)
		assert.equal(String(version('v1.2.3-dirty')), 'v1.2.3-dirty')
		assert.equal(Version.parse('dev'), undefined)
		assert.equal(Version.parse('abc1234'), undefined)
		assert.equal(Version.parse('0.6'), undefined)
	})

	it('names the release it belongs to, and whether it starts it', () => {
		assert.equal(version('v0.6.2').release, '0.6')
		assert.equal(version('0.6.0-rc.1').release, '0.6')
		assert.equal(version('v0.7.0').startsRelease, true)
		assert.equal(version('0.7.0-rc.1').startsRelease, true)
		assert.equal(version('0.7.1').startsRelease, false)
	})

	it('is tagged only as a tag, never past one or with local changes', () => {
		assert.equal(version('v0.3.0').isTagged, true)
		assert.equal(version('v0.3.0-rc.1').isTagged, true)
		assert.equal(version('v0.3.0-14-gabcdef').isTagged, false)
		assert.equal(version('v0.3.0-dirty').isTagged, false)
		assert.equal(version('v0.3.0-rc.1').tag, '0.3.0-rc.1')
		assert.equal(version('v0.3.0-14-gabcdef').tag, '0.3.0')
	})

	describe('channel', () => {
		it('reads an exact stable tag as the release channel', () => {
			assert.deepEqual(channel('v1.2.3'), { channel: 'release', current: 'v1.2.3' })
			assert.deepEqual(channel('v0.3.0'), { channel: 'release', current: 'v0.3.0' })
		})

		it('reads a pre-release tag as the prerelease channel', () => {
			assert.deepEqual(channel('v1.2.3-rc.1'), { channel: 'prerelease', current: 'v1.2.3-rc.1' })
			assert.deepEqual(channel('v2.0.0-beta.3'), { channel: 'prerelease', current: 'v2.0.0-beta.3' })
		})

		it('reads a describe string as the dev channel, carrying the bare sha, past a pre-release too', () => {
			assert.deepEqual(channel('v1.2.3-14-gabc1234'), { channel: 'dev', sha: 'abc1234' })
			assert.deepEqual(channel('v1.0.0-rc.1-14-gabc1234'), { channel: 'dev', sha: 'abc1234' })
		})

		it('assigns no channel to local changes or shapes with nothing to compare against', () => {
			assert.deepEqual(channel('dev'), { channel: 'none' })
			assert.deepEqual(channel('v1.2.3-dirty'), { channel: 'none' })
			assert.deepEqual(channel('v1.2.3-14-gabc1234-dirty'), { channel: 'none' })
		})
	})

	describe('isNewerThan', () => {
		it('compares release triplets numerically', () => {
			assert.equal(isNewer('v0.4.0', 'v0.3.0'), true)
			assert.equal(isNewer('v0.3.0', 'v0.3.0'), false)
			assert.equal(isNewer('v0.2.9', 'v0.3.0'), false)
			assert.equal(isNewer('v0.10.0', 'v0.9.0'), true)
			assert.equal(isNewer('v1.0.0', 'v0.99.99'), true)
		})

		it('ranks the stable above its own pre-releases', () => {
			assert.equal(isNewer('v1.0.0', 'v1.0.0-rc.1'), true)
			assert.equal(isNewer('v1.0.0-rc.1', 'v1.0.0'), false)
			assert.equal(isNewer('v1.0.1', 'v1.0.0-rc.1'), true)
		})

		it('never ranks pre-release identifiers among themselves', () => {
			assert.equal(isNewer('v1.0.0-rc.2', 'v1.0.0-rc.1'), false)
		})
	})
})
