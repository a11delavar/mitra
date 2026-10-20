import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { countSourceEntries, importIcs } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

const ics = [
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mitra//Test//EN',
	'BEGIN:VEVENT', 'UID:import-ics', 'DTSTAMP:20260701T000000Z', 'DTSTART:20260701T090000Z', 'DTEND:20260701T100000Z', 'SUMMARY:Imported', 'END:VEVENT',
	'END:VCALENDAR',
].join('\r\n')

describe('ImportIcs', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('imports a calendar file\'s entries into a calendar', async () => {
		await importIcs(server.source.id, ics)
		assert.equal(await countSourceEntries(server.source.id), 1)
	})

	it('refuses an empty file', async () => {
		await assert.rejects(importIcs(server.source.id, ' '))
	})
})
