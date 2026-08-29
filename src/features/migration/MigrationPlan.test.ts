import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'
import { MigrationOutcome, MigrationPlan, MigrationVerdict } from './MigrationPlan.js'

const clean = () => new MigrationVerdict({ entryId: 'a', heading: 'Clean' })
const lossy = (...losses: Array<'reminders' | 'location'>) => new MigrationVerdict({ entryId: 'b', heading: 'Lossy', losses })
const blocked = (blocker: 'participants' | 'recurrence', occurrences: number | null = null) =>
	new MigrationVerdict({ entryId: 'c', heading: 'Blocked', blockers: [blocker], occurrences })

describe('MigrationVerdict', () => {
	it('is clean only with nothing to report', () => {
		assert.equal(clean().clean, true)
		assert.equal(lossy('reminders').clean, false)
		assert.equal(blocked('participants').clean, false)
	})

	it('is flattenable only when recurrence is the blocker AND the rule expanded', () => {
		assert.equal(blocked('recurrence', 12).flattenable, true)
		assert.equal(blocked('recurrence', null).flattenable, false)
		assert.equal(blocked('participants', 12).flattenable, false)
	})

	it('lifts the recurrence blocker under flattening, and nothing else', () => {
		assert.equal(blocked('recurrence', 3).moves(false), false)
		assert.equal(blocked('recurrence', 3).moves(true), true)
		assert.equal(blocked('participants').moves(true), false)
	})

	it('counts a flattened series as the entries it becomes, and everything else as one', () => {
		assert.equal(blocked('recurrence', 3).creations(true), 3)
		assert.equal(blocked('recurrence', 3).creations(false), 0)
		assert.equal(clean().creations(false), 1)
	})
})

describe('MigrationPlan', () => {
	const plan = () => new MigrationPlan({ total: 10, verdicts: [lossy('reminders'), lossy('reminders', 'location'), blocked('recurrence', 4)] })

	it('reads the clean entries as the remainder — they are never listed', () => {
		assert.equal(plan().cleanCount, 7)
	})

	it('counts what LEAVES, however many entries a flattened series becomes over there', () => {
		assert.equal(plan().movingCount(false), 9)
		assert.equal(plan().movingCount(true), 10)
		assert.equal(plan().creations(false), 9)
		assert.equal(plan().creations(true), 13)
	})

	it('tallies each loss and each remaining reason, most-common first', () => {
		assert.deepEqual(plan().losses, [['reminders', 2], ['location', 1]])
		assert.deepEqual(plan().blockers(false), [['recurrence', 1]])
		assert.deepEqual(plan().blockers(true), [])
	})
})

describe('the wire', () => {
	it('revives a plan into its class, verdicts included', () => {
		const revived = revive<MigrationPlan>(wireOf(new MigrationPlan({ total: 2, verdicts: [blocked('recurrence', 4)] })))
		assert.ok(revived instanceof MigrationPlan)
		assert.ok(revived.verdicts[0] instanceof MigrationVerdict)
		assert.equal(revived.movingCount(true), 2)
	})

	it('revives an outcome into its class', () => {
		const revived = revive<MigrationOutcome>(wireOf(new MigrationOutcome({ moved: 3, failure: 'the provider said no' })))
		assert.ok(revived instanceof MigrationOutcome)
		assert.equal(revived.aborted, true)
		assert.equal(revive<MigrationOutcome>(wireOf(new MigrationOutcome({ moved: 3 }))).aborted, false)
	})
})
