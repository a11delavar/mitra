import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { entity, primaryKey, property, manyToOne } from './orm.js'
import { children } from './children.js'
import { Entity, identity, equality } from './Entity.js'

@entity({ tableName: 'shelf' })
class Shelf {
	@primaryKey({ type: 'string' }) id: string = crypto.randomUUID()
	@children(() => Book, book => book.shelf, { eager: true, orphanRemoval: true, saves: true }) books!: ReadonlyArray<Book>
	@children(() => Label, label => label.shelf, { eager: true }) labels!: ReadonlyArray<Label>
	@children(() => Tag, tag => tag.shelfId, { eager: true, orphanRemoval: true, as: () => Tags, rows: tags => tags.rows, unknown: true, saves: true }) tags?: Tags

	constructor(init?: Partial<Shelf>) {
		Object.assign(this, init)
	}
}

@entity({ tableName: 'book' })
class Book extends Entity {
	@identity() @primaryKey({ type: 'string' }) id: string = crypto.randomUUID()
	@manyToOne(() => Shelf, { deleteRule: 'cascade' }) shelf!: Shelf
	@equality() @property({ type: 'string' }) title = ''

	constructor(init?: Partial<Book>) {
		super()
		Object.assign(this, init)
	}
}

@entity({ tableName: 'label' })
class Label {
	@primaryKey({ type: 'string' }) id: string = crypto.randomUUID()
	@manyToOne(() => Shelf, { deleteRule: 'cascade' }) shelf!: Shelf
	@property({ type: 'string' }) text = ''

	constructor(init?: Partial<Label>) {
		Object.assign(this, init)
	}
}

/** A tag's row, told apart by its text: the domain holds the texts, never the rows. */
@entity({ tableName: 'tag' })
class Tag extends Entity {
	@primaryKey({ type: 'string' }) id: string = crypto.randomUUID()
	@manyToOne(() => Shelf, { mapToPk: true, deleteRule: 'cascade' }) shelfId!: string
	@property({ type: 'string' }) text = ''

	constructor(init?: Partial<Tag>) {
		super()
		Object.assign(this, init)
	}

	@identity() get key() {
		return this.text
	}
}

/** The texts, as the domain reads a shelf's tags. */
class Tags {
	static of(rows: ReadonlyArray<Tag>) {
		return new Tags(rows.map(row => row.text))
	}

	constructor(readonly texts: ReadonlyArray<string>) { }

	get rows() {
		return this.texts.map(text => new Tag({ text }))
	}
}

