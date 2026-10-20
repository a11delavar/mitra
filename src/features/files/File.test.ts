import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deconstruct } from '@a11d/converter'
import { EntryFile, EntryFileType } from '#features/entries'
import { File } from './File.js'
import { MimeType } from './MimeType.js'

const id = 'AAAAAAAAAAAAAAAAAAAAAA'
const sha256 = 'a'.repeat(64)

describe('File', () => {
	describe('from', () => {
		it('is none without an id, a hash or a URL', () => {
			assert.equal(EntryFile.from({ name: 'orphan' }), undefined)
			assert.equal(EntryFile.from('https://example.com/a.pdf'), undefined)
			assert.equal(EntryFile.from(null), undefined)
		})

		it('keeps a URL it cannot interpret, as dropping it would delete the provider\'s line on the next write', () => {
			assert.equal(EntryFile.from({ sourceUrl: 'file:///home/me/notes.txt' })?.sourceUrl, 'file:///home/me/notes.txt')
			assert.equal(EntryFile.from({ sourceUrl: 'mailto:someone@example.com' })?.sourceUrl, 'mailto:someone@example.com')
		})

		it('keeps the id it is given, and mints one otherwise', () => {
			assert.equal(EntryFile.from({ id, sha256 })?.id, id)
			const minted = EntryFile.from({ sha256 })!
			assert.match(minted.id, /^[A-Za-z0-9_-]{22}$/)
			assert.notEqual(minted.id, EntryFile.from({ sha256 })!.id)
		})

		it('refuses a malformed id or hash rather than trusting it into a URL or a path', () => {
			assert.equal(EntryFile.from({ id: '../../etc/passwd' }), undefined)
			assert.equal(EntryFile.from({ id: `${id}${id}` }), undefined)
			assert.equal(EntryFile.from({ sha256: '../x' }), undefined)
			assert.equal(EntryFile.from({ sha256: sha256.toUpperCase() })?.sha256, sha256)
		})

		it('cleans its facts', () => {
			const file = EntryFile.from({ sourceUrl: 'https://example.com/a', mimeType: ' IMAGE/PNG ', size: 12.7, name: '  photo.png  ' })!
			assert.equal(file.mimeType, MimeType.parse('image/png'))
			assert.equal(file.size, 13)
			assert.equal(file.name, 'photo.png')
			assert.equal(EntryFile.from({ sourceUrl: 'https://example.com/a', size: -1 })!.size, undefined)
		})

		it('tells its facts and what it is to the entry, never its owner, age or place (the list\'s order states it)', () => {
			const file = new EntryFile({ id, userId: 'owner', sha256, name: 'a.pdf', size: 3, mimeType: MimeType.parse('application/pdf'), type: EntryFileType.Attachment, rank: 2 })
			assert.deepEqual(JSON.parse(JSON.stringify(deconstruct(file))), { id, sha256, name: 'a.pdf', size: 3, mimeType: 'application/pdf', type: 'attachment' })
		})
	})

	it('is told apart by its URL when another holds it, by its hash when Mitra does, else by its id', () => {
		assert.equal(EntryFile.from({ sourceUrl: 'https://example.com/a' })!.key, 'https://example.com/a')
		assert.equal(EntryFile.from({ id, sha256 })!.key, sha256)
		assert.equal(EntryFile.from({ id })!.key, id)
	})

	it('is referred to by its id, by what it is told apart by, or by one of Mitra\'s own URLs naming it', () => {
		const row = new EntryFile({ id, sha256, name: 'report.pdf' })
		assert.equal(EntryFile.from({ id })!.refersTo(row), true)
		assert.equal(EntryFile.from({ sha256 })!.refersTo(row), true)
		assert.equal(EntryFile.from({ sourceUrl: `https://moved.example.org/api/files/${id}/report.pdf` })!.refersTo(row), true)
		assert.equal(EntryFile.from({ sourceUrl: 'https://other.example.com/files/report.pdf' })!.refersTo(row), false)
		assert.equal(EntryFile.from({ sha256: 'b'.repeat(64) })!.refersTo(row), false)
	})

	it('is the row, by its id: a reference naming the same bytes is not', () => {
		const row = new EntryFile({ id, sha256, name: 'report.pdf' })
		assert.equal(row.is(new EntryFile({ id, sha256, name: 'renamed.pdf' })), true)
		assert.equal(row.is(EntryFile.from({ sha256 })!), false)
	})

	it('resolves a reference to the row it names: the row\'s id and bytes, with the name, type and size the reference tells', () => {
		const row = new EntryFile({ id, userId: 'owner', sha256, name: 'report.pdf', mimeType: MimeType.parse('application/pdf'), size: 10 })
		const reference = EntryFile.from({ sourceUrl: `https://moved.example.org/api/files/${id}/report.pdf`, name: 'final.pdf' })!
		reference.resolve(row)
		assert.equal(reference.id, id)
		assert.equal(reference.userId, 'owner')
		assert.equal(reference.sha256, sha256)
		assert.equal(reference.sourceUrl, undefined)
		assert.equal(reference.name, 'final.pdf')
		assert.equal(reference.mimeType, row.mimeType)
		assert.equal(reference.size, 10)
	})

	it('never takes the bytes a reference names when it names a row by id: the row\'s bytes are what it is', () => {
		const row = new EntryFile({ id, userId: 'owner', sha256 })
		const forged = EntryFile.from({ id, sha256: 'b'.repeat(64) })!
		forged.resolve(row)
		assert.equal(forged.sha256, sha256)
	})

	it('reads the id in one of Mitra\'s own URLs by path, whatever origin it carries, and leaves a path that only looks similar alone', () => {
		for (const url of [`https://mitra.example.com/api/files/${id}/report.pdf`, `http://localhost:3000/api/files/${id}/report.pdf`, `/api/files/${id}`, `https://moved.example.org/api/files/${id}/`]) {
			assert.equal(File.idOf(url), id, url)
		}
		assert.equal(File.idOf('https://x.example/api/files/too-short/report.pdf'), undefined)
	})

	it('is copied for another entry as the same thing, with its facts, its bytes\' owner and an id of its own', () => {
		const copy = new EntryFile({ id, userId: 'owner', sha256, name: 'a.pdf', type: EntryFileType.Attachment, rank: 3 }).copy()
		assert.notEqual(copy.id, id)
		assert.equal(copy.sha256, sha256)
		assert.equal(copy.name, 'a.pdf')
		assert.equal(copy.userId, 'owner')
		assert.equal(copy.type, EntryFileType.Attachment)
		assert.equal(copy.rank, 3)
	})

	describe('url', () => {
		it('is a path for Mitra\'s own file, and absolute only given an origin', () => {
			const file = EntryFile.from({ id, sha256, name: 'quarterly report.pdf' })!
			assert.equal(file.url(), `/api/files/${id}/quarterly%20report.pdf`)
			assert.equal(file.url('https://mitra.example.com/'), `https://mitra.example.com/api/files/${id}/quarterly%20report.pdf`)
		})

		it('is another\'s URL as it is', () => {
			assert.equal(EntryFile.from({ sourceUrl: 'https://example.com/x.pdf' })!.url('https://mitra.example.com'), 'https://example.com/x.pdf')
		})
	})

	it('names itself by its name, else the URL\'s last segment', () => {
		assert.equal(EntryFile.from({ sourceUrl: 'https://example.com/docs/plan.pdf' })!.displayName, 'plan.pdf')
		assert.equal(EntryFile.from({ sourceUrl: 'https://example.com' })!.displayName, 'example.com')
		assert.equal(EntryFile.from({ sourceUrl: 'https://example.com/x.pdf', name: 'Plan' })!.displayName, 'Plan')
	})

	it('wears its type\'s glyph, a link for a bare URL, a file for the unknown', () => {
		assert.equal(EntryFile.from({ sourceUrl: 'https://x', mimeType: 'image/png' })!.icon, 'image')
		assert.equal(EntryFile.from({ sourceUrl: 'https://x' })!.icon, 'link')
		assert.equal(EntryFile.from({ sha256 })!.icon, 'file')
	})

	describe('upload headers', () => {
		it('reads a name from either Content-Disposition form', () => {
			assert.equal(File.nameFrom('attachment; filename*=UTF-8\'\'quarterly%20report.pdf'), 'quarterly report.pdf')
			assert.equal(File.nameFrom('attachment; filename="report.pdf"'), 'report.pdf')
		})

		it('strips path separators from a name, as it is data, never a disk path', () => {
			assert.equal(File.nameFrom('attachment; filename="../../etc/passwd"'), '....etcpasswd')
			assert.equal(File.nameFrom('attachment; filename=""'), 'file')
			assert.equal(File.nameFrom(undefined), 'file')
		})
	})

	describe('disposition', () => {
		const file = (mimeType: string, name = 'a') => new EntryFile({ mimeType: MimeType.parse(mimeType), name })

		it('shows what its type allows in place and downloads everything else', () => {
			assert.match(file('image/png').disposition, /^inline;/)
			assert.match(file('image/svg+xml').disposition, /^attachment;/)
			assert.match(file('application/octet-stream').disposition, /^attachment;/)
			assert.match(new EntryFile({ name: 'a' }).disposition, /^attachment;/)
		})

		it('names a non-ASCII file both ways, so every client reads one', () => {
			const header = file('application/pdf', 'Übersicht.pdf').disposition
			assert.match(header, /filename="_bersicht.pdf"/)
			assert.match(header, /filename\*=UTF-8''%C3%9Cbersicht.pdf/)
		})
	})
})
