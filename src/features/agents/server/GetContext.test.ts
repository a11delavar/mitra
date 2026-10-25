import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from '#features/time/TimeZone.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { SetDefaultCalendar } from '#features/identity/server/SetDefaultCalendar.js'
import { SaveSettings } from '#features/identity/server/SaveSettings.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

interface Context {
	readonly homeTimeZone: string
	readonly now: string
	readonly locale: string
	readonly calendar: string
	readonly weekStart: string
	readonly weekend: Array<string>
	readonly today: { readonly date: string, readonly label: string }
	readonly calendars: Array<{ name: string, defaultFor: Array<string>, holdsTypes: Array<string>, can: { create: boolean } }>
}

describe('GetContext', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names the home zone, and the calendars with what each holds and the types each takes when no calendar is named', async () => {
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await SetDefaultCalendar.call({ sourceId: work.id })
		const context = await server.tool<Context>('get_context')
		assert.equal(context.homeTimeZone, 'Europe/Berlin')
		assert.match(context.now, /[+-]\d{2}:\d{2}$/)
		assert.deepEqual(context.calendars.map(calendar => [calendar.name, calendar.defaultFor, calendar.holdsTypes, calendar.can.create]), [
			['Home', [], ['event', 'task', 'availability'], true],
			['Work', ['event', 'task', 'availability'], ['event', 'task', 'availability'], true],
		])
	})

	it('says how the user reads dates, by the language and region chosen in the settings', async () => {
		await SaveSettings.call({ settings: { locale: 'fa-IR' } })
		const context = await server.tool<Context>('get_context')
		assert.deepEqual([context.locale, context.calendar, context.weekStart, context.weekend], ['fa-IR', 'persian', 'saturday', ['friday']])
		assert.match(context.today.date, /^\d{4}-\d{2}-\d{2}$/)
		assert.match(context.today.label, /[۰-۹]/)
	})
})
