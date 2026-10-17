import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { EntryFiles } from './EntryFiles.js'
import { EntryFile } from './EntryFile.js'
import { EntryFileType } from './EntryFileType.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

const id = 'AAAAAAAAAAAAAAAAAAAAAA'
const sha256 = 'a'.repeat(64)
const file = EntryFile.from({ id, sha256, name: 'a.pdf' })!
const link = EntryFile.from({ sourceUrl: 'https://example.com/b.pdf' })!
const keys = (files: EntryFiles) => files.all.map(each => each.key)
const entry = (attachments?: Array<object>) =>
	new Entry({ id: 'e1', sourceId: 's1', type: EntryType.Event, heading: 'Kickoff', attachments: EntryFiles.of(attachments) })

describe('Entry files', () => {
	it('hold its attachments as files of that type', () => {
		const subject = entry([file, link])
		assert.deepEqual(keys(subject.files), keys(subject.attachments))
		assert.ok(subject.files.all.every(each => each.type === EntryFileType.Attachment))
	})

	it('are left out of the entry\'s links, which are the description\'s other destinations: one of Mitra\'s own by its URL on any host, another app\'s by its address', () => {
		const subject = entry([file, link])
		subject.description = [
			`See [the brief](https://mitra.example.org/api/files/${id}/a.pdf) and [the notes](https://example.com/b.pdf),`,
			'then [the site](https://example.com/) and ![the brief again](http://localhost:3000/api/files/AAAAAAAAAAAAAAAAAAAAAA/a.pdf).',
		].join('\n')
		assert.deepEqual(subject.links.map(each => each.href), ['https://example.com/'])
		assert.deepEqual(entry([]).links.map(each => each.href), [])
		subject.description = 'Only [the brief](/api/files/AAAAAAAAAAAAAAAAAAAAAA/a.pdf)'
		assert.deepEqual(subject.links, [])
	})

	it('detaching a file takes it off the entry and strips what the description shows of it', () => {
		const subject = entry([file, link])
		subject.description = `Read [the brief](https://mitra.example.org/api/files/${id}/a.pdf).\n\n![the brief](/api/files/${id}/a.pdf)\n\nAlso [the notes](https://example.com/b.pdf).`
		subject.detach(file)
		assert.deepEqual(keys(subject.attachments), keys(EntryFiles.of([link])))
		assert.equal(subject.description, 'Read .\n\nAlso [the notes](https://example.com/b.pdf).')
		subject.detach(link)
		assert.deepEqual(keys(subject.attachments), [])
		assert.equal(subject.description, 'Read .\n\nAlso .')
	})

	it('embed in the description once, at the end of the text, as a picture or a link by their kind', () => {
		const photo = EntryFile.from({ id: 'BBBBBBBBBBBBBBBBBBBBBB', sha256: 'b'.repeat(64), name: 'b.png', mimeType: 'image/png' })!
		const subject = entry([file, photo])
		subject.description = 'Notes.'
		assert.equal(subject.embeds(file), false)
		subject.embed(file, 'https://mitra.example.org')
		subject.embed(photo, 'https://mitra.example.org')
		assert.equal(subject.description, `Notes.\n\n[a.pdf](https://mitra.example.org/api/files/${id}/a.pdf)\n\n![b.png](https://mitra.example.org/api/files/BBBBBBBBBBBBBBBBBBBBBB/b.png)`)
		assert.deepEqual([subject.embeds(file), subject.embeds(photo)], [true, true])
		subject.embed(file, 'https://mitra.example.org')
		assert.equal(subject.description.split('[a.pdf]').length, 2)
		const bare = entry([link])
		bare.embed(link, 'https://mitra.example.org')
		assert.equal(bare.description, '[b.pdf](https://example.com/b.pdf)')
	})

	it('count as an edit', () => {
		const before = entry([file])
		const after = before.clone()
		after.attachments = after.attachments.adding(link)
		assert.equal(before.equals(after), false)
		assert.equal(before.equals(entry([file])), true)
	})

	it('are taken over by an entry Mitra stores itself, removal included', () => {
		const stored = entry([file])
		stored.equate(entry([link]))
		assert.deepEqual(keys(stored.attachments), [link.key])
		stored.equate(entry())
		assert.equal(stored.attachments.length, 0)
	})

	it('come with a copy as files of its own, each the same thing with an id of its own', () => {
		const original = entry([file, link])
		const copy = original.copy()
		assert.deepEqual(keys(copy.attachments), keys(original.attachments))
		assert.ok(copy.files.all.every(each => !original.files.all.some(held => held.id === each.id)))
		assert.equal(original.duplicate().attachments.all[0]!.sha256, sha256)
		assert.notEqual(original.duplicate().attachments.all[0]!.id, id)
	})

	it('come with a clone, which keeps its own', () => {
		const original = entry([file])
		const clone = original.clone()
		clone.attachments = clone.attachments.adding(link)
		assert.deepEqual(keys(original.attachments), [sha256])
		assert.deepEqual(keys(clone.attachments), [sha256, link.key])
	})

	it('go with a duplicate as copies, and not with availability', () => {
		const duplicate = entry([file]).duplicate()
		assert.deepEqual(keys(duplicate.attachments), [sha256])
		assert.notEqual(duplicate.attachments.all[0]!.id, id)
		const window = entry([file])
		window.type = EntryType.Availability
		assert.equal(window.attachments.length, 0)
	})

	it('cross the wire as files, each with its type, which the attachments are read from', () => {
		const wire = wireOf(entry([file, link]))
		assert.equal('attachments' in wire, false)
		assert.deepEqual(wire.files.map((each: { type: string }) => each.type), ['attachment', 'attachment'])
		const sent = revive<Entry>(wire)
		assert.ok(sent.files instanceof EntryFiles)
		assert.ok(sent.attachments.all[0] instanceof EntryFile)
		assert.equal(sent.attachments.all[0]!.id, id)
		assert.equal(sent.attachments.equals(EntryFiles.of([file, link])), true)
	})
})
