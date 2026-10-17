/** How much an instance takes: the largest file, and each account's total of the files it holds. */
export class FileLimits {
	static readonly defaultMaxSize = 25 * 1024 * 1024

	/** A public demo takes no uploads: its unauthenticated file URLs would make it a free anonymous file host. */
	static fromEnv(env: NodeJS.ProcessEnv = process.env) {
		return new FileLimits(
			env.MITRA_DEMO === 'true' ? 0 : FileLimits.bytesOf(env.MITRA_FILE_MAX_SIZE) ?? FileLimits.defaultMaxSize,
			FileLimits.bytesOf(env.MITRA_FILE_QUOTA),
		)
	}

	/** A byte count, or one with a `k`/`M`/`G` suffix, as the docs advertise. */
	static bytesOf(value: string | undefined): number | undefined {
		const match = /^(\d+(?:\.\d+)?)\s*([kmg])?b?$/i.exec(value?.trim() ?? '')
		if (!match) {
			return undefined
		}
		const scale = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[match[2]?.toLowerCase() ?? ''] ?? 1
		return Math.round(Number(match[1]) * scale)
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
