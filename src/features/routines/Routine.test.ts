import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Routine } from './Routine.js'

describe('Routine', () => {
	it('tells an entry by its heading in lower case, without the space around it, in any script, and by none when blank', () => {
		assert.equal(Routine.titleOf('  Gym '), 'gym')
		assert.equal(Routine.titleOf('ÜBUNG'), Routine.titleOf('Übung'))
		assert.equal(Routine.titleOf('   '), undefined)
		assert.equal(Routine.titleOf(undefined), undefined)
	})
})
