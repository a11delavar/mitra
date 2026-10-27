import type { Environment } from '#infrastructure/server/Environment.js'

/** How much an instance takes: the largest file, and each account's total of the files it holds. */
export class FileLimits {
	static readonly defaultMaxSize = 25 * 1024 * 1024

	/** A public demo takes no uploads: its unauthenticated file URLs would make it a free anonymous file host. */
	static of(environment: Environment) {
		return new FileLimits(environment.demo ? 0 : environment.files.maxSize ?? FileLimits.defaultMaxSize, environment.files.quota)
	}

	constructor(readonly maxSize: number, readonly quota?: number) { }

	/** None at all where the largest file is empty. */
	get uploads() {
		return this.maxSize > 0
	}

	/** Whether an account holding `stored` bytes may store more. */
	allowsMore(stored: number) {
		return this.quota === undefined || stored < this.quota
	}

	toJSON() {
		return { maxSize: this.maxSize, ...this.quota === undefined ? {} : { quota: this.quota } }
	}
}
