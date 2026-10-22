import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, EntryType, TaskStatus } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { EntryRelations, RelationType } from '#features/relations'
import { Color } from '#features/sources'
import { asBrowser, wireOf } from '#infrastructure/model/wire.testing.js'
import { Todoist, type TodoistProject, type TodoistTask } from './Todoist.js'

const MADRID = 'Europe/Madrid'
const at = (iso: string) => new Date(iso) as never
const iso = (value: unknown) => (value as Date | undefined)?.toISOString()

/** An account on Pro, which holds deadlines and durations, or on Free, which holds neither. */
const account = (pro = true) => new Todoist({
	uri: Todoist.accountUri('user-1'),
	credentials: { username: 'owner@example.com', token: 'todoist-secret', timeZone: MADRID, deadlines: pro, durations: pro },
})

const task = (init?: Partial<TodoistTask>): TodoistTask => ({
	id: 'task-1',
	project_id: 'project-1',
	section_id: 'section-1',
	content: 'Prepare the launch',
	description: 'Check the **final** list',
	priority: 4,
	labels: ['work'],
	due: null,
	deadline: null,
	duration: null,
	checked: false,
	updated_at: '2026-10-12T08:00:00Z',
	...init,
})

/** An entry as a sync would leave it, and a copy to edit, as a write receives both. */
const read = (init?: Partial<TodoistTask>, integration = account()) => {
	const existing = new Entry({ id: 'entry-1', sourceId: 'source-1' })
	Todoist.applyTask(existing, task(init), { ownership: integration.ownership, zone: Todoist.zoneOf(integration) })
	const incoming = existing.clone()
	incoming.relations = existing.relations
	return { existing, incoming }
}

const context = { zone: MADRID, isTask: (uid: string) => uid.startsWith('task-') }
const commandsFor = (existing: Entry, incoming: Entry, integration = account(), projectId = 'project-1') =>
	Todoist.commandsFor(existing, incoming, { projectId, ownership: integration.ownership, context })

describe('Todoist dates', () => {
	it('reads a day as an all-day task, and a duration in days as that many days', () => {
		const { existing } = read({ due: { date: '2026-10-13', timezone: null } })
		assert.equal(existing.allDay, true)
		assert.equal(iso(existing.start), '2026-10-13T00:00:00.000Z')
		assert.equal(iso(existing.end), '2026-10-14T00:00:00.000Z')

		const { existing: long } = read({ due: { date: '2026-10-13', timezone: null }, duration: { amount: 3, unit: 'day' } })
		assert.equal(iso(long.end), '2026-10-16T00:00:00.000Z')
	})

	it('reads a floating time as Mitra floats one, its wall clock as if in UTC', () => {
		const { existing } = read({ due: { date: '2026-10-13T18:30:00', timezone: null }, duration: { amount: 45, unit: 'minute' } })
		assert.equal(existing.allDay, false)
		assert.equal(existing.timeZone, EntryTimeZone.floating)
		assert.equal(iso(existing.start), '2026-10-13T18:30:00.000Z')
		assert.equal(iso(existing.end), '2026-10-13T19:15:00.000Z')
	})

	it('reads a fixed time as its instant in its zone', () => {
		const { existing } = read({ due: { date: '2026-10-13T16:30:00.000000Z', timezone: MADRID } })
		assert.equal(existing.timeZone?.id, MADRID)
		assert.equal(iso(existing.start), '2026-10-13T16:30:00.000Z')
		assert.equal(existing.end, undefined, 'a time without a duration is a moment')
	})

	it('reads a duration without a date as the estimate', () => {
		const { existing } = read({ duration: { amount: 30, unit: 'minute' } })
		assert.equal(existing.start, undefined)
		assert.equal(existing.estimate, 30)
	})

	it('writes a floating time back as a wall clock, and a time without a zone fixed in the account\'s', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13T18:30:00', timezone: null } })
		incoming.start = at('2026-10-14T09:00:00Z')
		assert.deepEqual(commandsFor(existing, incoming), [{ type: 'item_update', args: { id: 'task-1', due: { date: '2026-10-14T09:00:00', timezone: null } } }])

		incoming.timeZone = undefined
		assert.deepEqual(commandsFor(existing, incoming)[0]!.args, { id: 'task-1', due: { date: '2026-10-14T09:00:00Z', timezone: MADRID } })
	})

	it('writes a span as the start and its length, and the estimate while there is no start', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13T16:30:00Z', timezone: MADRID } })
		incoming.end = at('2026-10-13T18:00:00Z')
		assert.deepEqual(commandsFor(existing, incoming)[0]!.args, { id: 'task-1', duration: { amount: 90, unit: 'minute' } })

		incoming.start = undefined
		incoming.end = undefined
		incoming.estimate = 20
		assert.deepEqual(commandsFor(existing, incoming)[0]!.args, { id: 'task-1', due: null, duration: { amount: 20, unit: 'minute' } })
	})

	it('writes no length on a plan without durations, whose tasks keep the one they have', () => {
		const free = account(false)
		assert.equal(free.ownership.holds('estimate'), false)
		const { existing, incoming } = read({ due: { date: '2026-10-13T16:30:00Z', timezone: MADRID }, duration: { amount: 45, unit: 'minute' } }, free)
		assert.equal(iso(existing.end), '2026-10-13T17:15:00.000Z')
		incoming.start = at('2026-10-14T16:30:00Z')
		incoming.end = at('2026-10-14T19:00:00Z')
		assert.deepEqual(commandsFor(existing, incoming, free), [{ type: 'item_update', args: { id: 'task-1', due: { date: '2026-10-14T16:30:00Z', timezone: MADRID } } }])
	})

	it('keeps the minutes a task on a day carries when it moves to another day', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13', timezone: null }, duration: { amount: 30, unit: 'minute' } })
		incoming.start = at('2026-10-15T00:00:00Z')
		incoming.end = at('2026-10-16T00:00:00Z')
		assert.deepEqual(commandsFor(existing, incoming), [{ type: 'item_update', args: { id: 'task-1', due: { date: '2026-10-15', timezone: null } } }])
	})
})

