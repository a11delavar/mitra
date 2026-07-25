import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SyncPacer, type Paceable } from './SyncPacer.js'

/** A pacer whose presence is the given set of online user ids. */
const pacerWith = (...onlineUserIds: Array<string>) => {
	const online = new Set(onlineUserIds)
	return new SyncPacer({ isOnline: userId => online.has(userId) })
}

const integration = (init?: Partial<Paceable>): Paceable =>
	({ id: 'integration-1', userId: 'user-1', syncInterval: 0, ...init })

describe('SyncPacer.shouldSync', () => {
	it('lets a never-attempted integration sync immediately, watched or not', () => {
		assert.equal(pacerWith('user-1').shouldSync(integration()), true)
		assert.equal(pacerWith().shouldSync(integration()), true)
	})

	it('paces a watched integration at the active interval', () => {
		const pacer = pacerWith('user-1')
		const it1 = integration()
		pacer.recordSuccess(it1, 0)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.activeInterval - 1 }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.activeInterval }), true)
	})

	it('paces an unwatched integration at the idle interval', () => {
		const pacer = pacerWith()
		const it1 = integration()
		pacer.recordSuccess(it1, 0)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.activeInterval }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.idleInterval - 1 }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.idleInterval }), true)
	})

	it('judges presence per owner — one user watching does not speed up another\'s integrations', () => {
		const pacer = pacerWith('user-1')
		const watched = integration({ id: 'a', userId: 'user-1' })
		const unwatched = integration({ id: 'b', userId: 'user-2' })
		pacer.recordSuccess(watched, 0)
		pacer.recordSuccess(unwatched, 0)
		assert.equal(pacer.shouldSync(watched, { now: SyncPacer.activeInterval }), true)
		assert.equal(pacer.shouldSync(unwatched, { now: SyncPacer.activeInterval }), false)
	})

	it('honors a provider\'s own syncInterval over the active cadence', () => {
		const pacer = pacerWith('user-1')
		const google = integration({ syncInterval: 60_000 })
		pacer.recordSuccess(google, 0)
		assert.equal(pacer.shouldSync(google, { now: SyncPacer.activeInterval }), false)
		assert.equal(pacer.shouldSync(google, { now: 60_000 }), true)
	})

	it('rests a failed integration for the retry interval even while watched', () => {
		const pacer = pacerWith('user-1')
		const it1 = integration()
		pacer.recordFailure(it1, 0)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.activeInterval }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.retryInterval - 1 }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.retryInterval }), true)
	})

	it('rests an unwatched failed integration for the larger idle interval', () => {
		const pacer = pacerWith()
		const it1 = integration()
		pacer.recordFailure(it1, 0)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.retryInterval }), false)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.idleInterval }), true)
	})

	it('lifts the failure rest again after a success', () => {
		const pacer = pacerWith('user-1')
		const it1 = integration()
		pacer.recordFailure(it1, 0)
		pacer.recordSuccess(it1, SyncPacer.retryInterval)
		assert.equal(pacer.shouldSync(it1, { now: SyncPacer.retryInterval + SyncPacer.activeInterval }), true)
	})

	it('never polls a local-only integration (syncInterval Infinity)', () => {
		const pacer = pacerWith('user-1')
		assert.equal(pacer.shouldSync(integration({ syncInterval: Infinity })), false)
	})
})

describe('SyncPacer.recordFailure', () => {
	it('reports the effective rest for the log line', () => {
		assert.equal(pacerWith('user-1').recordFailure(integration(), 0), SyncPacer.retryInterval)
		assert.equal(pacerWith('user-1').recordFailure(integration({ syncInterval: 90_000 }), 0), 90_000)
		assert.equal(pacerWith().recordFailure(integration(), 0), SyncPacer.idleInterval)
	})
})

describe('SyncPacer.prune', () => {
	it('drops state for ids no longer live, so a re-created id starts fresh', () => {
		const pacer = pacerWith()
		const gone = integration({ id: 'gone' })
		const kept = integration({ id: 'kept' })
		pacer.recordSuccess(gone, 0)
		pacer.recordSuccess(kept, 0)
		pacer.prune(new Set(['kept']))
		assert.equal(pacer.shouldSync(gone, { now: 1 }), true) // fresh again — no recorded attempt
		assert.equal(pacer.shouldSync(kept, { now: 1 }), false)
	})
})
