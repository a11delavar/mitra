import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Source } from '#features/sources'
import '#integrations/server/registerEngines.js'
import { CalDAV } from './CalDAV.js'

describe('CalDAV source discovery lists the calendars of the address given', () => {
	const discover = (uri: string, listing: Array<{ href: string, props?: Record<string, unknown> }> | Error) => {
		const asked = { propfind: new Array<string>(), homes: new Array<string | undefined>() }
		const dav = new CalDAV({ uri, credentials: { username: 'user1', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			propfind: ({ url }: { url: string }) => {
				asked.propfind.push(url)
				return listing instanceof Error ? Promise.reject(listing) : Promise.resolve(listing)
			},
			fetchCalendars: ({ account }: { account?: { homeUrl: string } }) => {
				asked.homes.push(account?.homeUrl)
				return Promise.resolve([])
			},
			fetchCalendarUserAddresses: () => Promise.resolve([]),
		})
		return (dav as unknown as { fetchSources(): Promise<Array<Source>> }).fetchSources().then(() => asked)
	}

	it('reads another user\'s principal as its home set, not the login\'s own', async () => {
		const asked = await discover('https://dav/user2', [
			{ href: '/user2/', props: { calendarHomeSet: { href: '/calendars/user2/' }, resourcetype: { principal: {}, collection: {} } } },
		])
		assert.deepEqual(asked.homes, ['https://dav/calendars/user2/'])
	})

	it('reads an address holding calendars as the home itself', async () => {
		const asked = await discover('https://dav/calendars/user2/', [
			{ href: '/calendars/user2/', props: { resourcetype: { collection: {} } } },
			{ href: '/calendars/user2/pro/', props: { resourcetype: { collection: {}, calendar: {} } } },
		])
		assert.deepEqual(asked.homes, ['https://dav/calendars/user2/'])
	})

	it('lists the login\'s own calendars where the address names no one', async () => {
		assert.deepEqual(await discover('https://dav/', []), { propfind: [], homes: [undefined] }, 'a bare host is never asked')
		assert.deepEqual((await discover('https://dav/remote.php/dav', [{ href: '/remote.php/dav/', props: { resourcetype: { collection: {} } } }])).homes, [undefined])
		assert.deepEqual((await discover('https://dav/user2', new Error('403 Forbidden'))).homes, [undefined])
	})
})
