import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Source, SourceType } from './Source.js'

describe('Source.keyOf', () => {
	it('matches the instance getter', () => {
		const source = new Source({ uri: 'https://dav/cal/', type: SourceType.Event, name: 'X' })
		assert.equal(Source.keyOf(source), source.key)
		assert.equal(source.key, 'event#https://dav/cal/')
	})

	// The enable-on-save bug: `@a11d/api` structure-clones request bodies, so incoming sources reach the
	// backend as plain objects with no `key` getter. `applyAndSync` keys them via `keyOf`, which must
	// produce the SAME key as the managed row's getter — otherwise nothing matches and all sources disable.
	it('keys a structure-cloned plain object identically to the managed instance', () => {
		const managed = new Source({ uri: 'https://dav/cal/', type: SourceType.Event, name: 'X', enabled: true })
		const wireClone = structuredClone(managed) // loses the class, the getter, everything but data
		assert.equal((wireClone as { key?: string }).key, undefined) // the getter is gone — this was the trap
		assert.equal(Source.keyOf(wireClone), managed.key) // …but keyOf still lines them up
	})
})
