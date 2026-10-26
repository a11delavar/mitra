import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EntryType } from '#features/entries'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { IcsSubscription } from '#integrations/ics/IcsSubscription.js'
import { Calendars } from './Calendars.js'
import { Source } from '../Source.js'

const source = (id: string, init: Partial<Source> = {}) =>
	new Source({ id, uri: `calendar/${id}`, name: id, entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false, ...init })

describe('Calendars', () => {
	let local: MitraCalendar
	let feed: IcsSubscription

	beforeEach(() => {
		local = new MitraCalendar({ id: 'local', order: 1, uri: 'mitra://local' })
		local.sources = [source('work', { integrationId: 'local', order: 2 }), source('home', { integrationId: 'local', order: 1 }), source('archive', { integrationId: 'local', enabled: false, order: 3 }), source('hidden', { integrationId: 'local', hidden: true, order: 4 })] as never
		feed = new IcsSubscription({ id: 'feed', order: 0, uri: 'https://example.com/holidays.ics' })
		feed.sources = [source('holidays', { integrationId: 'feed', readOnly: true, entryTypes: [EntryType.Event] })] as never
		Calendars.adopt([local, feed])
	})

	it('keeps the integrations and their sources in the user\'s order', () => {
		assert.deepEqual(Calendars.integrations.map(integration => integration.id), ['feed', 'local'])
		assert.deepEqual(Calendars.sources.map(source => source.id), ['holidays', 'home', 'work', 'archive', 'hidden'])
	})

	it('tells where entries can live from what is shown, hidden calendars holding entries too', () => {
		assert.deepEqual(Calendars.enabled.map(source => source.id), ['holidays', 'home', 'work', 'hidden'])
		assert.deepEqual(local.enabledSources.map(source => source.id), ['home', 'work', 'hidden'])
		assert.deepEqual(Calendars.visible.map(source => source.id), ['holidays', 'home', 'work'])
	})

	it('finds a source and the integration it belongs to', () => {
		assert.equal(Calendars.getSource('work')?.name, 'work')
		assert.equal(Calendars.getSource('work')?.integration, local)
		assert.equal(Calendars.getSource('gone'), undefined)
	})

	it('puts a new entry in the first visible calendar that can take and hold it, absent a default, never a read-only one', () => {
		assert.equal(Calendars.getPrimary()?.id, 'home')
		assert.equal(Calendars.getPrimary(EntryType.Task)?.id, 'home')
	})

	it('turns writes off for a read-only source', () => {
		assert.equal(Calendars.getSource('holidays')?.capabilities.entries.create, false)
		assert.equal(Calendars.getSource('work')?.capabilities.entries.create, true)
	})

	it('copies entries out where another calendar takes them, and moves them only where they can also be deleted', () => {
		assert.equal(Calendars.canCopyEntriesOut(Calendars.getSource('holidays')!), true)
		assert.equal(Calendars.canMoveEntriesOut(Calendars.getSource('holidays')!), false)
		assert.equal(Calendars.canMoveEntriesOut(Calendars.getSource('work')!), true)
	})

	it('reorders sources and integrations in place', async () => {
		await Calendars.reorderIntegrations(['local', 'feed']).catch(() => void 0)
		assert.deepEqual(Calendars.integrations.map(integration => integration.id), ['local', 'feed'])
		await Calendars.reorderSources(local, ['work', 'home', 'archive', 'hidden']).catch(() => void 0)
		assert.deepEqual([...local.sources].map(source => source.id), ['work', 'home', 'archive', 'hidden'])
	})
})
