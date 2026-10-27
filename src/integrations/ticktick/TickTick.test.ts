import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, TaskStatus } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { EntryRelations, RelationType } from '#features/relations'
import { EntryReminders } from '#features/reminders/EntryReminders.js'
import { Color } from '#features/sources'
import { TickTick, type TickTickTask } from './TickTick.js'

const BERLIN = 'Europe/Berlin'
const at = (iso: string) => new Date(iso) as never
const iso = (value: unknown) => (value as Date | undefined)?.toISOString()

const task = (init?: Partial<TickTickTask>): TickTickTask => ({
	id: 'task-1',
	projectId: 'project-1',
	title: 'Prepare the launch',
	content: 'Check the **final** list',
	kind: 'TEXT',
	isAllDay: false,
	isFloating: false,
	timeZone: BERLIN,
	priority: 5,
	tags: ['work'],
	status: 0,
	...init,
})

/** An entry as a sync would leave it, and a copy to edit, as a write receives both. */
const read = (init?: Partial<TickTickTask>) => {
	const existing = new Entry({ id: 'entry-1', sourceId: 'source-1' })
	TickTick.applyTask(existing, task(init), { zone: BERLIN })
	const incoming = existing.clone()
	incoming.relations = existing.relations
	return { existing, incoming }
}

const context = { zone: BERLIN, isTask: (uid: string) => uid.startsWith('task-') }

describe('TickTick dates', () => {
	it('reads a day as its midnight in the task\'s zone, the day TickTick shows', () => {
		const { existing } = read({ isAllDay: true, startDate: '2026-11-01T23:00:00.000+0000', dueDate: '2026-11-01T23:00:00.000+0000' })
		assert.deepEqual([existing.allDay, iso(existing.start), iso(existing.end)], [true, '2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'])
	})

	it('reads a time in its zone, and a floating one as Mitra floats one, its wall clock as if in UTC', () => {
		const { existing: zoned } = read({ startDate: '2026-11-04T14:00:00.000+0000', dueDate: '2026-11-04T14:00:00.000+0000', timeZone: 'America/New_York' })
		assert.deepEqual([iso(zoned.start), zoned.end, zoned.timeZone?.id], ['2026-11-04T14:00:00.000Z', undefined, 'America/New_York'])

		const { existing: floating } = read({ startDate: '2026-11-07T07:30:00.000+0000', dueDate: '2026-11-07T07:30:00.000+0000', isFloating: true })
		assert.deepEqual([iso(floating.start), floating.timeZone?.floating], ['2026-11-07T08:30:00.000Z', true])
	})

	it('reads one date as the schedule, a span\'s end aside, and none as unscheduled', () => {
		const { existing: span } = read({ startDate: '2026-11-04T09:00:00.000+0000', dueDate: '2026-11-04T11:00:00.000+0000' })
		assert.deepEqual([iso(span.start), span.end, span.due], ['2026-11-04T09:00:00.000Z', undefined, undefined])
		const { existing: none } = read()
		assert.deepEqual([none.start, none.allDay, none.timeZone], [undefined, false, undefined])
	})

	it('writes the schedule as both dates, a day at its midnight in the zone, a floating time with its flag', () => {
		const { incoming } = read()
		Object.assign(incoming, { allDay: true, start: at('2026-11-02T00:00:00Z'), end: at('2026-11-03T00:00:00Z'), timeZone: undefined })
		assert.deepEqual(TickTick.datesFrom(incoming, BERLIN), { isAllDay: true, isFloating: false, startDate: '2026-11-01T23:00:00+0000', dueDate: '2026-11-01T23:00:00+0000', timeZone: BERLIN })

		Object.assign(incoming, { allDay: false, start: at('2026-11-07T07:30:00Z'), end: undefined, timeZone: EntryTimeZone.floating })
		assert.deepEqual(TickTick.datesFrom(incoming, BERLIN), { isAllDay: false, isFloating: true, startDate: '2026-11-07T06:30:00+0000', dueDate: '2026-11-07T06:30:00+0000', timeZone: BERLIN })

		Object.assign(incoming, { start: at('2026-11-04T14:00:00Z'), timeZone: EntryTimeZone.parse('America/New_York') })
		assert.deepEqual(TickTick.datesFrom(incoming, BERLIN), { isAllDay: false, isFloating: false, startDate: '2026-11-04T14:00:00+0000', dueDate: '2026-11-04T14:00:00+0000', timeZone: 'America/New_York' })
	})

	it('reads back each kind of date as it was written', () => {
		for (const init of [
			{ isAllDay: true, startDate: '2026-11-01T23:00:00+0000' },
			{ isFloating: true, startDate: '2026-11-07T06:30:00+0000' },
			{ startDate: '2026-11-04T14:00:00+0000', timeZone: 'America/New_York' },
		]) {
			const { existing } = read({ ...init, dueDate: init.startDate })
			const written = TickTick.datesFrom(existing, BERLIN)
			const { existing: again } = read({ ...written, startDate: written.startDate, dueDate: written.dueDate })
			assert.deepEqual([iso(again.start), again.allDay, again.timeZone?.id], [iso(existing.start), existing.allDay, existing.timeZone?.id])
		}
	})
})

