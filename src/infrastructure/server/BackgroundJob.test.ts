import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { BackgroundJob } from './BackgroundJob.js'

describe('BackgroundJob', () => {
	const logger = createLogger('Test')

	it('runs one at a time, a run asked for in between after the one going', async () => {
		const order = new Array<string>()
		let release!: () => void
		const job = new BackgroundJob(logger, { every: 60_000 }, () => new Promise<void>(resolve => {
			order.push('own')
			release = resolve
		}))
		const first = job.run()
		const second = job.run(() => Promise.resolve(void order.push('asked')))
		await new Promise(resolve => setTimeout(resolve, 0))
		assert.deepEqual(order, ['own'])
		release()
		await Promise.all([first, second])
		assert.deepEqual(order, ['own', 'asked'])
	})

	it('logs a failure rather than throwing it, and runs again after', async () => {
		const failures = new Array<unknown>()
		const job = new BackgroundJob({ error: (_: string, error: unknown) => failures.push(error) } as unknown as typeof logger, { every: 60_000 }, () => Promise.reject(new Error('provider down')))
		await job.run()
		let ran = false
		await job.run(() => Promise.resolve(void (ran = true)))
		assert.deepEqual(failures.map(error => (error as Error).message), ['provider down'])
		assert.equal(ran, true)
	})
})
