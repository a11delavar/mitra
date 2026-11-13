import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Source } from '#features/sources'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { Recurrence, RecurrenceFrequency, EntryOccurrenceChangeScope } from '#features/recurrence'
import { shown, viewIn, zones } from '#features/entries/server/viewers.testing.js'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { UpdateEntry } from '#features/entries/server/UpdateEntry.js'
import { UpdateEntryOccurrence } from '#features/entries/server/UpdateEntryOccurrence.js'
import { CompleteTask } from '#features/entries/server/CompleteTask.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { MigrateSource } from '#features/migration/server/MigrateSource.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { orm } from '#infrastructure/database/orm.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { RoutineRecognition } from './RoutineRecognition.js'

describe('RoutineRecognition', () => {
	const start = new DateTime('2026-03-02T07:00:00.000Z')

	let server: OperationServer
	before(async () => {
		server = await OperationServer.start()
		viewIn(zones.berlin)
	})
	after(() => server.close())

	const create = (entry: Entry) => CreateEntry.call(EntryPatch.creating(entry))
	const recurring = (heading: string, recurrence: Recurrence, init: Partial<Entry> = {}) => create(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ minutes: 30 }), recurrence, ...init }))
	const once = (heading: string, at: DateTime, init: Partial<Entry> = {}) => create(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start: at, end: at.add({ hours: 1 }), ...init }))
	const routineOf = async (id: string) => (await server.query<{ routine_id: string | null }>('select routine_id from entry where id = ?', [id]))[0]?.routine_id ?? undefined
	const calendarOf = async (routineId: string | undefined) => (await server.query<{ source_id: string }>('select source_id from routine where id = ?', [routineId]))[0]?.source_id
	const rule = (freq: RecurrenceFrequency, init: Partial<Recurrence> = {}) => new Recurrence({ freq, ...init })

	/** Written past the operations, as a sync writes. */
	const persisted = async (...entities: Array<object>) => {
		const em = orm.em.fork()
		em.persist(entities)
		await em.flush()
	}

	it('founds one for a recurring entry at any frequency, but none for a rule ending before four dates', async () => {
		assert.ok(await routineOf((await recurring('Stretch', rule(RecurrenceFrequency.Daily))).id!))
		assert.ok(await routineOf((await recurring('Birthday', rule(RecurrenceFrequency.Yearly))).id!))
		assert.equal(await routineOf((await recurring('Accounting', rule(RecurrenceFrequency.Weekly, { count: 3 }))).id!), undefined)
	})

	it('founds none for a rule ending before four dates, by its count or by its last day', async () => {
		assert.equal(await routineOf((await recurring('Audit', Recurrence.fromRRule('FREQ=WEEKLY;UNTIL=20260316T080000Z')!)).id!), undefined)
		assert.ok(await routineOf((await recurring('Inventory', Recurrence.fromRRule('FREQ=WEEKLY;UNTIL=20260324T080000Z')!)).id!))
	})

	it('counts the dates of a rule that ends with those of the entries wearing its title', async () => {
		const series = await recurring('Climbing', rule(RecurrenceFrequency.Daily, { count: 3 }))
		assert.equal(await routineOf(series.id!), undefined)
		const fourth = await once('climbing', start.add({ days: 9 }))
		assert.ok(await routineOf(fourth.id!))
		assert.equal(await routineOf(series.id!), await routineOf(fourth.id!))
	})

	it('lets a repeating entry without a title found a routine alone, which no other blank one joins', async () => {
		assert.ok(await routineOf((await recurring('', rule(RecurrenceFrequency.Daily))).id!))
		assert.equal(await routineOf((await once(' ', start.add({ days: 1 }))).id!), undefined)
	})

	it('founds one for entries that come rarely but keep their cadence, none where they fall anywhere', async () => {
		const taxes = new Array<string>()
		for (const days of [0, 362, 731, 1094]) {
			taxes.push((await once('Taxes', start.add({ days }))).id!)
		}
		assert.ok(await routineOf(taxes[0]!))
		assert.equal(new Set(await Promise.all(taxes.map(routineOf))).size, 1)
		const lunches = new Array<string>()
		for (const days of [0, 400, 600, 1100, 1500]) {
			lunches.push((await once('Lunch with a friend', start.add({ days }))).id!)
		}
		assert.deepEqual(await Promise.all(lunches.map(routineOf)), [undefined, undefined, undefined, undefined, undefined])
	})

	it('follows the latest member where two routines wear one title', async () => {
		const series = await recurring('Yoga', rule(RecurrenceFrequency.Weekly))
		const later = await once('Yoga', start.add({ days: 50 }))
		await server.query('insert into routine (id, source_id) values (?, ?)', ['yoga-elsewhere', server.source.id])
		await server.query('update entry set routine_id = ? where id = ?', ['yoga-elsewhere', later.id])
		assert.equal(await routineOf((await once('yoga', start.add({ days: 60 }))).id!), 'yoga-elsewhere')
		assert.notEqual(await routineOf(series.id!), 'yoga-elsewhere')
	})

	it('founds one once four one-off entries come about every five weeks, never at three, and later ones join it', async () => {
		const cuts = new Array<string>()
		for (const index of [0, 1, 2]) {
			cuts.push((await once('Haircut', start.add({ days: index * 35 }))).id!)
		}
		assert.deepEqual(await Promise.all(cuts.map(routineOf)), [undefined, undefined, undefined])
		cuts.push((await once('haircut ', start.add({ days: 3 * 35 }))).id!)
		const routines = new Set(await Promise.all(cuts.map(routineOf)))
		assert.equal(routines.size, 1)
		assert.ok([...routines][0])
		// However late the next one comes: joining asks nothing of the dates.
		assert.equal(await routineOf((await once('Haircut', start.add({ days: 400 }))).id!), [...routines][0])
	})

	it('tells titles together in any script, which the database\'s own folding would not', async () => {
		const ids = new Array<string>()
		for (const [index, heading] of ['Übung', 'ÜBUNG', 'übung', ' Übung'].entries()) {
			ids.push((await once(heading, start.add({ days: index * 2 }))).id!)
		}
		const routines = new Set(await Promise.all(ids.map(routineOf)))
		assert.equal(routines.size, 1)
		assert.ok([...routines][0])
	})

	it('pools twin recurring entries of one title in one calendar, and keeps another calendar\'s apart', async () => {
		const away = await CreateSource.call({ id: server.integration.id, name: 'Away' })
		const morning = await recurring('Pills', rule(RecurrenceFrequency.Daily))
		const evening = await recurring('Pills', rule(RecurrenceFrequency.Daily), { start: start.add({ hours: 12 }), end: start.add({ hours: 12, minutes: 5 }) })
		const elsewhere = await recurring('Pills', rule(RecurrenceFrequency.Daily), { sourceId: away.id })
		assert.equal(await routineOf(evening.id!), await routineOf(morning.id!))
		assert.notEqual(await routineOf(elsewhere.id!), await routineOf(morning.id!))
		assert.equal(await calendarOf(await routineOf(elsewhere.id!)), away.id)
	})

	it('keeps every occurrence ticked off a daily task in its routine, as rows of their own', async () => {
		const task = await recurring('Morning meds', rule(RecurrenceFrequency.Daily), { type: EntryType.Task })
		const id = await routineOf(task.id!)
		for (let day = 0; day < 12; day++) {
			await CompleteTask.call({ id: task.id!, occurrence: start.add({ days: day }) })
		}
		const rows = await server.query<{ routine_id: string | null, status: string }>('select routine_id, status from entry where heading = ? and id != ?', ['Morning meds', task.id])
		assert.equal(rows.length, 12)
		assert.deepEqual(new Set(rows.map(row => [row.routine_id, row.status].join())), new Set([`${id},done`]))
	})

	it('keeps an entry in its routine when it is renamed, and then joins others by the new title too', async () => {
		const series = await recurring('Gym', rule(RecurrenceFrequency.Daily, { interval: 2 }))
		const id = await routineOf(series.id!)
		series.heading = 'Strength training'
		await UpdateEntry.call({ ...EntryPatch.of(series, ['heading']), id: series.id! })
		assert.equal(await routineOf(series.id!), id)
		assert.equal(await routineOf((await once('strength training', start.add({ days: 1 }))).id!), id)
	})

	it('keeps an occurrence moved out of its recurring entry in the routine, even under another title', async () => {
		const { id } = await recurring('Volleyball', rule(RecurrenceFrequency.Weekly))
		const [, second] = (await shown('2026-03-01', '2026-03-20')).filter(occurrence => occurrence.recurringEntryId === id)
		const edited = second!.override()
		edited.heading = 'Volleyball tournament'
		const occurrence = second!.recurringEntry!.occurrences.overriddenBy(edited)
		const detached = await UpdateEntryOccurrence.call({ ...EntryPatch.of(occurrence.entry, EntryPatch.occurrence), id: id!, occurrence: occurrence.storedRecurrenceId!, scope: EntryOccurrenceChangeScope.This })
		assert.equal(await routineOf(detached.id!), await routineOf(id!))
	})

	it('puts an entry wearing a dissolved routine\'s title into it, where it stays out of sight', async () => {
		const first = await recurring('Lunch walk', rule(RecurrenceFrequency.Daily))
		const id = await routineOf(first.id!)
		await server.query('update routine set dissolved = 1 where id = ?', [id])
		assert.equal(await routineOf((await once('Lunch walk', start.add({ days: 3 }))).id!), id)
	})

	it('leaves an entry taken out of every routine in none, whatever is written beside it', async () => {
		const series = await recurring('Reading', rule(RecurrenceFrequency.Daily))
		const declined = await once('Reading', start.add({ days: 1 }))
		await server.query('update entry set routine_id = null, routine_declined = 1 where id = ?', [declined.id])
		declined.heading = 'reading'
		await UpdateEntry.call({ ...EntryPatch.of(declined, ['heading']), id: declined.id! })
		await once('Reading', start.add({ days: 2 }))
		assert.equal(await routineOf(declined.id!), undefined)
		assert.ok(await routineOf(series.id!))
	})

	it('recognizes a copy in its new calendar by its title, rather than taking the original\'s routine', async () => {
		const origin = await CreateSource.call({ id: server.integration.id, name: 'Origin' })
		const target = await CreateSource.call({ id: server.integration.id, name: 'Target' })
		const original = await recurring('Choir', rule(RecurrenceFrequency.Weekly), { sourceId: origin.id })
		await MigrateSource.call({ id: origin.id, targetSourceId: target.id, flatten: false, keepOriginals: true })
		const [copy] = await server.query<{ id: string, routine_id: string }>('select id, routine_id from entry where source_id = ?', [target.id])
		assert.ok(copy!.routine_id)
		assert.notEqual(copy!.routine_id, await routineOf(original.id!))
		assert.equal(await calendarOf(copy!.routine_id), target.id)
	})

	it('takes its routine along when it moves to another calendar', async () => {
		const origin = await CreateSource.call({ id: server.integration.id, name: 'Before' })
		const target = await CreateSource.call({ id: server.integration.id, name: 'After' })
		const original = await recurring('Piano', rule(RecurrenceFrequency.Daily), { sourceId: origin.id })
		const id = await routineOf(original.id!)
		await MigrateSource.call({ id: origin.id, targetSourceId: target.id, flatten: false, keepOriginals: false })
		const [moved] = await server.query<{ routine_id: string }>('select routine_id from entry where source_id = ?', [target.id])
		assert.equal(moved!.routine_id, id)
		assert.equal(await calendarOf(id), target.id)
	})

	describe('an override, as a sync stores another app\'s', () => {
		const event = (heading: string, init: Partial<Entry> = {}) => new Entry({ id: crypto.randomUUID(), sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ hours: 1 }), ...init })
		const overriding = (series: Entry, heading: string) => event(heading, { start: start.add({ days: 1 }), end: start.add({ days: 1, hours: 1 }), recurringEntryId: series.id, recurrenceId: start.add({ days: 1 }) })

		it('stays out where its recurring entry is in no routine, even wearing a routine\'s title', async () => {
			await recurring('Tennis', rule(RecurrenceFrequency.Weekly))
			const audit = event('Audit of the year', { recurrence: rule(RecurrenceFrequency.Weekly, { count: 2 }) })
			const override = overriding(audit, 'Tennis')
			await persisted(audit, override)
			assert.deepEqual([await routineOf(audit.id!), await routineOf(override.id!)], [undefined, undefined])
		})

		it('goes along when its recurring entry is founded into a routine later', async () => {
			const series = event('Rowing', { recurrence: rule(RecurrenceFrequency.Daily, { count: 3 }) })
			const override = overriding(series, 'Rowing on the lake')
			await persisted(series, override)
			assert.deepEqual([await routineOf(series.id!), await routineOf(override.id!)], [undefined, undefined])
			const fourth = await routineOf((await once('Rowing', start.add({ days: 9 }))).id!)
			assert.ok(fourth)
			assert.deepEqual([await routineOf(series.id!), await routineOf(override.id!)], [fourth, fourth])
		})
	})

	describe('in calendars and of kinds it leaves alone', () => {
		it('recognizes nothing in a calendar that can only be read, as a sync fills it', async () => {
			const feed = new Source({ integrationId: server.integration.id, uri: 'mitra://local/feed', name: 'Feed', entryTypes: [EntryType.Event], enabled: true, hidden: false, readOnly: true })
			const bins = new Entry({ id: crypto.randomUUID(), sourceId: feed.id, type: EntryType.Event, heading: 'Bin day', start, end: start.add({ hours: 1 }), recurrence: rule(RecurrenceFrequency.Weekly) })
			await persisted(feed, bins)
			assert.equal(await routineOf(bins.id!), undefined)
			// Nor does what it holds count towards a routine of another calendar.
			assert.equal(await routineOf((await once('Bin day', start.add({ days: 1 }))).id!), undefined)
		})

		it('passes over availability, whatever it repeats at', async () => {
			const hours = new Entry({ id: crypto.randomUUID(), sourceId: server.source.id, type: EntryType.Availability, heading: 'Office hours', start, end: start.add({ hours: 8 }), recurrence: rule(RecurrenceFrequency.Daily) })
			await persisted(hours)
			assert.equal(await routineOf(hours.id!), undefined)
		})
	})

	describe('founds', () => {
		const berlin = TimeZone.of('Europe/Berlin')
		const on = (days: number, init: Partial<Entry> = {}) => new Entry({ heading: 'Run', start: start.add({ days }), ...init })
		const founds = (...entries: Array<Entry>) => RoutineRecognition.founds(entries, berlin)

		it('takes four dates between the entries, whoever has them', () => {
			assert.equal(founds(on(0), on(2), on(4)), false)
			assert.equal(founds(on(0), on(2), on(4), on(6)), true)
			assert.equal(founds(on(0, { recurrence: rule(RecurrenceFrequency.Daily, { count: 3 }) })), false)
			assert.equal(founds(on(0, { recurrence: rule(RecurrenceFrequency.Daily, { count: 3 }) }), on(9)), true)
			assert.equal(founds(on(0, { start: undefined }), on(2), on(4), on(6)), false)
		})

		it('takes any entry that repeats, however rarely', () => {
			assert.equal(founds(on(0, { recurrence: rule(RecurrenceFrequency.Yearly) })), true)
		})

		it('takes entries of their own that would collapse in the year view', () => {
			assert.equal(founds(on(0), on(35), on(70), on(105)), true)
			assert.equal(founds(on(0), on(40), on(95), on(160)), false)
		})

		it('takes entries of their own that come rarely but keep their cadence', () => {
			assert.equal(founds(on(0), on(362), on(731), on(1094)), true)
			assert.equal(founds(on(0), on(400), on(600), on(1100), on(1500)), false)
		})

		it('counts the days where the person is at home: four late evenings in Berlin are four days, in whatever zone the server is', () => {
			// Two before and two after midnight UTC, on four Berlin days a week apart each.
			const late = [0, 7, 14, 21].map(days => on(days, { start: new DateTime('2026-03-02T22:30:00Z').add({ days }) }))
			assert.deepEqual(late.map(entry => String(entry.occurrences.single.dayIn(berlin))), ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'])
			assert.equal(founds(...late), true)
		})
	})
})