describe('Todoist repeats', () => {
	const repeating = { date: '2026-10-12', timezone: null, string: 'cada lunes', lang: 'es', is_recurring: true }

	it('shows a repeating task at its next date, without a rule of Mitra\'s', () => {
		const { existing } = read({ due: repeating })
		assert.equal(existing.recurrence, undefined)
		assert.equal(iso(existing.start), '2026-10-12T00:00:00.000Z')
	})

	it('moves a repeating task\'s next date, keeping its words and their language', () => {
		const { existing, incoming } = read({ due: repeating })
		incoming.start = at('2026-10-13T00:00:00Z')
		incoming.end = at('2026-10-14T00:00:00Z')
		assert.deepEqual(commandsFor(existing, incoming), [{
			type: 'item_update',
			args: { id: 'task-1', due: { date: '2026-10-13', timezone: null, string: 'cada lunes', lang: 'es', is_recurring: true } },
		}])
	})
})

describe('Todoist deadlines', () => {
	it('reads a deadline as the due date: the day beside a day, the end of the working day beside a time', () => {
		const { existing: day } = read({ due: { date: '2026-10-13', timezone: null }, deadline: { date: '2026-10-16' } })
		assert.equal(iso(day.due), '2026-10-16T00:00:00.000Z')

		const { existing: fixed } = read({ due: { date: '2026-10-13T16:30:00Z', timezone: MADRID }, deadline: { date: '2026-10-16' } })
		assert.equal(iso(fixed.due), '2026-10-16T15:00:00.000Z')

		const { existing: floating } = read({ due: { date: '2026-10-13T18:30:00', timezone: null }, deadline: { date: '2026-10-16' } })
		assert.equal(iso(floating.due), '2026-10-16T17:00:00.000Z')
	})

	it('reads a deadline on an unscheduled task as a day', () => {
		const { existing } = read({ deadline: { date: '2026-10-16' } })
		assert.equal(existing.allDay, true)
		assert.equal(iso(existing.due), '2026-10-16T00:00:00.000Z')
	})

	it('writes the due date\'s day, as Todoist keeps no time on a deadline', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13T16:30:00Z', timezone: MADRID } })
		incoming.due = at('2026-10-17T21:30:00Z')
		assert.deepEqual(commandsFor(existing, incoming)[0]!.args, { id: 'task-1', deadline: { date: '2026-10-17' } })
	})

	it('holds deadlines and lengths only on a plan that has them', () => {
		const free = account(false)
		assert.deepEqual(['due', 'end', 'estimate'].map(field => free.ownership.holds(field as never)), [false, false, false])
		assert.deepEqual(['due', 'end', 'estimate'].map(field => account().ownership.ownerOf(field as never)), ['upstream', 'upstream', 'upstream'])

		const { existing, incoming } = read({ deadline: { date: '2026-10-16' } }, free)
		assert.equal(existing.due, undefined)
		incoming.heading = 'Renamed'
		assert.deepEqual(commandsFor(existing, incoming, free)[0]!.args, { id: 'task-1', content: 'Renamed' })
	})
})

