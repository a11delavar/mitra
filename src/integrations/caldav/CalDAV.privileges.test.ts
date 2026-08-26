import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from './CalDAV.js'
import { type Source } from '../../features/sources/Source.js'
// Discovery dispatches through `Integration`'s registry, as the running server does (see app/server.ts).
import '../server/registerEngines.js'

// Tests for WebDAV ACL privilege parsing (RFC 3744) and read-only collection detection.

const privileges = (...names: Array<string>) => ({ privilege: names.map(name => ({ [name]: {} })) })

describe('CalDAV write privileges', () => {
	it('reads any write privilege as writable', () => {
		for (const name of ['d:write', 'd:write-content', 'd:bind', 'd:all']) {
			assert.equal(CalDAV.writableFromPrivileges(privileges('d:read', name)), true, name)
		}
	})

	it('reads a set naming only reads as a read-only share', () => {
		assert.equal(CalDAV.writableFromPrivileges(privileges('d:read', 'd:read-acl', 'd:read-current-user-privilege-set')), false)
	})

	it('ignores whichever prefix the server bound to the DAV namespace', () => {
		assert.equal(CalDAV.writableFromPrivileges(privileges('D:write')), true)
		assert.equal(CalDAV.writableFromPrivileges({ privilege: { write: {} } }), true, 'a lone privilege arrives unwrapped')
	})

	it('answers "unknown" for a server that never mentioned privileges', () => {
		assert.equal(CalDAV.writableFromPrivileges(undefined), undefined)
		assert.equal(CalDAV.writableFromPrivileges(null), undefined)
		assert.equal(CalDAV.writableFromPrivileges({}), undefined, 'a shape this parse did not expect must not lock a calendar')
		assert.equal(CalDAV.writableFromPrivileges('nonsense'), undefined)
	})
})

describe('CalDAV discovery marks a shared calendar read-only', () => {
	it('only for a definite refusal — never for a server that stayed quiet', async () => {
		const dav = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			fetchCalendars: () => Promise.resolve([
				{ url: 'https://dav/mine/', displayName: 'Mine', components: ['VEVENT'], projectedProps: { currentUserPrivilegeSet: privileges('d:read', 'd:write') } },
				{ url: 'https://dav/shared/', displayName: 'Shared with me', components: ['VEVENT'], projectedProps: { currentUserPrivilegeSet: privileges('d:read') } },
				{ url: 'https://dav/quiet/', displayName: 'No ACL support', components: ['VEVENT'] },
			]),
			fetchCalendarUserAddresses: () => Promise.resolve([]),
		})

		const sources = await (dav as unknown as { fetchSources(): Promise<Array<Source>> }).fetchSources()

		assert.deepEqual(sources.map(source => [source.name, source.readOnly]), [
			['Mine', null],
			['Shared with me', true],
			['No ACL support', null],
		])
	})

	it('asks for the privilege set alongside everything tsdav reads by default', async () => {
		let asked: { props?: Record<string, unknown>, projectedProps?: Record<string, boolean> } | undefined
		const dav = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			fetchCalendars: (params: typeof asked) => { asked = params; return Promise.resolve([]) },
			fetchCalendarUserAddresses: () => Promise.resolve([]),
		})
		await (dav as unknown as { fetchSources(): Promise<Array<Source>> }).fetchSources()

		// Custom props REPLACE tsdav's defaults, so dropping one here would quietly cost every calendar
		// its display name, colour or component set.
		assert.deepEqual(Object.keys(asked?.props ?? {}).sort(), [
			'c:calendar-description', 'c:calendar-timezone', 'c:supported-calendar-component-set',
			'ca:calendar-color', 'cs:getctag', 'd:current-user-privilege-set', 'd:displayname',
			'd:resourcetype', 'd:sync-token',
		])
		assert.deepEqual(asked?.projectedProps, { currentUserPrivilegeSet: true })
	})
})
