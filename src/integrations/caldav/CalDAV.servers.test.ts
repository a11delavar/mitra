import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Api } from '@a11d/api'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { EntryFile, EntryFiles, Entry, EntryType } from '#features/entries'
import { User } from '#features/identity'
import { Source } from '#features/sources'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.ts'
import type { Integration } from '#integrations'
import { createEvent, createIntegration, deleteEvent, deleteIntegration, discoverSources, fetchEvents, fetchIntegrations, reimportIntegration, updateEvent, updateIntegration, uploadFile } from '#infrastructure/http/Api.ts'
import { HttpRecording } from '#infrastructure/http/HttpRecording.testing.ts'
import { CalDAV } from './CalDAV.ts'

/*
	A CalDAV account end to end as real servers answer it: discovery, connecting, the import, Mitra's writes landing upstream,
	upstream changes read back, entries moved in, and disconnecting. The same steps run once per recording in recordings/, each
	replaying what its server answered when it was made, so no run needs a server; a request the server never answered fails
	it. Record a server again, or a new one, with Docker (scripts/recordCalDAV.ts starts each with the accounts used here):

		npm run record:caldav -- nextcloud

	Each recording names the version of the server that answered it, which the steps' title shows.
	A new server also names where it keeps an account's calendars (`layouts`).
*/

const recordings = `${process.cwd()}/src/integrations/caldav/recordings`
// `<server>[@<version>]=<address>`: the server to record from, the version it runs, and its address.
const [source, upstream] = process.env.MITRA_TEST_CALDAV?.split(/=(.*)/) ?? []
const [recorded, recordedVersion] = source?.split('@') ?? []
const names = [...new Set([...readdirSync(recordings).filter(file => file.endsWith('.json')).map(file => file.slice(0, -'.json'.length)), ...recorded ? [recorded] : []])].sort()

/**
 * The address a user gives Mitra for each server, and where it keeps an account's calendars. What the recording script set up
 * besides: the address of another user's calendars the account may read (`elsewhere`), and a calendar that refuses to list
 * its changes (`unlisted`).
 */
