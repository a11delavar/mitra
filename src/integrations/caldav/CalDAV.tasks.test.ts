import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from './CalDAV.js'
import { TaskStatus } from '../../features/entries/Entry.js'

describe('percentCompleteForICal', () => {
	it('round-trips an authored percentage instead of deriving one from the status', () => {
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.ToDo, 40), 40)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Doing, 40), 40)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Cancelled, 40), 40)
	})

	it('pins a completed task to 100 whatever it says', () => {
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Done, 40), 100)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Done, null), 100)
	})

	it('answers undefined for an unstated percentage, and clamps a stated one', () => {
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.ToDo, null), undefined)
		assert.equal(CalDAV.percentCompleteForICal(undefined, undefined), undefined)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Doing, -20), 0)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Doing, 250), 100)
		assert.equal(CalDAV.percentCompleteForICal(TaskStatus.Doing, 33.6), 34)
	})
})
