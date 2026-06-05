import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import { Source, SourceType } from './Source.js'

describe('Source', () => {
	describe('collectionUri', () => {
		test('ensures a trailing slash', () => {
			const source = new Source({ uri: 'https://example.com/cal', type: SourceType.Event })
			assert.strictEqual(source.collectionUri, 'https://example.com/cal/')
		})

		test('preserves an existing trailing slash', () => {
			const source = new Source({ uri: 'https://example.com/cal/', type: SourceType.Event })
			assert.strictEqual(source.collectionUri, 'https://example.com/cal/')
		})
	})

	describe('normalizeUri', () => {
		test('resolves relative path against collectionUri', () => {
			const source = new Source({ uri: 'https://example.com/cal', type: SourceType.Event })
			assert.strictEqual(
				source.normalizeUri('/cal/123.ics'),
				'https://example.com/cal/123.ics'
			)
		})

		test('returns absolute url unchanged', () => {
			const source = new Source({ uri: 'https://example.com/cal', type: SourceType.Event })
			assert.strictEqual(
				source.normalizeUri('https://example.com/cal/123.ics'),
				'https://example.com/cal/123.ics'
			)
		})

		test('handles null or undefined gracefully', () => {
			const source = new Source({ uri: 'https://example.com/cal', type: SourceType.Event })
			assert.strictEqual(source.normalizeUri(null), '')
			assert.strictEqual(source.normalizeUri(undefined), '')
		})
	})

	describe('matchesUri', () => {
		test('matches an absolute url with its relative equivalent', () => {
			const source = new Source({ uri: 'https://example.com/123/calendars/xyz/', type: SourceType.Event })
			assert.strictEqual(
				source.matchesUri(
					'https://example.com/123/calendars/xyz/abc.ics',
					'/123/calendars/xyz/abc.ics'
				),
				true
			)
		})

		test('fails to match different urls', () => {
			const source = new Source({ uri: 'https://example.com/cal/', type: SourceType.Event })
			assert.strictEqual(
				source.matchesUri(
					'https://example.com/cal/123.ics',
					'https://example.com/cal/456.ics'
				),
				false
			)
		})
	})
})