describe('Todoist tasks', () => {
	it('reads the title, the description, completion and the address', () => {
		const { existing } = read({ checked: true })
		assert.equal(existing.type, EntryType.Task)
		assert.equal(existing.heading, 'Prepare the launch')
		assert.equal(existing.description, 'Check the **final** list')
		assert.equal(existing.status, TaskStatus.Done)
		assert.equal(existing.uid, 'task-1')
		assert.equal(existing.data?.url, 'https://app.todoist.com/app/task/task-1')
	})

	it('changes only what changed, so priority, labels and section stay as Todoist has them', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13', timezone: null } })
		incoming.heading = 'Prepare the release'
		const commands = commandsFor(existing, incoming)
		assert.deepEqual(commands, [{ type: 'item_update', args: { id: 'task-1', content: 'Prepare the release' } }])
		assert.deepEqual(Todoist.storedTaskOf(existing)?.labels, ['work'])
	})

	it('writes nothing for an unchanged task', () => {
		const { existing, incoming } = read({ due: { date: '2026-10-13T18:30:00', timezone: null }, duration: { amount: 45, unit: 'minute' }, deadline: { date: '2026-10-16' } })
		assert.deepEqual(commandsFor(existing, incoming), [])
	})

	it('closes and reopens, after the fields change', () => {
		const { existing, incoming } = read()
		incoming.heading = 'Done now'
		incoming.status = TaskStatus.Done
		assert.deepEqual(commandsFor(existing, incoming).map(command => command.type), ['item_update', 'item_close'])

		const { existing: done, incoming: reopened } = read({ checked: true })
		reopened.status = TaskStatus.ToDo
		assert.deepEqual(commandsFor(done, reopened), [{ type: 'item_uncomplete', args: { id: 'task-1' } }])
	})

	it('moves a task to the project of the calendar it moved to', () => {
		const { existing, incoming } = read()
		assert.deepEqual(commandsFor(existing, incoming, account(), 'project-2'), [{ type: 'item_move', args: { id: 'task-1', project_id: 'project-2' } }])
	})

	it('adds a task with what it holds, and closes it in the same request when it is done', () => {
		const entry = new Entry({ type: EntryType.Task, heading: 'Book travel', description: '', start: at('2026-10-13T16:30:00Z'), end: at('2026-10-13T17:15:00Z'), timeZone: EntryTimeZone.parse(MADRID), status: TaskStatus.Done })
		entry.relateTo(RelationType.Parent, 'task-9')
		assert.deepEqual(Todoist.addCommandsFor(entry, { projectId: 'project-1', tempId: 'temp-1', ownership: account().ownership, context }), [
			{
				type: 'item_add', temp_id: 'temp-1', args: {
					content: 'Book travel', description: '', project_id: 'project-1', parent_id: 'task-9',
					due: { date: '2026-10-13T16:30:00Z', timezone: MADRID }, duration: { amount: 45, unit: 'minute' },
				},
			},
			{ type: 'item_close', args: { id: 'temp-1' } },
		])
	})
})

describe('Todoist subtasks', () => {
	it('reads a parent as a subtask link', () => {
		const { existing } = read({ parent_id: 'task-9' })
		assert.deepEqual(existing.relations?.writes.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, 'task-9']])
	})

	it('keeps what Mitra holds of its own beside the parent Todoist names', () => {
		const stored = EntryRelations.of([
			{ type: RelationType.Parent, targetUid: 'task-8' },
			{ type: RelationType.Parent, targetUid: 'caldav-task' },
			{ type: RelationType.FinishToStart, targetUid: 'task-7' },
		])
		const relations = Todoist.relationsFrom({ parent_id: 'task-9' }, stored, context.isTask)
		assert.deepEqual(relations.writes.map(relation => `${relation.type.value} ${relation.targetUid}`).sort(), [
			'FINISHTOSTART task-7',
			'PARENT caldav-task',
			'PARENT task-9',
		])
	})

	it('moves a task under its new parent, and back to the project when it loses it', () => {
		const { existing, incoming } = read()
		incoming.relateTo(RelationType.Parent, 'task-9')
		assert.deepEqual(commandsFor(existing, incoming), [{ type: 'item_move', args: { id: 'task-1', parent_id: 'task-9' } }])

		const { existing: child, incoming: orphan } = read({ parent_id: 'task-9' })
		orphan.relations = EntryRelations.none
		assert.deepEqual(commandsFor(child, orphan), [{ type: 'item_move', args: { id: 'task-1', project_id: 'project-1' } }])
	})

	it('never writes a dependency or a parent beyond the account', () => {
		const { existing, incoming } = read()
		incoming.relateTo(RelationType.FinishToStart, 'task-7')
		incoming.relateTo(RelationType.Parent, 'caldav-task')
		assert.deepEqual(commandsFor(existing, incoming), [])
	})
})

