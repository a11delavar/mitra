import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cacheControlOf } from './caching.js'

describe('cacheControlOf', () => {
	it('keeps content-named chunks forever, compressed or not', () => {
		assert.equal(cacheControlOf('/app/dist/chunk-G5TDAYEW.js'), 'public, max-age=31536000, immutable')
		assert.equal(cacheControlOf('/app/dist/chunk-G5TDAYEW.js.br'), 'public, max-age=31536000, immutable')
		assert.equal(cacheControlOf('/app/dist/inter-latin-wght-normal-ABCD1234.woff2'), 'public, max-age=31536000, immutable')
	})

	it('has the browser ask again for the shell and every file named the same across builds', () => {
		assert.equal(cacheControlOf('/app/dist/index.js'), 'no-cache')
		assert.equal(cacheControlOf('/app/dist/index.js.gz'), 'no-cache')
		assert.equal(cacheControlOf('/app/dist/index.html'), 'no-cache')
		assert.equal(cacheControlOf('/app/dist/releases/0.6/README.md'), 'no-cache')
		assert.equal(cacheControlOf('/app/dist/releases/0.6/table-detail-light.webp'), 'no-cache')
	})
})
