import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { equals } from '@a11d/equals'
import { Entity, identity, equality } from './Entity.js'

class Book extends Entity {
	@identity() id?: string
	@equality() title = ''
	@equality() pages?: number
	/** Bookkeeping: neither identity nor equality. */
	etag?: string

	constructor(init?: Partial<Book>) {
		super()
		Object.assign(this, init)
	}
}

class Edition extends Book {
	@equality() year?: number

	private _format = 'paper'
	@equality()
	get format() { return this._format }
	set format(value: string) { this._format = value }
}

/** A value object: immutable, so kept by reference, never copied. */
class Unit {
	constructor(readonly code: string) { }
}

class Shelf extends Entity {
	@identity() id?: string
	@equality() books: Array<Book> = []
	@equality() settings: { theme: string, tags: Array<string> } = { theme: 'light', tags: [] }
	@equality() unit?: Unit

	constructor(init?: Partial<Shelf>) {
		super()
		Object.assign(this, init)
	}
}

class Hash extends Entity {
	url?: string
	sha?: string
	@identity() get key() { return this.url ?? this.sha }
	@equality() name?: string

	constructor(init?: Partial<Hash>) {
		super()
		Object.assign(this, init)
	}
}

describe('Entity', () => {
	const book = (init?: Partial<Book>) => new Book({ id: 'a', title: 'Dune', pages: 412, etag: '"1"', ...init })

	describe('is', () => {
		it('is identity alone: the same id with other values', () => {
			assert.equal(book().is(book({ title: 'Renamed', pages: 1, etag: '"2"' })), true)
		})

		it('is false for another id with the same values', () => {
			assert.equal(book().is(book({ id: 'b' })), false)
		})

		it('holds for the instance itself, and never between two without an identity', () => {
			const draft = book({ id: undefined })
			assert.equal(draft.is(draft), true)
			assert.equal(draft.is(book({ id: undefined })), false)
		})

		it('reads a computed identity off a getter', () => {
			assert.equal(new Hash({ url: 'https://example.com/a', name: 'a' }).is(new Hash({ url: 'https://example.com/a', name: 'b' })), true)
			assert.equal(new Hash({ sha: 'f00' }).is(new Hash({ sha: 'f00' })), true)
			assert.equal(new Hash({ sha: 'f00' }).is(new Hash({ sha: 'ba4' })), false)
		})
	})

	describe('equals', () => {
		it('is equality alone: the same values with another id and bookkeeping', () => {
			assert.equal(book().equals(book({ id: 'b', etag: '"2"' })), true)
		})

		it('is false once a value differs, an unset one included', () => {
			assert.equal(book().equals(book({ title: 'Renamed' })), false)
			assert.equal(book().equals(book({ pages: undefined })), false)
		})

		it('is the library\'s equality as the same one unchanged, so a collection of entities compares each pair by identity and equality', () => {
			assert.equal(Object[equals](book(), book({ etag: '"2"' })), true)
			assert.equal(Object[equals](book(), book({ id: 'b' })), false)
			assert.equal(Object[equals]([book()], [book({ title: 'Renamed' })]), false)
			assert.equal(Object[equals](book(), { id: 'a', title: 'Dune', pages: 412 }), false)
		})

		it('descends into the entities a field holds', () => {
			const shelf = (init?: Partial<Shelf>) => new Shelf({ id: 's', books: [book()], settings: { theme: 'dark', tags: ['x'] }, ...init })
			assert.equal(shelf().equals(shelf()), true)
			assert.equal(shelf().equals(shelf({ books: [book({ title: 'Renamed' })] })), false)
			assert.equal(shelf().equals(shelf({ books: [book({ id: 'b' })] })), false)
			assert.equal(shelf().equals(shelf({ settings: { theme: 'dark', tags: [] } })), false)
		})

		it('includes what a subclass declares, through an accessor too', () => {
			const edition = (init?: Partial<Edition>) => Object.assign(new Edition({ id: 'a', title: 'Dune' }), { year: 1965, format: 'cloth', ...init })
			assert.equal(edition().equals(edition()), true)
			assert.equal(edition().equals(edition({ year: 1966 })), false)
			assert.equal(edition().equals(edition({ format: 'paper' })), false)
		})
	})

	describe('clone', () => {
		it('is the same one, identity and bookkeeping included, as another instance', () => {
			const original = book()
			const clone = original.clone()
			assert.notEqual(clone, original)
			assert.ok(clone instanceof Book)
			assert.equal(clone.is(original), true)
			assert.equal(clone.equals(original), true)
			assert.equal(clone.etag, '"1"')
		})
	})

	describe('deep copying', () => {
		const unit = new Unit('cm')
		const shelf = () => new Shelf({ id: 's', books: [book()], settings: { theme: 'dark', tags: ['x'] }, unit })

		it('clone: arrays and plain objects are its own, nested entities are clones, value objects the same instance', () => {
			const original = shelf()
			const clone = original.clone()
			assert.notEqual(clone.books, original.books)
			assert.notEqual(clone.books[0], original.books[0])
			assert.equal(clone.books[0]!.is(original.books[0]!), true)
			assert.notEqual(clone.settings, original.settings)
			assert.notEqual(clone.settings.tags, original.settings.tags)
			assert.deepEqual(clone.settings, original.settings)
			assert.equal(clone.unit, unit)
		})

		it('copy: nested entities are copies, with identities of their own', () => {
			const copy = shelf().copy()
			assert.equal(copy.books[0]!.equals(book()), true)
			assert.equal(copy.books[0]!.id, undefined)
			assert.equal(copy.unit, unit)
		})

		it('assign and equate take the values as their own too', () => {
			const other = shelf()
			for (const mine of [new Shelf().assign(other), new Shelf().equate(other)]) {
				assert.equal(mine.equals(other), true)
				assert.notEqual(mine.books, other.books)
				assert.notEqual(mine.books[0], other.books[0])
				assert.notEqual(mine.settings, other.settings)
			}
		})
	})

	describe('copy', () => {
		it('is an equal one with an identity of its own, without the bookkeeping', () => {
			const copy = book().copy()
			assert.ok(copy instanceof Book)
			assert.equal(copy.equals(book()), true)
			assert.equal(copy.is(book()), false)
			assert.equal(copy.id, undefined)
			assert.equal(copy.etag, undefined)
		})

		it('runs the constructor, so an identity minted there is fresh', () => {
			class Minted extends Entity {
				@identity() id = crypto.randomUUID()
				@equality() name?: string

				constructor(init?: Partial<Minted>) {
					super()
					Object.assign(this, init)
				}
			}
			const original = new Minted({ name: 'x' })
			const copy = original.copy()
			assert.equal(copy.name, 'x')
			assert.notEqual(copy.id, original.id)
		})
	})

	describe('assign', () => {
		it('makes this the other in place: afterwards this is and equals it', () => {
			const mine = book({ title: 'Mine' })
			const other = book({ id: 'b', title: 'Theirs', etag: '"9"' })
			assert.equal(mine.assign(other), mine)
			assert.equal(mine.is(other), true)
			assert.equal(mine.equals(other), true)
			assert.equal(mine.etag, '"9"')
		})

		it('clears what the other lacks', () => {
			const mine = book()
			mine.assign(book({ pages: undefined, etag: undefined }))
			assert.equal(mine.pages, undefined)
			assert.equal(mine.etag, undefined)
		})
	})

	describe('equate', () => {
		it('makes this equal to the other, keeping its identity and bookkeeping', () => {
			const mine = book()
			const other = book({ id: 'b', title: 'Theirs', pages: undefined, etag: '"9"' })
			assert.equal(mine.equate(other), mine)
			assert.equal(mine.equals(other), true)
			assert.equal(mine.is(other), false)
			assert.equal(mine.id, 'a')
			assert.equal(mine.etag, '"1"')
		})
	})

	it('names the fields of a role, a base class\'s first', () => {
		assert.deepEqual(Entity.fieldsOf(Edition, 'identity'), ['id'])
		assert.deepEqual(Entity.fieldsOf(Edition, 'equality'), ['title', 'pages', 'year', 'format'])
	})
})