describe('Todoist projects', () => {
	// As Todoist answers them: a personal project's `child_order` is 0, its key says its place; a workspace project has no key.
	const projects: Array<TodoistProject> = [
		{ id: 'work', name: 'Work', child_order: 0, order_key: 'a2', color: 'blue' },
		{ id: 'launch', name: 'Launch', parent_id: 'work', child_order: 0, order_key: 'a0' },
		{ id: 'old', name: 'Old', child_order: 0, order_key: 'a3', is_archived: true },
		{ id: 'inbox', name: 'Inbox', child_order: 0, order_key: 'a0', inbox_project: true, color: 'charcoal' },
		{ id: 'team', name: 'Team', child_order: 1, order_key: null },
		{ id: 'home', name: 'Home', child_order: 0, order_key: 'a1' },
	]

	it('lists the active projects in Todoist\'s order, the Inbox first, a nested one under its parent\'s name', () => {
		const sources = Todoist.sourcesFrom(projects)
		assert.deepEqual(sources.map(source => source.name), ['Inbox', 'Home', 'Work', 'Work · Launch', 'Team'])
		assert.deepEqual(sources.map(source => Todoist.projectIdOf(source)), ['inbox', 'home', 'work', 'launch', 'team'])
	})

	it('paints a calendar its project\'s color, unless the project still has the one Todoist gives every project', () => {
		const sources = Todoist.sourcesFrom(projects)
		const colorOf = (id: string) => sources.find(source => Todoist.projectIdOf(source) === id)!.color
		assert.equal(colorOf('work'), Color.parse('#4073ff'))
		assert.equal(colorOf('inbox'), Color.derivedFrom(Todoist.sourceUri('inbox')))
	})

	it('offers them as task calendars, turned off until chosen', () => {
		const [source] = Todoist.sourcesFrom(projects)
		assert.deepEqual([...source!.entryTypes], [EntryType.Task])
		assert.equal(source!.enabled, false)
	})
})

describe('Todoist account', () => {
	it('can do what Todoist can: no tasks in progress or cancelled, no files of Mitra\'s, no availability', () => {
		const { capabilities } = account()
		assert.deepEqual(capabilities.entries.statuses, [TaskStatus.ToDo, TaskStatus.Done])
		assert.equal(capabilities.entries.attach, false)
		assert.equal(capabilities.availability, false)
		assert.equal(capabilities.entries.move, true, 'a task moves between projects in place')
	})

	it('keeps relations in Mitra, as dependencies have nowhere to go in Todoist', () => {
		const { ownership } = account()
		assert.equal(ownership.ownerOf('relations'), 'mitra')
		assert.equal(ownership.holds('recurrence'), false)
		assert.equal(ownership.holds('reminders'), false)
	})

	it('learns the account on connect, and what its plan holds', () => {
		const integration = new Todoist({ credentials: { username: '', token: 'todoist-secret', timeZone: '', deadlines: false, durations: false } })
		integration.adopt({ user: { id: '42', email: 'owner@example.com', tz_info: { timezone: 'America/New_York' } }, limits: { deadlines: true, durations: true } })
		assert.equal(integration.uri, 'todoist://account/42')
		assert.deepEqual(integration.credentials, { username: 'owner@example.com', token: 'todoist-secret', timeZone: 'America/New_York', deadlines: true, durations: true })
	})

	it('keeps what it knows where a read names neither the account nor its plan', () => {
		const integration = account()
		integration.adopt({})
		assert.deepEqual(integration.credentials, account().credentials)
		integration.adopt({ limits: { deadlines: false, durations: false } })
		assert.equal(integration.ownership.holds('due'), false, 'a trial that ended takes deadlines with it')
	})

	it('keeps the stored token when an edit leaves it blank', () => {
		const integration = account()
		integration.merge(new Todoist({ credentials: { username: 'other', token: '', timeZone: '', deadlines: false, durations: false } }))
		assert.equal(integration.credentials.token, 'todoist-secret')
		assert.equal(integration.credentials.deadlines, true)
	})

	it('withholds its token from the wire', () => {
		assert.equal(wireOf(account()).credentials.token, '')
		assert.equal(asBrowser(() => wireOf(account())).credentials.token, 'todoist-secret')
	})
})
