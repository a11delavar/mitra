import { createMetadataDecorator } from '@a11d/metadata'
import { type ToolAnnotations } from '@modelcontextprotocol/server'
import { http, type Operation } from '#infrastructure/operations/Operation.js'

/** How an operation is offered to agents: its tool's name, which never changes once published, and what its route cannot say. */
export interface ToolFacts {
	readonly name: string
	readonly annotations?: ToolAnnotations
}

/** What `@tool` asks of a class: an operation read from what agents send as from a request, its arguments the members of the parameters it declares. */
export interface ToolOperationClass {
	fromValues(values: Record<string, unknown>): Operation<unknown, unknown>
}

const toolFacts = createMetadataDecorator('tool')

/** Offers an operation to agents as an MCP tool, which answers with its result as the API serializes it. */
export function tool(facts: ToolFacts) {
	return (target: ToolOperationClass) => toolFacts(facts)(target)
}

tool.get = (target: object) => toolFacts.get(target as Constructor<unknown>) as ToolFacts | undefined

/** What the route already says, read-only for GET, idempotent for PUT and DELETE, destructive for DELETE, and the tool's own over it. */
tool.annotationsOf = (target: object) => {
	const method = http.get(target)?.method
	return {
		readOnlyHint: method === 'GET',
		destructiveHint: method === 'DELETE',
		idempotentHint: method === 'PUT' || method === 'DELETE',
		openWorldHint: false,
		...tool.get(target)?.annotations,
	}
}
