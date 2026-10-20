import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, unlink, utimes } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Transform, type Readable } from 'node:stream'
import path from 'node:path'
import { ValidationError } from '#infrastructure/validation'
import { File } from '../File.js'

/** Thrown when an upload runs past the configured ceiling; the route answers 413. */
export class FileTooLargeError extends Error {
	readonly status = 413
	constructor(readonly limit: number) {
		super(`The file exceeds the ${limit} byte limit`)
	}
}

export interface StoredBytes {
	sha256: string
	size: number
}

/** The bytes of the files Mitra holds, inside the one data folder the backup guide promises, named by content hash under a per-user folder, never by the uploaded name. */
export class FileStore {
	/** Mirrors the way `orm.ts` resolves the database: relative to the bundled server module. */
	static readonly defaultRoot = path.resolve(import.meta.dirname, '../../data/files')

	constructor(readonly root: string = FileStore.defaultRoot) { }

	private directoryFor(userId: string) {
		return path.join(this.root, userId)
	}

	pathFor(userId: string, sha256: string) {
		return path.join(this.directoryFor(userId), sha256)
	}

	/** Streams an upload to disk, hashing as it goes, and renames it onto its hash; the same bytes already there count as success. */
	async put(userId: string, source: Readable, limit: number): Promise<StoredBytes> {
		const directory = this.directoryFor(userId)
		const staging = path.join(directory, '.tmp')
		await mkdir(staging, { recursive: true })
		const temporary = path.join(staging, randomUUID())
		const hash = createHash('sha256')
		let size = 0
		const meter = new Transform({
			transform(chunk, _encoding, callback) {
				size += chunk.length
				if (size > limit) {
					callback(new FileTooLargeError(limit))
					return
				}
				hash.update(chunk)
				callback(null, chunk)
			},
		})
		try {
			await pipeline(source, meter, createWriteStream(temporary))
		} catch (error) {
			await unlink(temporary).catch(() => void 0)
			throw error
		}
		const sha256 = hash.digest('hex')
		const destination = this.pathFor(userId, sha256)
		try {
			await rename(temporary, destination)
		} catch (error) {
			await unlink(temporary).catch(() => void 0)
			if (!await this.exists(userId, sha256)) {
				throw error
			}
			// Uploaded again, so as fresh as a new upload: the disposer's grace counts from the modification time.
			const now = new Date()
			await utimes(destination, now, now)
		}
		return { sha256, size }
	}

	/**
	 * Takes the files a user's request gives as theirs, before they are saved. Ids and bytes never come from the request: a file referring
	 * to a row already `held` is resolved to it, any other takes a fresh id; one of Mitra's own must be bytes this user uploaded, and is then theirs.
	 * @returns what it refused
	 */
	async claim(userId: string, files: Iterable<File>, held: Iterable<File> = []): Promise<Array<ValidationError>> {
		const rows = [...held]
		const refused = new Array<ValidationError>()
		for (const file of files) {
			const row = rows.find(each => file.refersTo(each))
			if (row) {
				file.resolve(row)
				continue
			}
			file.id = File.mintId()
			if (file.sourceUrl) {
				continue
			}
			if (file.sha256 && await this.exists(userId, file.sha256)) {
				file.userId = userId
			} else {
				refused.push(new ValidationError(`${file.displayName} was never uploaded`, ['files']))
			}
		}
		return refused
	}

	exists(userId: string, sha256: string): Promise<boolean> {
		return stat(this.pathFor(userId, sha256)).then(() => true, () => false)
	}

	/** The users holding files. */
	async users(): Promise<Array<string>> {
		const entries = await readdir(this.root, { withFileTypes: true }).catch(() => [])
		return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
	}

	/** A user's files by hash, with their size and when each was last written. */
	async list(userId: string): Promise<Array<{ sha256: string, size: number, modifiedAt: number }>> {
		const names = await readdir(this.directoryFor(userId)).catch(() => [])
		const files = await Promise.all(names.filter(name => /^[0-9a-f]{64}$/.test(name)).map(async sha256 => {
			const stats = await stat(this.pathFor(userId, sha256)).catch(() => undefined)
			return !stats ? undefined : { sha256, size: stats.size, modifiedAt: stats.mtimeMs }
		}))
		return files.filter(file => file !== undefined)
	}

	/** The bytes a user holds, each file once however many entries carry it. */
	async usageOf(userId: string): Promise<number> {
		return (await this.list(userId)).reduce((total, file) => total + file.size, 0)
	}

	sizeOf(userId: string, sha256: string): Promise<number | undefined> {
		return stat(this.pathFor(userId, sha256)).then(stats => stats.size, () => undefined)
	}

	read(userId: string, sha256: string, range?: { start: number, end: number }) {
		return createReadStream(this.pathFor(userId, sha256), range)
	}

	async delete(userId: string, sha256: string): Promise<void> {
		await unlink(this.pathFor(userId, sha256)).catch(() => void 0)
	}

	/** Drops a whole user's files. */
	async deleteUser(userId: string): Promise<void> {
		await rm(this.directoryFor(userId), { recursive: true, force: true })
	}
}

export const fileStore = new FileStore()
