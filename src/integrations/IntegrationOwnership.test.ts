import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IntegrationOwnership } from './IntegrationOwnership.js'

describe('IntegrationOwnership', () => {
	it('holds nothing it does not declare', () => {
		assert.deepEqual([new IntegrationOwnership().holds('due'), new IntegrationOwnership().ownerOf('due')], [false, undefined])
	})

	it('tells who owns each field it holds', () => {
		const ownership = new IntegrationOwnership({ description: 'upstream', due: 'upstream', rank: 'mitra' })
		assert.deepEqual([ownership.holds('due'), ownership.ownerOf('due'), ownership.ownerOf('rank')], [true, 'upstream', 'mitra'])
		assert.deepEqual(ownership.ownedBy('upstream'), ['description', 'due'])
		assert.deepEqual(ownership.ownedBy('mitra'), ['rank'])
	})

	it('drops fields without changing what it derives from', () => {
		const base = new IntegrationOwnership({ due: 'upstream', relations: 'upstream', rank: 'mitra' })
		const derived = base.without('relations')
		assert.deepEqual([derived.holds('relations'), derived.ownerOf('due')], [false, 'upstream'])
		assert.equal(base.holds('relations'), true)
	})
})
