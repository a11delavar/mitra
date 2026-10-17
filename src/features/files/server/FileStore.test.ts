import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { FileTooLargeError, FileStore } from './FileStore.js'
import { FileLimits } from './FileLimits.js'

describe('FileStore', () => {
	let root: string
	let store: FileStore

	before(async () => {
		root = await mkdtemp(path.join(tmpdir(), 'mitra-files-'))
		store = new FileStore(root)
	})

	after(() => rm(root, { recursive: true, force: true }))

	const bytes = (content: string) => Readable.from([Buffer.from(content)])

	it('hashes and stores the bytes under the user, never under the uploaded name', async () => {
		const stored = await store.put('user-1', bytes('hello'), 1024)
		assert.equal(stored.size, 5)
		assert.equal(stored.sha256, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
		assert.equal(await store.exists('user-1', stored.sha256), true)
		assert.deepEqual(await readdir(path.join(root, 'user-1')), ['.tmp', stored.sha256])
	})

	it('deduplicates identical bytes rather than failing the second write', async () => {
		const first = await store.put('user-1', bytes('same'), 1024)
		const second = await store.put('user-1', bytes('same'), 1024)
		assert.equal(first.sha256, second.sha256)
		assert.equal(await store.sizeOf('user-1', second.sha256), 4)
	})

	it('keeps users apart even for identical content', async () => {
		const stored = await store.put('user-2', bytes('hello'), 1024)
		assert.equal(await store.exists('user-2', stored.sha256), true)
		await store.deleteUser('user-2')
		assert.equal(await store.exists('user-2', stored.sha256), false)
		assert.equal(await store.exists('user-1', stored.sha256), true)
	})

	it('aborts past the limit and leaves nothing behind', async () => {
		await assert.rejects(() => store.put('user-3', bytes('far too long'), 4), FileTooLargeError)
		assert.deepEqual((await readdir(path.join(root, 'user-3', '.tmp'))), [])
	})

	it('reads a byte range', async () => {
		const stored = await store.put('user-4', bytes('0123456789'), 1024)
		const chunks: Array<Buffer> = []
		for await (const chunk of store.read('user-4', stored.sha256, { start: 2, end: 4 })) {
			chunks.push(chunk as Buffer)
		}
		assert.equal(Buffer.concat(chunks).toString(), '234')
	})
})

describe('FileLimits', () => {
	it('reads byte sizes with the suffixes the docs advertise', () => {
		assert.equal(FileLimits.bytesOf('25M'), 25 * 1024 * 1024)
		assert.equal(FileLimits.bytesOf('512k'), 512 * 1024)
		assert.equal(FileLimits.bytesOf('1G'), 1024 ** 3)
		assert.equal(FileLimits.bytesOf('2048'), 2048)
		assert.equal(FileLimits.bytesOf('nonsense'), undefined)
		assert.equal(FileLimits.bytesOf(undefined), undefined)
	})

	it('defaults to 25 MB and no quota', () => {
		assert.deepEqual(FileLimits.fromEnv({}).toJSON(), { maxSize: 25 * 1024 * 1024 })
		assert.deepEqual(FileLimits.fromEnv({ MITRA_FILE_MAX_SIZE: '2M', MITRA_FILE_QUOTA: '20M' }).toJSON(), { maxSize: 2 * 1024 * 1024, quota: 20 * 1024 * 1024 })
	})

	it('takes no uploads on a public demo, whatever the size limit says', () => {
		const demo = FileLimits.fromEnv({ MITRA_DEMO: 'true', MITRA_FILE_MAX_SIZE: '2M' })
		assert.equal(demo.maxSize, 0)
		assert.equal(demo.uploads, false)
	})

	it('allows more until the quota is reached, and always without one', () => {
		assert.equal(new FileLimits(10, 100).allowsMore(99), true)
		assert.equal(new FileLimits(10, 100).allowsMore(100), false)
		assert.equal(new FileLimits(10).allowsMore(Number.MAX_SAFE_INTEGER), true)
	})
})
