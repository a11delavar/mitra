import { type EntityClass } from '@mikro-orm/core'
import { type MikroORM } from '@mikro-orm/sqlite'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { type File } from '../File.js'
import { fileStore, type FileStore } from './FileStore.js'

const logger = createLogger('Files')

/**
 * Deletes the bytes no row of any file table refers to any more. The grace period lets an upload sit on an unsaved draft, and
 * gives an accidental removal a window to be undone; deleting what carried a file never touches its bytes, this pass notices.
 */
export class UnusedFileDisposer {
	static readonly graceMs = 24 * 60 * 60 * 1000
	static readonly intervalMs = 60 * 60 * 1000

	private timer?: ReturnType<typeof setInterval>

	constructor(private readonly orm: MikroORM, private readonly tables: ReadonlyArray<EntityClass<File>>, private readonly store: FileStore = fileStore) { }

	start() {
		void this.dispose()
		this.timer = setInterval(() => void this.dispose(), UnusedFileDisposer.intervalMs)
		this.timer.unref?.()
	}

	stop() {
		clearInterval(this.timer)
	}

	/** @returns how many files went. */
	async dispose(now = Date.now()): Promise<number> {
		const em = this.orm.em.fork()
		let disposed = 0
		for (const userId of await this.store.users()) {
			const held = new Set<string>()
			for (const table of this.tables) {
				const rows = await em.find<File>(table, { userId, sha256: { $ne: null } })
				rows.forEach(row => held.add(row.sha256!))
			}
			for (const stored of await this.store.list(userId)) {
				if (!held.has(stored.sha256) && stored.modifiedAt < now - UnusedFileDisposer.graceMs) {
					await this.store.delete(userId, stored.sha256)
					disposed++
				}
			}
		}
		if (disposed) {
			logger.debug(`Disposed of ${disposed} unused file(s)`)
		}
		return disposed
	}
}
