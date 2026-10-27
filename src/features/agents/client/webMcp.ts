import { session } from '#infrastructure/http/PageSession.js'
import { mcpAddress } from './accessTokens.js'

/** What WebMCP asks of a tool (`document.modelContext`, a Chromium origin trial). */
interface WebMcpTool {
	readonly name: string
	readonly title?: string
	readonly description: string
	readonly inputSchema?: object
	readonly annotations?: { readOnlyHint?: boolean, untrustedContentHint?: boolean, consequentialHint?: boolean }
	execute(input: Record<string, unknown>): Promise<unknown>
}

interface ModelContext {
	registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void>
}

/** A tool as the endpoint lists it. */
interface ListedTool {
	readonly name: string
	readonly title?: string
	readonly description?: string
	readonly inputSchema?: object
	readonly annotations?: { readOnlyHint?: boolean, destructiveHint?: boolean }
}

/** What a tool call answers. */
interface CalledTool {
	readonly isError?: boolean
	readonly content?: ReadonlyArray<{ readonly text?: string }>
	readonly structuredContent?: object
}

let requests = 0

/**
 * One JSON-RPC request to the endpoint, which needs no session: the cookie signs it in as the page is. A request naming no
 * protocol version is answered as the 2025 revision answers, a stream holding the one message, whose data is read.
 */
async function request<Result>(method: string, params?: object) {
	const response = await fetch(mcpAddress(), {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
		body: JSON.stringify({ jsonrpc: '2.0', id: ++requests, method, params }),
	})
	const text = await response.text()
	const message = response.headers.get('content-type')?.startsWith('text/event-stream') ? text.split('\n').findLast(line => line.startsWith('data:'))?.slice(5) : text
	const { result, error } = JSON.parse(message || '{}') as { result?: Result, error?: { message: string } }
	if (!result) {
		throw new Error(error?.message ?? `The MCP endpoint answered ${response.status}`)
	}
	return result
}

/**
 * Offers an agent in the browser the endpoint's own tools (WebMCP), each a call to it as the signed-in person, so both
 * transports offer one set. Every answer carries entries other people can write, which the agent is told.
 */
export async function offerToolsToBrowserAgents() {
	const modelContext = (document as { modelContext?: ModelContext }).modelContext
	if (!modelContext || session.instance.mcp === false || session.instance.demo) {
		return
	}
	const { tools } = await request<{ tools: ReadonlyArray<ListedTool> }>('tools/list')
	for (const tool of tools) {
		void modelContext.registerTool({
			name: tool.name,
			title: tool.title,
			description: tool.description ?? tool.name,
			inputSchema: tool.inputSchema,
			annotations: { readOnlyHint: !!tool.annotations?.readOnlyHint, untrustedContentHint: true, consequentialHint: !!tool.annotations?.destructiveHint },
			execute: async input => {
				const called = await request<CalledTool>('tools/call', { name: tool.name, arguments: input })
				const text = called.content?.map(each => each.text ?? '').join('\n')
				return called.isError ? { error: text } : called.structuredContent ?? text
			},
		}).catch(() => void 0)
	}
}
