import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MimeType } from './MimeType.js'

describe('MimeType', () => {
	it('reads a header or parameter, lowercased and without parameters, as one instance per type', () => {
		const png = MimeType.parse(' IMAGE/PNG ')!
		assert.equal(png.value, 'image/png')
		assert.equal(MimeType.parse('image/png; charset=binary'), png)
		assert.equal(png.type, 'image')
		assert.equal(png.subtype, 'png')
		assert.equal(String(png), 'image/png')
	})

	it('is none when malformed', () => {
		assert.equal(MimeType.parse('<script>'), undefined)
		assert.equal(MimeType.parse('image'), undefined)
		assert.equal(MimeType.parse(undefined), undefined)
		assert.equal(MimeType.parse(42), undefined)
	})

	it('shows media, PDF and plain text in place, and downloads what could script the app', () => {
		const inline = (value: string) => MimeType.parse(value)!.inline
		assert.equal(inline('image/png'), true)
		assert.equal(inline('video/mp4'), true)
		assert.equal(inline('audio/mpeg'), true)
		assert.equal(inline('application/pdf'), true)
		assert.equal(inline('text/plain'), true)
		assert.equal(inline('image/svg+xml'), false)
		assert.equal(inline('text/html'), false)
		assert.equal(MimeType.octetStream.inline, false)
	})

	it('picks a glyph by family', () => {
		const icon = (value: string) => MimeType.parse(value)!.icon
		assert.equal(icon('image/png'), 'image')
		assert.equal(icon('video/mp4'), 'film')
		assert.equal(icon('audio/mpeg'), 'music')
		assert.equal(icon('application/pdf'), 'file-text')
		assert.equal(icon('text/markdown'), 'file-text')
		assert.equal(icon('application/zip'), 'file')
	})

	it('crosses the wire and the database as its text', () => {
		const pdf = MimeType.parse('application/pdf')!
		assert.equal(MimeType.converter.deconstruct!(pdf, {}), 'application/pdf')
		assert.equal(MimeType.converter.construct!('application/pdf', {}), pdf)
		const mapper = new MimeType.Mapper()
		assert.equal(mapper.convertToDatabaseValue(pdf), 'application/pdf')
		assert.equal(mapper.convertToJSValue('application/pdf'), pdf)
		assert.equal(mapper.convertToJSValue(null), null)
	})
})
