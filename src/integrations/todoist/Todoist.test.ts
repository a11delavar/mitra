import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Todoist } from './Todoist.js'
import '../registerIntegrations.js'
import { Entry, TaskStatus } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'

import { asBrowser, wireOf } from '../../infrastructure/model/wire.testing.js'
import { type TodoistTask } from './TodoistClient.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

const task = (overrides: Partial<TodoistTask> = {}): TodoistTask => ({
	id: 'task-1',
	project_id: 'project-1',
	content: 'Prepare the launch',
	description: 'Check the final list',
	checked: false,
	due: { date: '2026-06-11' },
	deadline: { date: '2026-06-13' },
	...overrides,
})

describe('Todoist source identity', () => {
	it('encodes a project id in a stable source uri and reads it back', () => {
		const uri = Todoist.sourceUri('project / 1')
		assert.equal(uri, 'todoist://project/project%20%2F%201')
		assert.equal(Todoist.projectIdOf({ uri }), 'project / 1')
	})

	it('rejects a non-Todoist source uri', () => {
		assert.throws(() => Todoist.projectIdOf({ uri: 'https://todoist.com' }), /Not a Todoist source uri/)
	})
})

describe('Todoist task mapping', () => {
	it('maps Todoist due dates to an all-day schedule and deadlines to Mitra due constraints', () => {
		const entry = new Entry({ sourceId: 'source-1', type: EntryType.Task })
		Todoist.applyTask(entry, task())

		assert.equal(entry.heading, 'Prepare the launch')
		assert.equal(entry.description, 'Check the final list')
		assert.equal(entry.status, TaskStatus.ToDo)
		assert.equal(entry.start?.toISOString(), '2026-06-11T00:00:00.000Z')
		assert.equal(entry.end?.toISOString(), '2026-06-12T00:00:00.000Z')
		assert.equal(entry.allDay, true)
		assert.equal(entry.due?.toISOString(), '2026-06-13T00:00:00.000Z')
		assert.equal(entry.uri, 'task-1')
	})

	it('maps a timed Todoist schedule and task duration to a timed span', () => {
		const entry = new Entry({ sourceId: 'source-1', type: EntryType.Task })
		Todoist.applyTask(entry, task({
			due: { date: '2026-06-11', datetime: '2026-06-11T15:30:00Z', timezone: 'Europe/Andorra' },
			deadline: null,
			duration: { amount: 45, unit: 'minute' },
		}))

		assert.equal(entry.start?.toISOString(), '2026-06-11T15:30:00.000Z')
		assert.equal(entry.end?.toISOString(), '2026-06-11T16:15:00.000Z')
		assert.equal(entry.allDay, false)
		assert.equal(entry.timeZone, 'Europe/Andorra')
		assert.equal(entry.due, undefined)
	})

	it('reads floating 18:30 in the account timezone, including the winter offset', () => {
		const summer = Todoist.scheduleOf(task({ due: { date: '2026-10-13T18:30:00', timezone: null } }), 'Europe/Madrid')
		assert.equal(summer.start?.toISOString(), '2026-10-13T16:30:00.000Z')
		assert.equal(summer.timeZone, 'Europe/Madrid')
		const winter = Todoist.scheduleOf(task({ due: { date: '2026-10-26T18:30:00', timezone: null } }), 'Europe/Madrid')
		assert.equal(winter.start?.toISOString(), '2026-10-26T17:30:00.000Z')
	})

	it('reschedules a recurring task while retaining its rule and language', () => {
		const existing = new Entry({ type: EntryType.Task })
		Todoist.applyTask(existing, task({ due: { date: '2026-10-12', timezone: null, string: 'cada día', lang: 'es', is_recurring: true } }), 'Europe/Madrid')
		const incoming = existing.clone()
		incoming.start = D('2026-10-14T00:00:00Z')
		const input = Todoist.inputFrom(incoming, 'project-1', true, existing, 'Europe/Madrid')
		assert.deepEqual(input.due, { date: '2026-10-14', timezone: null, string: 'cada día', lang: 'es', is_recurring: true })
		assert.equal(input.due_date, undefined)
	})

	it('keeps floating wall-clock semantics when a task is moved', () => {
		const existing = new Entry({ type: EntryType.Task })
		Todoist.applyTask(existing, task({ due: { date: '2026-10-13T18:30:00', timezone: null } }), 'Europe/Madrid')
		const incoming = existing.clone()
		incoming.start = D('2026-10-14T16:30:00Z')
		assert.deepEqual(Todoist.inputFrom(incoming, 'project-1', true, existing, 'Europe/Madrid').due, { date: '2026-10-14T18:30:00', timezone: null })
	})

	it('maps completed tasks to Done and preserves an unscheduled estimate', () => {
		const entry = new Entry({ sourceId: 'source-1', type: EntryType.Task })
		Todoist.applyTask(entry, task({ checked: true, due: null, deadline: null, duration: { amount: 30, unit: 'minute' } }))
		assert.equal(entry.status, TaskStatus.Done)
		assert.equal(entry.start, undefined)
		assert.equal(entry.estimate, 30)
	})

	it('writes schedule, duration, deadline, title and description to a Todoist project', () => {
		const entry = new Entry({
			type: EntryType.Task,
			heading: 'Book travel',
			description: 'Use the company card',
			start: D('2026-06-11T15:30:00.000Z'),
			end: D('2026-06-11T16:15:00.000Z'),
			due: D('2026-06-13T00:00:00.000Z'),
		})
		assert.deepEqual(Todoist.inputFrom(entry, 'project-1'), {
			content: 'Book travel',
			description: 'Use the company card',
			project_id: 'project-1',
			due_datetime: '2026-06-11T15:30:00.000Z',
			duration: 45,
			duration_unit: 'minute',
			deadline_date: '2026-06-13',
		})
	})

	it('clears removed schedule and deadline fields on update, but leaves recurrence date changes to Todoist', () => {
		const entry = new Entry({ type: EntryType.Task, heading: 'Unscheduled', description: '' })
		assert.deepEqual(Todoist.inputFrom(entry, 'project-1', true), {
			content: 'Unscheduled', description: '', due_string: 'no date', duration: null, deadline_date: null,
		})

		const recurring = new Entry({ type: EntryType.Task, heading: 'Every day', description: '' })
		const existing = new Entry({ type: EntryType.Task, data: { raw: 'todoist-recurring:every day' } })
		assert.deepEqual(Todoist.inputFrom(recurring, 'project-1', true, existing), {
			content: 'Every day', description: '', deadline_date: null,
		})
	})
})

