import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NotionClient, NotionRequestError } from './NotionClient.js'

/** A fetch stub that routes by "METHOD path" (path relative to the API base). A route value is either
 * a plain object (→ 200 JSON) or `{ status, body }` (→ that status). */
function fakeFetch(routes: Record<string, unknown>, calls?: Array<string>): typeof fetch {
	return ((url: URL | string, init?: RequestInit) => {
		const path = String(url).replace('https://api.notion.com/v1/', '')
		const key = `${init?.method ?? 'GET'} ${path}`
		calls?.push(key)
		const route = routes[key] ?? routes[`${init?.method ?? 'GET'} ${path.split('?')[0]}`]
		if (route === undefined) {
			return Promise.reject(new Error(`no route for ${key}`))
		}
		const { status, body } = (typeof route === 'object' && route !== null && 'status' in route)
			? route as { status: number, body: unknown }
			: { status: 200, body: route }
		return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
	}) as typeof fetch
}

describe('NotionClient.views resilience', () => {
	// The listing returns partial refs (no type), so each view is retrieved individually.
	const listing = { object: 'list', results: [{ object: 'view', id: 'v-table' }, { object: 'view', id: 'v-feed' }], has_more: false }

	it('drops a view whose type Notion refuses to serialize (feed → 400) instead of failing discovery', async () => {
		const client = new NotionClient('tok', fakeFetch({
			'GET views?data_source_id=ds-1&page_size=100': listing,
			'GET views/v-table': { object: 'view', id: 'v-table', name: 'All', type: 'table' },
			// The reported failure: Notion 400s on a feed view.
			'GET views/v-feed': { status: 400, body: { object: 'error', code: 'validation_error', message: 'Unsupported view type: feed' } },
		}))
		const views = await client.views('ds-1')
		assert.deepEqual(views.map(v => v.id), ['v-table'], 'the feed view is skipped, the table view survives')
	})

	it('still propagates a non-400 failure (a real server/network error is not silently swallowed)', async () => {
		const client = new NotionClient('tok', fakeFetch({
			'GET views?data_source_id=ds-1&page_size=100': listing,
			'GET views/v-table': { object: 'view', id: 'v-table', name: 'All', type: 'table' },
			'GET views/v-feed': { status: 500, body: { object: 'error', code: 'internal_server_error', message: 'boom' } },
		}))
		await assert.rejects(() => client.views('ds-1'), /500/)
	})

	it('never fetches a view whose type already rode along in the listing', async () => {
		const calls: Array<string> = []
		const client = new NotionClient('tok', fakeFetch({
			'GET views?data_source_id=ds-1&page_size=100': { object: 'list', has_more: false,
				results: [{ object: 'view', id: 'v-table', name: 'All', type: 'table' }] },
		}, calls))
		const views = await client.views('ds-1')
		assert.deepEqual(views.map(v => v.type), ['table'])
		assert.ok(!calls.some(c => c === 'GET views/v-table'), 'no per-view GET when the listing already carried name+type')
	})
})

describe('NotionClient error surfacing', () => {
	it('lifts Notion\'s code and message into the thrown error', async () => {
		const client = new NotionClient('bad', fakeFetch({
			'GET users/me': { status: 401, body: { object: 'error', code: 'unauthorized', message: 'API token is invalid.' } },
		}))
		await assert.rejects(() => client.me(), (error: unknown) => {
			assert.ok(error instanceof NotionRequestError)
			assert.equal(error.status, 401)
			assert.equal(error.code, 'unauthorized')
			assert.match(error.message, /API token is invalid/)
			return true
		})
	})
})
