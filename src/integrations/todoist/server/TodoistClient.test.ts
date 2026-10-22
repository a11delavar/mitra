import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TodoistClient, TodoistRequestError } from './TodoistClient.js'

interface Call {
	readonly method: string
	readonly path: string
	readonly authorization: string | null
	readonly body: any
}

function fakeFetch(answer: (call: Call) => { status?: number, body: unknown }, calls: Array<Call> = []): typeof fetch {
	return ((url: URL | string, init?: RequestInit) => {
		const address = new URL(String(url))
		const call = {
			method: init?.method ?? 'GET',
			path: `${address.pathname}${address.search}`,
			authorization: new Headers(init?.headers).get('Authorization'),
			body: init?.body ? JSON.parse(String(init.body)) : undefined,
		}
		calls.push(call)
		const { status = 200, body } = answer(call)
		return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
	}) as typeof fetch
}

describe('TodoistClient', () => {
	const since = new Date('2026-07-19T00:00:00Z')
	const until = new Date('2026-10-19T00:00:00Z')

	it('follows the cursor through every page', async () => {
		const calls = new Array<Call>()
		const client = new TodoistClient('todoist-secret', fakeFetch(({ path }) => ({
			body: path.includes('cursor=next')
				? { items: [{ id: 'task-2' }], next_cursor: null }
				: { items: [{ id: 'task-1' }], next_cursor: 'next' },
		}), calls))
		assert.deepEqual((await client.completedTasks(since, until)).map(task => task.id), ['task-1', 'task-2'])
		assert.equal(calls.length, 2)
		assert.match(calls[1]!.path, /&cursor=next$/)
		assert.deepEqual(calls.map(call => call.authorization), ['Bearer todoist-secret', 'Bearer todoist-secret'])
	})

	it('refuses a cursor it was given before, rather than looping', async () => {
		const client = new TodoistClient('todoist-secret', fakeFetch(() => ({ body: { items: [], next_cursor: 'again' } })))
		await assert.rejects(client.completedTasks(since, until), /repeated a page/)
	})

	it('reads completed tasks by when they were completed, from their own list', async () => {
		const calls = new Array<Call>()
		const client = new TodoistClient('todoist-secret', fakeFetch(() => ({ body: { items: [{ id: 'done' }], next_cursor: null } }), calls))
		const tasks = await client.completedTasks(since, until)
		assert.deepEqual(tasks.map(task => task.id), ['done'])
		assert.equal(calls[0]!.path, '/api/v1/tasks/completed/by_completion_date?since=2026-07-19T00%3A00%3A00.000Z&until=2026-10-19T00%3A00%3A00.000Z&limit=200')
	})

	it('syncs from a token and runs commands in the same request, each with its own uuid', async () => {
		const calls = new Array<Call>()
		const client = new TodoistClient('todoist-secret', fakeFetch(({ body }) => ({
			body: { sync_token: 'token-2', items: [], sync_status: Object.fromEntries(body.commands.map((command: { uuid: string }) => [command.uuid, 'ok'])) },
		}), calls))
		const response = await client.sync({
			syncToken: 'token-1',
			resourceTypes: ['items'],
			commands: [{ type: 'item_close', args: { id: 'task-1' } }, { type: 'item_close', args: { id: 'task-2' } }],
		})
		assert.equal(response.sync_token, 'token-2')
		const { body } = calls[0]!
		assert.equal(body.sync_token, 'token-1')
		assert.deepEqual(body.resource_types, ['items'])
		assert.equal(new Set(body.commands.map((command: { uuid: string }) => command.uuid)).size, 2)
	})

	it('answers the ids Todoist gave new tasks', async () => {
		const client = new TodoistClient('todoist-secret', fakeFetch(({ body }) => ({
			body: { temp_id_mapping: { 'temp-1': 'task-1' }, sync_status: { [body.commands[0].uuid]: 'ok' } },
		})))
		assert.deepEqual(await client.execute([{ type: 'item_add', temp_id: 'temp-1', args: { content: 'New', project_id: 'project-1' } }]), { 'temp-1': 'task-1' })
	})

	it('throws a command Todoist refused, though the request succeeded', async () => {
		const client = new TodoistClient('todoist-secret', fakeFetch(({ body }) => ({
			body: { sync_status: { [body.commands[0].uuid]: { error: 'Premium only feature', http_code: 403 } } },
		})))
		await assert.rejects(client.execute([{ type: 'item_update', args: { id: 'task-1', deadline: { date: '2026-10-16' } } }]), error => {
			assert.ok(error instanceof TodoistRequestError)
			assert.equal(error.status, 403)
			assert.match(error.message, /item_update: Premium only feature/)
			return true
		})
	})

	it('names Todoist\'s reason for a failed request, never the token', async () => {
		const client = new TodoistClient('todoist-secret', fakeFetch(() => ({ status: 401, body: { error: 'Invalid token', http_code: 401 } })))
		await assert.rejects(client.sync({ syncToken: '*', resourceTypes: ['user'] }), error => {
			assert.ok(error instanceof TodoistRequestError)
			assert.equal(error.status, 401)
			assert.match(error.message, /Invalid token/)
			assert.doesNotMatch(error.message, /todoist-secret/)
			return true
		})
	})
})
