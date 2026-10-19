import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { createAccessToken } from '../../identity/server/accessTokens.testing.js'

describe('The MCP endpoint', () => {
	let server: OperationServer
	let agent: Client
	before(async () => {
		server = await OperationServer.start()
		agent = new Client({ name: 'test-agent', version: '1.0.0' })
		await agent.connect(new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`)))
	})
	after(async () => {
		await agent.close()
		await server.close()
	})

	it('lists the operations that offer a tool, in the order they register, what their routes say among their hints', async () => {
		const { tools } = await agent.listTools()
		assert.deepEqual(tools.map(tool => tool.name), [
			'get_context', 'get_overview', 'search_entries', 'get_entry',
			'create_entry', 'update_entry_occurrence', 'update_entry', 'relate_entries', 'unrelate_entries', 'complete_task', 'delete_entry_occurrence', 'delete_entry',
			'create_calendar', 'delete_calendar',
		])
		assert.deepEqual(tools.filter(tool => tool.annotations?.readOnlyHint).map(tool => tool.name), ['get_context', 'get_overview', 'search_entries', 'get_entry'])
		assert.deepEqual(tools.filter(tool => tool.annotations?.destructiveHint).map(tool => tool.name), ['delete_entry_occurrence', 'delete_entry', 'delete_calendar'])
		assert.ok(tools.every(tool => tool.title && tool.description))
	})

	it('answers what an operation refuses as a result the agent reads, never a protocol error', async () => {
		const answer = await server.callTool('create_entry', { heading: 'Lunch', start: 'next tuesday' })
		assert.equal(answer.isError, true)
		assert.match(answer.content[0]!.text, /start/)
	})

	it('answers a plain JSON-RPC request without a session, as the WebMCP mirror in the browser sends one', async () => {
		const response = await fetch(`${server.url}/mcp`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_context', arguments: {} } }),
		})
		const data = (await response.text()).split('\n').findLast(line => line.startsWith('data:'))!.slice(5)
		const { result } = JSON.parse(data) as { result: { structuredContent: { calendars: Array<unknown> } } }
		assert.equal(result.structuredContent.calendars.length, 1)
	})

	it('refuses a request a browser sends from another site', async () => {
		const response = await fetch(`${server.url}/mcp`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://elsewhere.example' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		})
		assert.equal(response.status, 403)
	})

	it('offers an agent whose token only reads the tools that only read, and notes when a token was last used', async () => {
		const { token } = await createAccessToken('Laptop', 'read')
		const reader = new Client({ name: 'reader', version: '1.0.0' })
		await reader.connect(new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }))
		const { tools } = await reader.listTools()
		await reader.close()
		assert.deepEqual(tools.map(tool => tool.name), ['get_context', 'get_overview', 'search_entries', 'get_entry'])
		const [row] = await server.query<{ last_used_at: unknown }>('select last_used_at from access_token')
		assert.ok(row?.last_used_at)
	})

	it('refuses a token that is not one, rather than reading it as no token', async () => {
		const response = await fetch(`${server.url}/mcp`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer mitra_forged' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		})
		assert.equal(response.status, 401)
		assert.match(response.headers.get('www-authenticate') ?? '', /invalid_token/)
	})
})
