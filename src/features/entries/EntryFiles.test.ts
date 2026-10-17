import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryFiles } from './EntryFiles.js'
import { EntryFile } from './EntryFile.js'
import { EntryFileType } from './EntryFileType.js'

const id = 'AAAAAAAAAAAAAAAAAAAAAA'
const sha256 = 'a'.repeat(64)
const file = EntryFile.from({ id, sha256, name: 'a.pdf' })!
const link = EntryFile.from({ sourceUrl: 'https://example.com/b.pdf' })!
const keys = (files: EntryFiles) => files.all.map(each => each.key)

describe('EntryFiles', () => {
	it('is none when nothing usable is left', () => {
		assert.equal(EntryFiles.of([]).length, 0)
		assert.equal(EntryFiles.of([{ name: 'orphan' }]).length, 0)
		assert.equal(EntryFiles.of(null).length, 0)
		assert.equal(EntryFiles.of('nonsense').length, 0)
	})

	it('keeps each file once', () => {
		const files = EntryFiles.of([{ sha256, name: 'first.pdf' }, { sha256, name: 'second.pdf' }, { sourceUrl: link.sourceUrl }, { sourceUrl: link.sourceUrl }])
		assert.deepEqual(files.all.map(each => each.displayName), ['first.pdf', 'b.pdf'])
	})

	it('holds at most its maximum of a kind', () => {
		const many = Array.from({ length: EntryFiles.maxCount + 10 }, (_, index) => ({ sourceUrl: `https://example.com/${index}` }))
		assert.equal(EntryFiles.of(many).length, EntryFiles.maxCount)
	})

	it('adds a file last unless it is there, and takes one away by whatever refers to it', () => {
		const both = EntryFiles.of([file]).adding(link)
		assert.deepEqual(keys(both), [sha256, link.sourceUrl])
		assert.equal(both.adding(EntryFile.from({ sha256 })!).length, 2)
		assert.deepEqual(keys(both.without(EntryFile.from({ id })!)), [link.key])
		assert.equal(both.without(link).without(file).length, 0)
		assert.equal(both.without(EntryFile.from({ sourceUrl: 'https://example.com/nope' })!).length, 2)
	})

	it('replaces those of a kind, as that kind in the order given, and reads them back by their place', () => {
		const files = EntryFiles.of([]).replacing(EntryFileType.Attachment, [link, file])
		assert.deepEqual(files.all.map(each => [each.type, each.rank]), [[EntryFileType.Attachment, 0], [EntryFileType.Attachment, 1]])
		assert.deepEqual(keys(files.ofType(EntryFileType.Attachment)), [link.sourceUrl, sha256])
		assert.equal(files.replacing(EntryFileType.Attachment, undefined).length, 0)
	})

	it('tells two lists apart by their files and order, not by the facts a copy of a file carries', () => {
		const copy = EntryFiles.of([{ sha256, name: 'renamed.pdf' }, { sourceUrl: link.sourceUrl }])
		assert.equal(copy.equals(EntryFiles.of([file, link])), true)
		assert.equal(copy.equals(EntryFiles.of([link, file])), false)
	})

	it('takes a file named without a type as an attachment', () => {
		assert.equal(EntryFiles.of([{ sourceUrl: link.sourceUrl }]).all[0]!.type, EntryFileType.Attachment)
	})
})
