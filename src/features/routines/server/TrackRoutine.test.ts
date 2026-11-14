import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListRoutines } from './ListRoutines.js'
import { TrackRoutine } from './TrackRoutine.js'
import { dailyRoutine, routine } from './RoutineCorrections.testing.js'

describe('TrackRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('tracks every routine at first, stops for one that is only a schedule, and tracks it again', async () => {
		const { routineId } = await dailyRoutine(server, 'Standup')
		const listed = async () => (await ListRoutines.call({ last: 1 })).find(each => each.id === routineId)!
		assert.equal((await listed()).tracked, true)
		await TrackRoutine.call({ id: routineId, tracked: false })
		assert.equal((await routine(server, routineId))!.untracked, 1)
		assert.equal((await listed()).tracked, false)
		await TrackRoutine.call({ id: routineId, tracked: true })
		assert.equal((await routine(server, routineId))!.untracked, null)
	})

	it('finds no routine of another user', async () => {
		await assert.rejects(TrackRoutine.call({ id: 'elsewhere', tracked: false }), (error: { status?: number }) => error.status === 404)
	})
})
