import { type createLogger } from '#infrastructure/logging/Logger.js'

interface Schedule {
	/** How long between runs. */
	readonly every: number
	/** How long after starting the first run goes; at once by default. */
	readonly after?: number
}

/**
 * Work the server does on its own, `every` so often: one run at a time, a tick due while one is going or waiting skipped, a
 * run asked for in between queued after it, a failure logged rather than thrown, and the process free to exit around it.
 */
export class BackgroundJob {
	private queue = Promise.resolve()
	private pending = 0
	private timers = new Array<ReturnType<typeof setTimeout>>()

	constructor(private readonly logger: ReturnType<typeof createLogger>, private readonly schedule: Schedule, private readonly work: () => Promise<unknown>) { }

	start() {
		const tick = () => {
			if (!this.pending) {
				void this.run()
			}
		}
		const begin = () => {
			tick()
			this.timers.push(setInterval(tick, this.schedule.every))
			this.timers.at(-1)!.unref?.()
		}
		if (this.schedule.after) {
			this.timers.push(setTimeout(begin, this.schedule.after))
			this.timers.at(-1)!.unref?.()
		} else {
			begin()
		}
	}

	stop() {
		this.timers.forEach(timer => clearTimeout(timer))
		this.timers = []
	}

	/** Runs `work`, its own by default, once whatever runs now is done; settles when it is, a failure logged. */
	run(work = this.work) {
		this.pending++
		const run = this.queue.then(work).finally(() => this.pending--)
		this.queue = run.then(() => undefined, (error: unknown) => this.logger.error('Failed:', error))
		return this.queue
	}
}
