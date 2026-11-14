import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListRoutines } from './ListRoutines.js'
import { RenameRoutine } from './RenameRoutine.js'
import { dailyRoutine, routine } from './RoutineCorrections.testing.js'

describe('RenameRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names a routine, and a blank name names it after its entries again', async () => {
		const { routineId } = await dailyRoutine(server, 'Pills')
		await RenameRoutine.call({ id: routineId, name: ' Medication ' })
		assert.equal((await routine(server, routineId))!.name, 'Medication')
		await RenameRoutine.call({ id: routineId, name: ' ' })
		assert.equal((await routine(server, routineId))!.name, null)
		assert.equal((await ListRoutines.call({ last: 1 })).find(each => each.id === routineId)!.label, 'Pills')
	})

	it('takes its entries\' title typed back as no name of its own, so it follows them again', async () => {
		const { routineId } = await dailyRoutine(server, 'Stretch')
		await RenameRoutine.call({ id: routineId, name: 'Mobility' })
		await RenameRoutine.call({ id: routineId, name: 'Stretch ' })
		assert.equal((await routine(server, routineId))!.name, null)
	})

	it('finds no routine of another user', async () => {
		await assert.rejects(RenameRoutine.call({ id: 'elsewhere', name: 'Mine' }), (error: { status?: number }) => error.status === 404)
	})
})