describe('children', () => {
	let orm: MikroORM

	before(async () => {
		orm = await MikroORM.init({ entities: [Shelf, Book, Label, Tag], dbName: ':memory:', subscribers: [children.subscriber], allowGlobalContext: true, forceUndefined: true })
		await orm.schema.create()
	})

	after(() => orm.close(true))

	const titles = (shelf: Shelf) => shelf.books.map(book => book.title)
	const reread = (shelf: Shelf) => orm.em.fork().findOneOrFail(Shelf, { id: shelf.id })
	const saved = async (...books: Array<Book>) => {
		const em = orm.em.fork()
		const shelf = new Shelf({ books })
		em.persist(shelf)
		await em.flush()
		return shelf
	}

	it('are a plain array outside the ORM, as in the browser, set and read as such', () => {
		const shelf = new Shelf()
		assert.deepEqual(shelf.books, [])
		shelf.books = [new Book({ title: 'Dune' })]
		assert.deepEqual(titles(shelf), ['Dune'])
	})

	it('go with a spread as a value, never as the collection', () => {
		const shelf = new Shelf({ books: [new Book({ title: 'Dune' })] })
		const copy = new Shelf({ ...shelf })
		copy.books = [...copy.books, new Book({ title: 'Emma' })]
		assert.deepEqual(titles(shelf), ['Dune'])
		assert.deepEqual(titles(copy), ['Dune', 'Emma'])
	})

	it('are loaded with their parent', async () => {
		const shelf = await saved(new Book({ title: 'Dune' }), new Book({ title: 'Emma' }))
		assert.deepEqual(titles(await reread(shelf)).sort(), ['Dune', 'Emma'])
	})

	it('save as set: a child a row is updates it, a new one is added, the rest are removed', async () => {
		const shelf = await saved(new Book({ title: 'Dune' }), new Book({ title: 'Emma' }))
		const em = orm.em.fork()
		const loaded = await em.findOneOrFail(Shelf, { id: shelf.id })
		const [dune] = loaded.books.filter(book => book.title === 'Dune')
		const kept = dune!.id
		loaded.books = [new Book({ id: kept, title: 'Dune Messiah' }), new Book({ title: 'Ulysses' })]
		await em.flush()

		const read = await reread(shelf)
		assert.deepEqual(titles(read).sort(), ['Dune Messiah', 'Ulysses'])
		assert.ok(read.books.some(book => book.id === kept && book.title === 'Dune Messiah'))
		assert.equal(await orm.em.fork().count(Book, { shelf: shelf.id, title: 'Emma' }), 0)
	})

	it('save a copy of a child another parent\'s row holds, leaving that row where it is', async () => {
		const first = await saved(new Book({ title: 'Dune' }))
		const em = orm.em.fork()
		const loaded = await em.findOneOrFail(Shelf, { id: first.id })
		const second = new Shelf({ books: loaded.books })
		em.persist(second)
		await em.flush()

		const [a, b] = [await reread(first), await reread(second)]
		assert.deepEqual(titles(a), ['Dune'])
		assert.deepEqual(titles(b), ['Dune'])
		assert.notEqual(b.books[0]!.id, a.books[0]!.id)
	})

	it('are never saved without `saves`: setting them only changes what the instance shows', async () => {
		const em = orm.em.fork()
		const shelf = new Shelf()
		em.persist([shelf, new Label({ shelf, text: 'Fiction' })])
		await em.flush()

		const session = orm.em.fork()
		const loaded = await session.findOneOrFail(Shelf, { id: shelf.id })
		loaded.labels = []
		await session.flush()
		assert.deepEqual((await reread(shelf)).labels.map(label => label.text), ['Fiction'])
	})

	describe('a collection of values kept as rows', () => {
		const texts = (shelf: Shelf) => [...shelf.tags?.texts ?? []].sort()
		const tagged = async (...texts: Array<string>) => {
			const em = orm.em.fork()
			const shelf = new Shelf({ tags: new Tags(texts) })
			em.persist(shelf)
			await em.flush()
			return shelf
		}

		it('saves the rows the collection maps its values to, each naming its parent by key', async () => {
			const shelf = await tagged('a', 'b')
			assert.deepEqual(texts(await reread(shelf)), ['a', 'b'])
		})

		it('keeps the row a value still stands for, adds and removes the rest', async () => {
			const shelf = await tagged('a', 'b')
			const kept = (await orm.em.fork().findOneOrFail(Tag, { shelfId: shelf.id, text: 'b' })).id
			const em = orm.em.fork()
			const loaded = await em.findOneOrFail(Shelf, { id: shelf.id })
			loaded.tags = new Tags(['b', 'c'])
			await em.flush()
			assert.deepEqual(texts(await reread(shelf)), ['b', 'c'])
			assert.equal((await orm.em.fork().findOneOrFail(Tag, { shelfId: shelf.id, text: 'b' })).id, kept)
		})

		it('saves what an owner flushed earlier in the same unit is set to since', async () => {
			const em = orm.em.fork()
			const shelf = new Shelf()
			em.persist(shelf)
			await em.flush()
			shelf.tags = new Tags(['late'])
			shelf.books = [new Book({ title: 'Late' })]
			await em.flush()
			const read = await reread(shelf)
			assert.deepEqual([texts(read), titles(read)], [['late'], ['Late']])
		})

		it('reads as unknown on an owner made outside the ORM, as none on a loaded one without rows, and keeps the rows of one given none', async () => {
			assert.equal(new Shelf().tags, undefined)
			const bare = await tagged()
			assert.deepEqual((await reread(bare)).tags?.texts, [])
			const shelf = await tagged('a')
			const em = orm.em.fork()
			const loaded = await em.findOneOrFail(Shelf, { id: shelf.id })
			loaded.tags = undefined
			await em.flush()
			assert.deepEqual(texts(await reread(shelf)), ['a'])
		})
	})
})
