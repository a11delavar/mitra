import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { DissolveRoutine } from './DissolveRoutine.js'
import { ListRoutines } from './ListRoutines.js'
import { dailyRoutine, routine, routineOf } from './RoutineCorrections.testing.js'

describe('DissolveRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('leaves the list, keeping its entries, and takes in what later wears its title, out of sight too', async () => {
		const lunch = await dailyRoutine(server, 'Lunch walk')
		await DissolveRoutine.call({ id: lunch.routineId })
		assert.equal((await routine(server, lunch.routineId))!.dissolved, 1)
		assert.equal(await routineOf(server, lunch.id), lunch.routineId)
		assert.equal((await dailyRoutine(server, 'Lunch walk')).routineId, lunch.routineId)
		assert.ok(!(await ListRoutines.call()).some(each => each.id === lunch.routineId))
	})
})
