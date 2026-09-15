import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { subscribeUrlOf } from './launch.js'

describe('OS launch parameters', () => {
	it('extracts the address a protocol launch encoded into the handler URL', () => {
		assert.equal(
			subscribeUrlOf('https://mitra.example.com/?subscribe=webcal%3A%2F%2Fexample.com%2Fteam.ics'),
			'webcal://example.com/team.ics',
		)
	})

	it('yields nothing for launches without a subscription address', () => {
		assert.equal(subscribeUrlOf('https://mitra.example.com/'), undefined)
		assert.equal(subscribeUrlOf('https://mitra.example.com/?subscribe='), undefined)
		assert.equal(subscribeUrlOf('not a url'), undefined)
	})
})
