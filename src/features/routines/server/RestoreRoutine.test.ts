import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { DissolveRoutine } from './DissolveRoutine.js'
import { ListDissolvedRoutines } from './ListDissolvedRoutines.js'
import { ListRoutines } from './ListRoutines.js'
import { RestoreRoutine } from './RestoreRoutine.js'
import { dailyRoutine, routine, routineOf } from './RoutineCorrections.testing.js'

describe('RestoreRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists a dissolved routine apart, named after its entries, and makes it a routine again with them', async () => {
		const walk = await dailyRoutine(server, 'Evening walk')
		await DissolveRoutine.call({ id: walk.routineId })
		assert.deepEqual((await ListDissolvedRoutines.call()).filter(each => each.id === walk.routineId).map(each => each.label), ['Evening walk'])
		await RestoreRoutine.call({ id: walk.routineId })
		assert.equal((await routine(server, walk.routineId))!.dissolved, null)
		assert.equal(await routineOf(server, walk.id), walk.routineId)
		assert.ok((await ListRoutines.call()).some(each => each.id === walk.routineId))
		assert.ok(!(await ListDissolvedRoutines.call()).some(each => each.id === walk.routineId))
	})

	it('restores only a dissolved routine', async () => {
		const { routineId } = await dailyRoutine(server, 'Reading')
		await assert.rejects(RestoreRoutine.call({ id: routineId }), (error: { status?: number }) => error.status === 404)
	})
})
