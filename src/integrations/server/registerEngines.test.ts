import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from '../caldav/CalDAV.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
import { AppleCalendar } from '../apple/AppleCalendar.js'
import { Notion } from '../notion/Notion.js'
import { Tempo } from '../tempo/Tempo.js'
import { Dev } from '../dev/Dev.js'
import './registerEngines.js'

// Registration is an IMPORT SIDE EFFECT, so a provider left out of registerEngines.ts type-checks
// perfectly and only fails at the first real sync — in production, against a real account. These pin
// the two halves of the contract: every provider that delegates has an engine, and every provider that
// implements its own doesn't need one.

/** The engine is reached lazily, so the cheapest probe of "is one registered" is to call a delegating
 * method with junk and read which error comes back: the registry's, or the engine's own validation. */
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
		// The first three speak the CalDAV protocol — Apple and Google are manifest-only subclasses, so
		// one engine serves them, but each discriminator still needs its own registry entry. Tempo has
		// its own engine, for two API clients that must stay off the browser bundle.
		for (const integration of [new CalDAV(), new GoogleCalendar(), new AppleCalendar(), new Tempo()]) {
			assert.equal(await resolvesAnEngine(integration), true, `${integration.type} has no registered engine`)
		}
	})

	it('leaves the providers that implement their own sync alone', async () => {
		// Notion (its own JSON REST engine) and the local-only Dev fixture override the methods on the
		// class, so they must resolve WITHOUT the registry — registering one for them would be dead code.
		for (const integration of [new Notion(), new Dev()]) {
			assert.equal(await resolvesAnEngine(integration), true, `${integration.type} should not depend on the registry`)
		}
	})
})
