import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from '../caldav/CalDAV.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
import { AppleCalendar } from '../apple/AppleCalendar.js'
import { Notion } from '../notion/Notion.js'
import { Tempo } from '../tempo/Tempo.js'
import { Dev } from '../dev/Dev.js'
import './registerEngines.js'

const resolvesAnEngine = async (integration: { updateEntry(em: never, a: never, b: never): Promise<void> }) => {
	try {
		await integration.updateEntry({} as never, {} as never, {} as never)
		return true
	} catch (error) {
		return !(error as Error).message.startsWith('No sync engine registered')
	}
}

describe('sync engine registry', () => {
	it('covers every provider whose class delegates its sync/CRUD to an engine', async () => {
		for (const integration of [new CalDAV(), new GoogleCalendar(), new AppleCalendar(), new Tempo()]) {
			assert.equal(await resolvesAnEngine(integration), true, `${integration.type} has no registered engine`)
		}
	})

	it('leaves the providers that implement their own sync alone', async () => {
		for (const integration of [new Notion(), new Dev()]) {
			assert.equal(await resolvesAnEngine(integration), true, `${integration.type} should not depend on the registry`)
		}
	})
})