describe('TickTick reminders', () => {
	it('reads the minutes before the date, leaving out one after it', () => {
		assert.deepEqual(TickTick.remindersFrom(['TRIGGER:PT0S', 'TRIGGER:-PT15M', 'TRIGGER:-P1DT2H', 'TRIGGER:P0DT9H0M0S']), EntryReminders.normalize([0, 15, 1560]))
	})

	it('writes them as triggers, keeping one after the date as TickTick has it', () => {
		assert.deepEqual(TickTick.triggersFrom([0, 30], ['TRIGGER:P0DT9H0M0S', 'TRIGGER:-PT15M']), ['TRIGGER:PT0S', 'TRIGGER:-PT30M', 'TRIGGER:P0DT9H0M0S'])
	})

	it('holds none on a task without a date', () => {
		assert.equal(read({ reminders: ['TRIGGER:PT0S'] }).existing.reminders, undefined)
	})
})

describe('TickTick text', () => {
	const checklist = { kind: 'CHECKLIST' as const, content: undefined, desc: 'From the **market**', items: [{ id: 'item-1', title: 'Oat milk', status: 0, sortOrder: 0 }, { id: 'item-2', title: 'Bread', status: 1, sortOrder: 1 }] }

	it('reads a checklist\'s items as the description\'s checkboxes, below its text', () => {
		assert.equal(read(checklist).existing.description, 'From the **market**\n\n- [ ] Oat milk\n- [x] Bread')
	})

	it('writes the checkboxes back as its items, each keeping its id, and any other task\'s text whole', () => {
		assert.deepEqual(TickTick.textFrom('From the **market**\n\n- [x] Oat milk\n- [x] Bread\n- [ ] Eggs', checklist), {
			desc: 'From the **market**',
			items: [{ id: 'item-1', title: 'Oat milk', status: 1, sortOrder: 0 }, { id: 'item-2', title: 'Bread', status: 1, sortOrder: 1 }, { title: 'Eggs', status: 0, sortOrder: 2 }],
		})
		assert.deepEqual(TickTick.textFrom('- [ ] stays text', task()), { content: '- [ ] stays text' })
	})
})

describe('TickTick tasks', () => {
	it('reads open, done and won\'t do', () => {
		assert.deepEqual([0, 2, -1].map(status => read({ status }).existing.status), [TaskStatus.ToDo, TaskStatus.Done, TaskStatus.Cancelled])
	})

	it('reads a parent as a subtask\'s relation, keeping one beyond the account', () => {
		const stored = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'elsewhere' }, { type: RelationType.FinishToStart, targetUid: 'task-9' }])
		const relations = TickTick.relationsFrom({ parentId: 'task-2' }, stored, uid => uid.startsWith('task-'))
		assert.deepEqual(relations.writes.map(relation => relation.targetUid).sort(), ['elsewhere', 'task-2', 'task-9'])
		assert.deepEqual(relations.writes.filter(relation => relation.type === RelationType.Parent).map(relation => relation.targetUid).sort(), ['elsewhere', 'task-2'])
	})

	it('writes only what changed, so priority and tags stay as TickTick has them', () => {
		const { existing, incoming } = read({ startDate: '2026-11-04T14:00:00.000+0000', dueDate: '2026-11-04T14:00:00.000+0000' })
		incoming.heading = 'Prepare the release'
		assert.deepEqual(TickTick.changesFrom(existing, incoming, context), { title: 'Prepare the release' })
	})

	it('writes a moved date with all its fields, and an emptied one as none', () => {
		const { existing, incoming } = read({ startDate: '2026-11-04T14:00:00.000+0000', dueDate: '2026-11-04T14:00:00.000+0000' })
		incoming.start = at('2026-11-05T14:00:00Z')
		assert.deepEqual(TickTick.changesFrom(existing, incoming, context), { isAllDay: false, isFloating: false, startDate: '2026-11-05T14:00:00+0000', dueDate: '2026-11-05T14:00:00+0000', timeZone: BERLIN })
		incoming.start = undefined
		incoming.reminders = undefined
		assert.deepEqual(TickTick.changesFrom(existing, incoming, context), { startDate: null, dueDate: null })
	})

	it('writes a parent of the account, and letting go of one as empty', () => {
		const { existing, incoming } = read()
		incoming.relations = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'task-2' }])
		assert.deepEqual(TickTick.changesFrom(existing, incoming, context), { parentId: 'task-2' })
		const { existing: child, incoming: freed } = read({ parentId: 'task-2' })
		freed.relations = EntryRelations.none
		assert.deepEqual(TickTick.changesFrom(child, freed, context), { parentId: '' })
	})
})

describe('TickTick lists', () => {
	it('lists the inbox first, then the open task lists in TickTick\'s order, a grouped one under its group\'s name', () => {
		const sources = TickTick.sourcesFrom([
			{ id: 'b', name: 'Errands', sortOrder: 0, groupId: 'g', color: '#F18181' },
			{ id: 'a', name: 'Work', sortOrder: -100, permission: 'read' },
			{ id: 'n', name: 'Notes', kind: 'NOTE' },
			{ id: 'c', name: 'Old', closed: true },
		], [{ id: 'g', name: 'Home' }])
		assert.deepEqual(sources.map(source => [source.uri, source.name, !!source.readOnly, source.enabled]), [
			['ticktick://project/inbox', 'Inbox', false, false],
			['ticktick://project/a', 'Work', true, false],
			['ticktick://project/b', 'Home · Errands', false, false],
		])
		assert.equal(sources[2]!.color, Color.parse('#F18181'))
	})

	it('names the inbox by one uri, whatever its id', () => {
		assert.equal(TickTick.sourceUri('inbox134045687'), TickTick.sourceUri('inbox'))
	})
})
