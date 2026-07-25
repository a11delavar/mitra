import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Presence } from './presence.js'

describe('Presence', () => {
	it('reports a user online while at least one client is connected', () => {
		const presence = new Presence()
		assert.equal(presence.isOnline('user-1'), false)
		const disconnect1 = presence.connect('user-1')
		const disconnect2 = presence.connect('user-1')
		assert.equal(presence.isOnline('user-1'), true)
		disconnect1()
		assert.equal(presence.isOnline('user-1'), true) // the second client still is
		disconnect2()
		assert.equal(presence.isOnline('user-1'), false)
	})

	it('tracks users independently', () => {
		const presence = new Presence()
		presence.connect('user-1')
		assert.equal(presence.isOnline('user-1'), true)
		assert.equal(presence.isOnline('user-2'), false)
	})

	it('announces only the zero-to-one transition', () => {
		const presence = new Presence()
		const online: Array<string> = []
		presence.onOnline(userId => online.push(userId))
		const disconnect1 = presence.connect('user-1')
		presence.connect('user-1') // second client — already online, no announcement
		disconnect1()
		assert.deepEqual(online, ['user-1'])
	})

	it('announces offline only when the LAST client disconnects', () => {
		const presence = new Presence()
		const offline: Array<string> = []
		presence.onOffline(userId => offline.push(userId))
		const disconnect1 = presence.connect('user-1')
		const disconnect2 = presence.connect('user-1')
		disconnect1()
		assert.deepEqual(offline, []) // one client still connected
		disconnect2()
		assert.deepEqual(offline, ['user-1'])
	})

	it('announces again after everyone disconnected — a page reload comes back online', () => {
		const presence = new Presence()
		const online: Array<string> = []
		presence.onOnline(userId => online.push(userId))
		const disconnect = presence.connect('user-1')
		disconnect()
		presence.connect('user-1')
		assert.deepEqual(online, ['user-1', 'user-1'])
	})

	it('tolerates a double-fired disconnect without corrupting a newer connection\'s count', () => {
		const presence = new Presence()
		const disconnect1 = presence.connect('user-1')
		disconnect1()
		presence.connect('user-1')
		disconnect1() // stale teardown fires again — must not count the new client down
		assert.equal(presence.isOnline('user-1'), true)
	})
})
