import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TodoistClient, TodoistRequestError } from './TodoistClient.js'

describe('TodoistClient', () => {
	it('paginates project lists with the v1 cursor contract', async () => {
		const requests: Array<{ url: string, authorization: string | null }> = []
		const fetcher: typeof fetch = (input, init) => {
			const url = new URL(String(input))
			requests.push({ url: `${url.pathname}${url.search}`, authorization: new Headers(init?.headers).get('Authorization') })
			return Promise.resolve(Response.json(requests.length === 1
				? { results: [{ id: 'p1', name: 'Work' }], next_cursor: 'next' }
				: { results: [{ id: 'p2', name: 'Home' }], next_cursor: null }))
		}

		const client = new TodoistClient('token-secret', fetcher)
		assert.deepEqual(await client.projects(), [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Home' }])
		assert.deepEqual(requests.map(request => request.url), [
			'/api/v1/projects?limit=200',
			'/api/v1/projects?limit=200&cursor=next',
		])
		assert.deepEqual(requests.map(request => request.authorization), ['Bearer token-secret', 'Bearer token-secret'])
	})

	it('reads the project task list and completed tasks using v1 endpoints', async () => {
		const paths: Array<string> = []
		const fetcher: typeof fetch = input => {
			const url = new URL(String(input))
			paths.push(`${url.pathname}${url.search}`)
			return Promise.resolve(Response.json(url.pathname.endsWith('/completed/by_completion_date')
				? { items: [{ id: 'done' }], next_cursor: null }
				: { results: [{ id: 'open' }], next_cursor: null }))
		}
		const client = new TodoistClient('secret', fetcher)

		assert.deepEqual(await client.tasks('project-1'), [{ id: 'open' }])
		assert.deepEqual(await client.completedTasks('project-1', '2026-05-01', '2026-06-11'), [{ id: 'done' }])
		assert.equal(paths[0], '/api/v1/tasks?project_id=project-1&limit=200')
		assert.equal(paths[1], '/api/v1/tasks/completed/by_completion_date?since=2026-05-01&until=2026-06-11&project_id=project-1&limit=200')
	})

	it('updates the recurring due object through sync and checks its command result', async () => {
		const commands: Array<any> = []
		const due = { date: '2026-10-14', timezone: null, string: 'every day', lang: 'en', is_recurring: true }
		const fetcher: typeof fetch = async (input, init) => {
			const body = JSON.parse(await new Request(input, init).text() || '{}')
			if (String(input).endsWith('/sync')) {
				commands.push(...body.commands)
				return Response.json({ sync_status: { [body.commands[0].uuid]: 'ok' } })
			}
			return Response.json({ id: 'task-1', due })
		}
		const saved = await new TodoistClient('test-token', fetcher).updateTask('task-1', { content: 'Task', due })
		assert.deepEqual(commands[0].args, { id: 'task-1', due })
		assert.equal(commands[0].type, 'item_update')
		assert.deepEqual(saved.due, due)
	})

	it('rejects a failed sync command even when the HTTP request succeeded', async () => {
		const fetcher: typeof fetch = async (input, init) => {
			const body = JSON.parse(await new Request(input, init).text() || '{}')
			return Response.json(String(input).endsWith('/sync')
				? { sync_status: { [body.commands[0].uuid]: { error: 'Invalid due date', http_code: 400 } } }
				: { id: 'task-1' })
		}
		await assert.rejects(new TodoistClient('test-token', fetcher).updateTask('task-1', { due: { date: 'invalid' } }), /Invalid due date/)
	})

	it('does not leak the API token in HTTP errors', async () => {
		const client = new TodoistClient('must-not-leak', () => Promise.resolve(new Response('forbidden', { status: 403 })))
		await assert.rejects(client.projects(), error => {
			assert.ok(error instanceof TodoistRequestError)
			assert.equal(error.status, 403)
			assert.doesNotMatch(error.message, /must-not-leak/)
			return true
		})
	})
})
