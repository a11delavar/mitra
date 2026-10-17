import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, type EntityManager } from '@mikro-orm/sqlite'
import { mkdtemp, rm, utimes } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { User } from '../../identity/User.js'
import { Source } from '../../sources/Source.js'
import { Integration } from '../../../integrations/Integration.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { EntryType } from '../../entries/EntryType.js'
import { Entry } from '../../entries/Entry.js'
import { EntryFile } from '../../entries/EntryFile.js'
import { EntryFiles } from '../../entries/EntryFiles.js'
import { UnusedFileDisposer } from './UnusedFileDisposer.js'
import { FileStore } from './FileStore.js'
import { ormConfig } from '../../../infrastructure/database/ormConfig.js'
import { migrate } from '../../../infrastructure/database/migrations/migrate.js'

/** The real config, its schema built by the shipped migrations, so saving and the disposer meet the tables as migrated. */
async function inMemoryOrm() {
	const orm = await MikroORM.init({ ...ormConfig(':memory:'), allowGlobalContext: true })
	await migrate(orm)
	return orm
}

describe('files on entries', () => {
	let orm: MikroORM
	let em: EntityManager
	let root: string
	let store: FileStore
	let disposer: UnusedFileDisposer
	let user: User
	let source: Source

	const old = new Date(Date.now() - UnusedFileDisposer.graceMs - 1000)
	const link = 'https://cloud.example.com/f/42'

	before(async () => {
		root = await mkdtemp(path.join(tmpdir(), 'mitra-disposer-'))
		store = new FileStore(root)
		orm = await inMemoryOrm()
		disposer = new UnusedFileDisposer(orm, [EntryFile], store)
	})

	after(async () => {
		await orm.close(true)
		await rm(root, { recursive: true, force: true })
	})

	beforeEach(async () => {
		em = orm.em.fork()
		await em.nativeDelete(EntryFile, {})
		await em.nativeDelete(Entry, {})
		await em.nativeDelete(Source, {})
		await em.nativeDelete(Integration, {})
		await em.nativeDelete(User, {})
		await rm(root, { recursive: true, force: true })
		user = new User({ username: 'owner' })
		const integration = new CalDAV({ userId: user.id, uri: 'https://example.com/dav/', credentials: { username: 'u', password: 'p' } })
		source = new Source({ integrationId: integration.id, uri: 'https://example.com/dav/cal/', name: 'Cal', entryTypes: [EntryType.Event], enabled: true })
		em.persist([user, integration, source])
		await em.flush()
	})

	/** An upload, as the route answers it: the bytes stored, a reference to them. */
	const uploaded = async (content: string, writtenAt?: Date) => {
		const bytes = await store.put(user.id, Readable.from([Buffer.from(content)]), 1024)
		if (writtenAt) {
			await utimes(store.pathFor(user.id, bytes.sha256), writtenAt, writtenAt)
		}
		return { sha256: bytes.sha256, size: bytes.size, mimeType: 'text/plain', name: 'note.txt' }
	}

	/** An entry created as the route creates one: its files claimed for the user first. */
	const entryWith = async (...given: Array<object>) => {
		const files = EntryFiles.of(given)
		assert.deepEqual(await store.claim(user.id, files), [])
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Kickoff', attachments: files })
		em.persist(entry)
		await em.flush()
		return entry
	}

	/** The entry's files set again as a request sets them: claimed against what it holds first. */
	const setAgain = async (session: EntityManager, entry: Entry, ...given: Array<object>) => {
		const again = await session.findOneOrFail(Entry, { id: entry.id! })
		const files = EntryFiles.of(given)
		assert.deepEqual(await store.claim(user.id, files, again.files), [])
		again.attachments = files
	}

	/** The entry as a fresh request reads it. */
	const reread = (entry: Entry) => orm.em.fork().findOneOrFail(Entry, { id: entry.id! })

	const rows = () => orm.em.fork().find(EntryFile, {}, { orderBy: { rank: 'asc' } })

	describe('claiming', () => {
		it('takes an upload as the user\'s under a fresh id, whatever id the request named', async () => {
			const own = { ...await uploaded('mine'), id: 'AAAAAAAAAAAAAAAAAAAAAA' }
			const files = EntryFiles.of([own])
			assert.deepEqual(await store.claim(user.id, files), [])
			assert.notEqual(files.all[0]!.id, own.id)
			assert.equal(files.all[0]!.userId, user.id)
		})

		it('refuses bytes the user never uploaded, and a reference by id alone that no row holds', async () => {
			const refused = await store.claim(user.id, EntryFiles.of([{ sha256: 'b'.repeat(64), name: 'stolen.pdf' }, { id: 'BBBBBBBBBBBBBBBBBBBBBB' }]))
			assert.deepEqual(refused.map(error => error.fields), [['files'], ['files']])
		})

		it('gives a reference to a held row by its id that row\'s bytes, never the hash the request names', async () => {
			const entry = await entryWith(await uploaded('mine'))
			const held = (await reread(entry)).files
			const files = EntryFiles.of([{ id: held.all[0]!.id, sha256: 'b'.repeat(64) }])
			assert.deepEqual(await store.claim(user.id, files, held), [])
			assert.equal(files.all[0]!.id, held.all[0]!.id)
			assert.equal(files.all[0]!.sha256, held.all[0]!.sha256)
		})

		it('gives a file the entry already holds that row\'s id, and leaves another\'s link without an owner', async () => {
			const entry = await entryWith(await uploaded('mine'))
			const held = (await reread(entry)).files
			const files = EntryFiles.of([{ sha256: held.all[0]!.sha256, id: 'CCCCCCCCCCCCCCCCCCCCCC' }, { sourceUrl: link }])
			assert.deepEqual(await store.claim(user.id, files, held), [])
			assert.equal(files.all[0]!.id, held.all[0]!.id)
			assert.equal(files.all[1]!.userId, undefined)
		})
	})

	describe('saving', () => {
		it('stores an upload by its hash as the user\'s, and another\'s file by its URL, in order', async () => {
			const own = await uploaded('mine')
			const entry = await entryWith(own, { sourceUrl: link, name: 'deck.pdf', mimeType: 'application/pdf' })

			const read = await reread(entry)
			assert.deepEqual(read.attachments.all.map(file => file.key), [own.sha256, link])
			assert.deepEqual(read.attachments.all.map(file => file.name), ['note.txt', 'deck.pdf'])
			assert.deepEqual((await rows()).map(row => row.userId), [user.id, undefined])
		})

		it('keeps another\'s file as a row of each entry carrying it, each with the facts it was given', async () => {
			await entryWith({ sourceUrl: link, name: 'deck.pdf' })
			await entryWith({ sourceUrl: link, name: 'deck v2.pdf' })
			assert.deepEqual((await rows()).map(row => row.name).sort(), ['deck v2.pdf', 'deck.pdf'])
		})

		it('writes nothing again when the same files are set again, and removes only the one taken away', async () => {
			const [a, b] = [await uploaded('a'), await uploaded('b')]
			const entry = await entryWith(a, b)
			const before = await rows()

			const session = orm.em.fork()
			await setAgain(session, entry, { sha256: b.sha256 })
			await session.flush()

			const left = await rows()
			assert.deepEqual(left.map(row => row.id), before.filter(row => row.sha256 === b.sha256).map(row => row.id))
			assert.equal(left[0]!.rank, 0)
		})

		it('keeps the order it is given, and the facts of a file sent back without them', async () => {
			const own = await uploaded('mine')
			const entry = await entryWith(own, { sourceUrl: link, name: 'deck.pdf' })
			const session = orm.em.fork()
			await setAgain(session, entry, { sourceUrl: link }, { sha256: own.sha256 })
			await session.flush()

			const read = await reread(entry)
			assert.deepEqual(read.attachments.all.map(file => file.name), ['deck.pdf', 'note.txt'])
		})

		it('copies a file another entry\'s row holds, as an edit of one occurrence carries the recurring entry\'s, leaving that row where it is', async () => {
			const first = await entryWith(await uploaded('shared'))
			const session = orm.em.fork()
			const original = await session.findOneOrFail(Entry, { id: first.id! })
			const second = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'This one', attachments: original.attachments })
			session.persist(second)
			await session.flush()

			const [a, b] = [await reread(first), await reread(second)]
			assert.equal(a.attachments.length, 1)
			assert.notEqual(b.attachments.all[0]!.id, a.attachments.all[0]!.id)
			assert.equal(b.attachments.all[0]!.sha256, a.attachments.all[0]!.sha256)
			assert.equal((await rows()).find(row => row.id === b.attachments.all[0]!.id)?.userId, user.id)
		})

		it('carries one of Mitra\'s own URLs it has no row for as the link it is', async () => {
			const foreign = 'https://mitra.example.com/api/files/CCCCCCCCCCCCCCCCCCCCCC/plan.pdf'
			const entry = await entryWith({ sourceUrl: foreign })
			assert.deepEqual((await reread(entry)).attachments.all.map(file => file.url()), [foreign])
		})
	})

	describe('the disposer', () => {
		it('deletes the bytes nothing carries once the grace period has passed', async () => {
			const file = await uploaded('orphan', old)

			assert.equal(await disposer.dispose(), 1)
			assert.equal(await store.exists(user.id, file.sha256), false)
		})

		it('keeps a file an entry carries', async () => {
			const file = await uploaded('carried', old)
			await entryWith(file)

			assert.equal(await disposer.dispose(), 0)
			assert.equal(await store.exists(user.id, file.sha256), true)
		})

		it('keeps a fresh file, so an upload can sit on an unsaved draft, uploaded again included', async () => {
			const file = await uploaded('fresh', old)
			await uploaded('fresh')

			assert.equal(await disposer.dispose(), 0)
			assert.equal(await store.exists(user.id, file.sha256), true)
		})

		it('deletes a file once the entry carrying it is gone', async () => {
			const file = await uploaded('was carried', old)
			const entry = await entryWith(file)
			assert.equal(await disposer.dispose(), 0)

			const session = orm.em.fork()
			session.remove(await session.findOneOrFail(Entry, { id: entry.id! }))
			await session.flush()
			assert.equal(await disposer.dispose(), 1)
			assert.equal(await store.exists(user.id, file.sha256), false)
		})
	})
})