const layouts: Record<string, { readonly uri: string, readonly calendars: (account: string) => string, readonly elsewhere?: string, readonly unlisted?: string }> = {
	baikal: { uri: '/dav.php', calendars: account => `/dav.php/calendars/${account}/`, elsewhere: '/dav.php/calendars/teammate/' },
	nextcloud: { uri: '/remote.php/dav', calendars: account => `/remote.php/dav/calendars/${account}/`, unlisted: 'Deck: Launch' },
	radicale: { uri: '', calendars: account => `/${account}/`, elsewhere: '/teammate/' },
}
/** The calendars the steps make; a server may give an account others of its own (Nextcloud's "Personal"). */
const ours = <T extends { name: string }>(sources: ReadonlyArray<T>) => sources.filter(source => ['Home', 'Work'].includes(source.name)).sort((a, b) => a.name.localeCompare(b.name))

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('A CalDAV account as real servers answer it', () => {
	let app: Server
	let user: User
	let entriesIn: (sourceId: string) => Promise<Array<{ id: string, heading: string }>>
	let persist: (...entities: Array<object>) => Promise<void>
	let closeOrm: () => Promise<void>
	let password = ''

	before(async () => {
		// Mitra writes an entry in the zone of the device that made it, a VTIMEZONE in the request: every run, the recording's included, is in one zone.
		process.env.TZ = 'Europe/Berlin'
		const { orm } = await import('#infrastructure/database/orm.ts')
		await import('#integrations/server/registerEngines.ts')
		const { staleTabs } = await import('#features/entries/server/staleTabs.ts')
		const { operationsRouter } = await import('#infrastructure/operations/Operation.ts')
		await import('#app/operations.ts')
		const { fileContentRouter, filesRouter } = await import('#features/files/server/files.ts')
		const { observeInstanceOrigin } = await import('#infrastructure/http/instanceUrl.ts')

		const connection = orm.em.getConnection()
		entriesIn = sourceId => connection.execute('select id, heading from entry where source_id = ?', [sourceId])
		persist = async (...entities) => {
			const em = orm.em.fork()
			em.persist(entities)
			await em.flush()
		}
		closeOrm = () => orm.close()

		const models = new ModelValueConstructor()
		const routes = express()
		routes.use((req, _res, next) => {
			req.user = user
			next()
		})
		// As server.ts has it: written links take the address requests arrive at, and uploads come before the JSON parser.
		routes.use(observeInstanceOrigin)
		routes.use('/api/files', fileContentRouter([EntryFile]))
		routes.use('/api/files', filesRouter)
		routes.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		routes.use('/api/entries', staleTabs)
		routes.use('/api', operationsRouter(() => orm.em.fork()))
		app = await new Promise<Server>(resolve => {
			const listening = routes.listen(0, () => resolve(listening))
		})
		Api.url = `http://localhost:${(app.address() as AddressInfo).port}/api`
		// @a11d/api sets `referrer: 'no-referrer'`, which a browser resolves against the page and Node's fetch refuses. And this
		// process is built as the server, whose `withheld` blanks the password a browser sends: it goes back on the request.
		const browserFetch = globalThis.fetch
		globalThis.fetch = (input, init) => browserFetch(input, {
			...init,
			referrer: undefined,
			body: typeof init?.body === 'string' && String(input instanceof Request ? input.url : input).startsWith(Api.url)
				? init.body.replaceAll('"password":""', `"password":${JSON.stringify(password)}`)
				: init?.body,
		})
	})

	after(async () => {
		if (app) {
			await new Promise(resolve => app.close(resolve))
			await closeOrm()
		}
	})

	for (const name of names) {
		let placeholders: Record<string, string> = {}
		// A file's id, as its address and an ATTACH line name it.
		const recording = new HttpRecording(`${recordings}/${name}.json`, () => placeholders, { ids: [/(?<=\/api\/files\/)[\w-]{22}(?=\/)/g] })
		const address = name === recorded && upstream ? new URL(upstream) : undefined
		const version = address ? recordedVersion : recording.version
		describe(version ? `${name} ${version}` : name, () => {
			const from = address ? `${address.origin}${address.pathname}`.replace(/\/+$/, '') : undefined
			// A fresh account per recording keeps runs apart on a server that keeps its data; the recording stores it as a placeholder.
			const account = !from ? `mitra-test-${name}` : address!.username ? decodeURIComponent(address!.username) : `mitra-test-${Math.random().toString(36).slice(2, 10)}`
			const secret = address?.password ? decodeURIComponent(address.password) : 'secret'
			const authorization = `Basic ${btoa(`${account}:${secret}`)}`
			let server: string
			let stopServer: () => Promise<void>
			let unrecorded: () => ReadonlyArray<string> = () => []
			let local: Source
			const collection = (calendar: string) => `${server}${layouts[name]!.calendars(account)}${calendar}/`

			/** The server itself, as another client reads and writes it. */
			const dav = (method: string, url: string, body?: string, headers: Record<string, string> = {}) =>
				fetch(url, { method, body, headers: { authorization, ...headers } })
			const makeCalendar = (calendar: string, displayName: string) => dav('MKCALENDAR', collection(calendar), `<?xml version="1.0" encoding="utf-8"?>
				<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:set><D:prop>
					<D:displayname>${displayName}</D:displayname>
					<C:supported-calendar-component-set><C:comp name="VEVENT"/><C:comp name="VTODO"/></C:supported-calendar-component-set>
				</D:prop></D:set></C:mkcalendar>`, { 'content-type': 'application/xml' })
			/** Writes an event as another app does, its text escaped as RFC 5545 has it. */
			const putEvent = async (calendar: string, uid: string, summary: string, day: number, ...lines: Array<string>) => {
				const response = await dav('PUT', `${collection(calendar)}${uid}.ics`, [
					'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//another app//EN', 'BEGIN:VEVENT', `UID:${uid}`, 'DTSTAMP:20261001T000000Z',
					`DTSTART:202610${day}T090000Z`, `DTEND:202610${day}T100000Z`, `SUMMARY:${summary.replace(/[,;\\]/g, '\\$&')}`, ...lines, 'END:VEVENT', 'END:VCALENDAR',
				].join('\r\n'), { 'content-type': 'text/calendar' })
				assert.ok(response.ok, `the server refused ${uid}: ${response.status}`)
			}
			/** The calendar's resources as the server holds them. */
			const resources = async (calendar: string) => {
				const listing = await (await dav('PROPFIND', collection(calendar), undefined, { depth: '1' })).text()
				const hrefs = [...listing.matchAll(/<(?:\w+:)?href>([^<]+\.ics)<\/(?:\w+:)?href>/g)].map(match => match[1]!)
				return Promise.all(hrefs.map(async href => (await dav('GET', new URL(href, server).href)).text()))
			}
			/** The calendar's titles, unfolded and unescaped. */
			const summaries = async (calendar: string) => (await resources(calendar))
				.map(ics => /^SUMMARY:(.*)$/m.exec(ics.replace(/\r?\n[ \t]/g, ''))?.[1]?.trim().replace(/\\([,;\\])/g, '$1'))
				.sort()

			const until = async (condition: () => Promise<boolean>, ms = 15_000) => {
				const deadline = Date.now() + ms
				while (!await condition()) {
					if (Date.now() > deadline) {
						throw new Error('Timed out')
					}
					await sleep(150)
				}
			}
			const headings = async (sourceId: string) => (await entriesIn(sourceId)).map(entry => entry.heading).sort()

			before(async () => {
				if (from) {
					const proxy = await recording.record(from, version)
					server = proxy.origin
					stopServer = proxy.close
				} else {
					const replay = await recording.replay()
					server = replay.origin
					stopServer = replay.close
					unrecorded = () => replay.unrecorded
				}
				placeholders = { server, upstream: from ?? server, account, app: Api.url.replace(/\/api$/, '') }
				password = secret

				// An account kept from an earlier recording still holds what that run left.
				await dav('DELETE', collection('work'))
				await dav('DELETE', collection('home'))
				assert.equal((await makeCalendar('work', 'Work')).status, 201)
				assert.equal((await makeCalendar('home', 'Home')).status, 201)
				await putEvent('work', 'standup', 'Standup', 20)
				await putEvent('home', 'dentist', 'Dentist', 21)

				user = new User({ username: account })
				const mitra = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
				local = new Source({ integrationId: mitra.id, uri: MitraCalendar.sourceUri('local'), name: 'Local', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false })
				await persist(user, mitra, local)
			})

			after(async () => {
				await stopServer?.()
			})

			const credentials = { username: account, password: secret }
			const uri = () => `${server}${layouts[name]!.uri}`
			let integration: Integration
			const calendar = (calendarName: string) => integration.sources.find(source => source.name === calendarName)!

			it('discovers the account\'s calendars by their names', async () => {
				const discovered = await discoverSources(new CalDAV({ uri: uri(), credentials }))
				assert.deepEqual(ours(discovered).map(source => source.name), ['Home', 'Work'])
				assert.ok(discovered.every(source => source instanceof Source))
			})

			it('lists the calendars of another user\'s address the server shares, not the account\'s own', { skip: !layouts[name]?.elsewhere && 'the server shares none by address' }, async () => {
				const discovered = await discoverSources(new CalDAV({ uri: `${server}${layouts[name]!.elsewhere}`, credentials }))
				assert.deepEqual(discovered.map(source => source.name), ['Team'])
			})

			it('connects with the calendars chosen and imports only theirs', async () => {
				const discovered = await discoverSources(new CalDAV({ uri: uri(), credentials }))
				integration = await createIntegration(new CalDAV({ uri: uri(), credentials, sources: discovered.map(source => Object.assign(source, { enabled: source.name === 'Work' })) }))
				assert.deepEqual(ours(integration.sources).map(source => [source.name, source.enabled]), [['Home', false], ['Work', true]])
				await until(async () => (await headings(calendar('Work').id)).length === 1)
				assert.deepEqual(await headings(calendar('Work').id), ['Standup'])
				assert.deepEqual(await headings(calendar('Home').id), [])
			})

			it('writes an event made in Mitra into the calendar, and its edits after it', async () => {
				const start = new DateTime('2026-10-22T13:00:00Z')
				const created = await createEvent(new Entry({ sourceId: calendar('Work').id, type: EntryType.Event, heading: 'Planning', start, end: start.add({ hours: 1 }) }))
				assert.deepEqual(await summaries('work'), ['Planning', 'Standup'])

				created.heading = 'Planning, rescheduled'
				await updateEvent(created, ['heading'])
				assert.deepEqual(await summaries('work'), ['Planning, rescheduled', 'Standup'])
			})

			it('takes a calendar on, and edits the choice again at once from what the save answered', async () => {
				const withHome = integration.clone()
				ours(withHome.sources).forEach(source => source.enabled = true)
				const saved = await updateIntegration(withHome)
				assert.deepEqual(ours(saved.sources).map(source => source.enabled), [true, true])
				await until(async () => (await headings(calendar('Home').id)).length === 1)
				assert.deepEqual(await headings(calendar('Home').id), ['Dentist'])

				const again = saved.clone()
				assert.deepEqual(ours(again.sources).map(source => source.enabled), [true, true])
				const listed = (await fetchIntegrations()).find(each => each.id === integration.id)!
				assert.equal(listed.sources.length, integration.sources.length, 'editing never adds a calendar twice')
				integration = listed
			})

			it('reads what another app changed upstream once it imports again', async () => {
				await putEvent('work', 'standup', 'Standup, moved', 23)
				await reimportIntegration(integration.id)
				await until(async () => (await headings(calendar('Work').id)).includes('Standup, moved'))
				assert.deepEqual(await headings(calendar('Work').id), ['Planning, rescheduled', 'Standup, moved'])
			})

			it('imports a calendar that refuses to list its changes, as a Nextcloud Deck board does', { skip: !layouts[name]?.unlisted && 'the server keeps none' }, async () => {
				const board = calendar(layouts[name]!.unlisted!)
				const withBoard = integration.clone()
				withBoard.sources.find(source => source.name === board.name)!.enabled = true
				integration = await updateIntegration(withBoard)
				await until(async () => (await headings(board.id)).length === 2)
				assert.deepEqual(await headings(board.id), ['List : To do', 'Write the announcement'])
			})

			it('moves an entry from a calendar Mitra keeps into the CalDAV calendar', async () => {
				const start = new DateTime('2026-10-24T08:00:00Z')
				const kept = await createEvent(new Entry({ sourceId: local.id, type: EntryType.Event, heading: 'Retro', start, end: start.add({ hours: 1 }) }))
				kept.sourceId = calendar('Home').id
				await updateEvent(kept, ['sourceId'])
				assert.deepEqual(await headings(local.id), [])
				assert.deepEqual(await headings(calendar('Home').id), ['Dentist', 'Retro'])
				assert.deepEqual(await summaries('home'), ['Dentist', 'Retro'])
			})

			it('deletes an entry upstream', async () => {
				const [retro] = (await entriesIn(calendar('Home').id)).filter(entry => entry.heading === 'Retro')
				await deleteEvent(retro!.id)
				assert.deepEqual(await summaries('home'), ['Dentist'])
			})

			describe('its files', () => {
				const october = new DateTimeRange(new DateTime('2026-10-01T00:00:00Z'), new DateTime('2026-11-01T00:00:00Z'))
				/** The entry as a fresh listing hands it to the browser. */
				const listed = async (heading: string) => (await fetchEvents(october)).find(entry => entry.heading === heading)!
				const resourceOf = async (calendarName: string, summary: string) =>
					(await resources(calendarName)).find(ics => ics.replace(/\r?\n[ \t]/g, '').includes(`SUMMARY:${summary}`))!.replace(/\r?\n[ \t]/g, '')
				const attachLines = (ics: string) => ics.split(/\r?\n/).filter(line => line.startsWith('ATTACH'))
				const upload = (fileName: string, content: string) => uploadFile(new globalThis.File([content], fileName, { type: 'text/plain' }))

				it('writes a file attached in Mitra as an ATTACH line whose address serves the file to any app', async () => {
					const file = await upload('agenda.txt', 'Agenda for the review')
					const start = new DateTime('2026-10-26T10:00:00Z')
					await createEvent(new Entry({ sourceId: calendar('Work').id, type: EntryType.Event, heading: 'Review', start, end: start.add({ hours: 1 }), attachments: EntryFiles.of([file]) }))
					const [line] = attachLines(await resourceOf('work', 'Review'))
					const url = /:(https?:\/\/.+)$/.exec(line!)?.[1]
					assert.match(url!, /^http:\/\/localhost:\d+\/api\/files\/[\w-]{22}\/agenda\.txt$/)
					const served = await fetch(url!)
					assert.equal(served.status, 200)
					assert.equal(await served.text(), 'Agenda for the review')
				})

				it('reads a file another app attached, and keeps its line byte for byte when Mitra edits the entry', async () => {
					await putEvent('work', 'kickoff', 'Kickoff', 27, 'ATTACH;FMTTYPE=application/pdf;FILENAME=deck.pdf;X-NC-FILE-ID=42:https://cloud.example.com/f/42')
					// As the server holds it, which may order a line's parameters its own way.
					const [line] = attachLines(await resourceOf('work', 'Kickoff'))
					assert.match(line!, /X-NC-FILE-ID=42/)
					await reimportIntegration(integration.id)
					await until(async () => (await headings(calendar('Work').id)).includes('Kickoff'))
					const kickoff = await listed('Kickoff')
					assert.deepEqual(kickoff.attachments.all.map(file => [file.name, file.sourceUrl]), [['deck.pdf', 'https://cloud.example.com/f/42']])

					kickoff.heading = 'Kickoff, renamed'
					await updateEvent(kickoff, ['heading'])
					assert.deepEqual(attachLines(await resourceOf('work', 'Kickoff\\, renamed')), [line])
				})

				it('takes a file\'s line off upstream once it is removed in Mitra', async () => {
					const review = await listed('Review')
					review.attachments = review.attachments.without(review.attachments.all[0]!)
					await updateEvent(review, ['files'])
					assert.deepEqual(attachLines(await resourceOf('work', 'Review')), [])
				})

				it('moves an entry with a file in, its line naming a file Mitra still serves once the original is gone', async () => {
					const file = await upload('notes.txt', 'Notes kept locally')
					const start = new DateTime('2026-10-28T15:00:00Z')
					const kept = await createEvent(new Entry({ sourceId: local.id, type: EntryType.Event, heading: 'Notes', start, end: start.add({ hours: 1 }), attachments: EntryFiles.of([file]) }))
					kept.sourceId = calendar('Home').id
					await updateEvent(kept, ['sourceId'])
					const [line] = attachLines(await resourceOf('home', 'Notes'))
					const served = await fetch(/:(https?:\/\/.+)$/.exec(line!)![1]!)
					assert.equal(served.status, 200)
					assert.equal(await served.text(), 'Notes kept locally')
				})
			})

			it('disconnects, leaving the server\'s calendars as they are', async () => {
				const work = calendar('Work').id
				await deleteIntegration(integration.id)
				assert.equal((await fetchIntegrations()).some(each => each.id === integration.id), false)
				assert.deepEqual(await entriesIn(work), [])
				assert.deepEqual(await summaries('work'), ['Kickoff, renamed', 'Planning, rescheduled', 'Review', 'Standup, moved'])
			})

			it('asked the server only what it answered when the recording was made', () => {
				assert.deepEqual(unrecorded(), [], 'Mitra asks the server something new since the recording: record again (see above)')
			})
		})
	}
})