describe('Todoist integration model', () => {
	const connected = () => new Todoist({ uri: Todoist.accountUri, credentials: { username: 'Operator', token: 'secret-token' }, sources: [] as any })

	it('offers task-only projects and hides capabilities Todoist cannot represent', () => {
		const integration = connected()
		assert.equal(integration.canConnect, true)
		assert.equal(integration.syncInterval, 60_000)
		assert.equal(integration.capabilities.availability, false)
		assert.equal(integration.capabilities.recurrence, false)
		assert.equal(integration.capabilities.cancelledStatus, false)
		assert.equal(integration.capabilities.description, true)
	})

	it('keeps the stored token when the edit form leaves it blank and accepts a replacement token', () => {
		const integration = connected()
		integration.merge(new Todoist({ credentials: { username: '', token: '' } }))
		assert.deepEqual(integration.credentials, { username: 'Operator', token: 'secret-token' })
		integration.merge(new Todoist({ credentials: { username: 'spoofed', token: 'new-secret' } }))
		assert.deepEqual(integration.credentials, { username: 'Operator', token: 'new-secret' })
	})

	it('withholds its API token in ordinary wire responses', () => {
		assert.deepEqual(wireOf(connected()).credentials, { username: 'Operator', token: '' })
		assert.equal(asBrowser(() => wireOf(connected())).credentials.token, 'secret-token')
	})
})
