import { type EntityManager } from '@mikro-orm/sqlite'
import { createMetadataDecorator } from '@a11d/metadata'
import { DateTimeValueConstructor } from '@3mo/date-time-value-constructor'
import { Router, type Request } from 'express'
import { type User } from '../../features/identity/User.js'
import { createLogger } from '../logging/Logger.js'

/** On whose behalf an operation runs, and in which unit of work. */
export interface OperationContext {
	readonly em: EntityManager
	readonly user: User
}

const dates = new DateTimeValueConstructor()

/**
 * One thing a user asks of the server, whichever way it arrives: its `parameters` are what is asked, `run` does it in its
 * context and throws what it refuses. The class carries its facts as metadata, `@label` and `@description` for every
 * reader and `@http` for the route, so a route holds no orchestration of its own.
 */
export abstract class Operation<Parameters = object, Result = unknown> {
	/** Reads a request into the operation, its parameters as {@link parametersOf} finds them; an operation whose body is a value of its own reads it itself. */
	static fromRequest(this: new (parameters: never) => Operation<unknown, unknown>, request: Request): Operation<unknown, unknown> {
		return new this(Operation.parametersOf(request) as never)
	}

	/** A request's values: its body's fields, then its query's, then its path's, each ISO date a `DateTime`, as the browser revives a response's. */
	static parametersOf(request: Request): Record<string, unknown> {
		const body = typeof request.body === 'object' && request.body !== null && !Array.isArray(request.body) ? request.body as object : {}
		const values = { ...body, ...request.query, ...request.params }
		return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, dates.shallConstruct(value) ? dates.construct(value as string) : value]))
	}

	/** Tagged with the operation's class name (`[App:CompleteTask]`), which the server build keeps as it does not minify. */
	protected readonly logger = createLogger(this.constructor.name)

	constructor(readonly parameters: Parameters) { }

	abstract run(context: OperationContext): Promise<Result>
}

/** How an operation arrives over HTTP: its method and path, and the status its result answers with (200, or 204 for none). */
export interface HttpFacts {
	readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	readonly path: string
	readonly status?: number
}

/** What `@http` asks of a class: the request read into the operation, which {@link Operation.fromRequest} does unless the class reads it itself. */
export interface HttpOperationClass {
	fromRequest(request: Request): Operation<unknown, unknown>
}

const httpFacts = createMetadataDecorator('http')

/** Declares the route an operation arrives by; the class must read a request into one (`fromRequest`), which the decorator's type imposes. */
export function http(facts: HttpFacts) {
	return (target: HttpOperationClass) => httpFacts(facts)(target)
}

http.get = (target: object): HttpFacts | undefined => httpFacts.get(target as Constructor<unknown>) as HttpFacts | undefined

export type OperationClass = Constructor<Operation<unknown, unknown>> & Partial<HttpOperationClass>

const registered = new Array<OperationClass>()

/** Registers an operation for every transport, in the order its module is evaluated: `app/operations.ts` loads them in the order they are listed. */
export function operation() {
	return (constructor: OperationClass) => void registered.push(constructor)
}

/** Every registered operation, in the order registered. */
operation.all = (): ReadonlyArray<OperationClass> => registered

/** Mounts every operation's route, in the order registered, after the feature routers, whose own paths come before an operation's `:id`. */
export function operationsRouter(em: () => EntityManager) {
	const router = Router()
	for (const each of operation.all()) {
		const facts = http.get(each)
		if (!facts || !each.fromRequest) {
			continue
		}
		router[facts.method.toLowerCase() as Lowercase<HttpFacts['method']>](facts.path, async (req, res) => {
			const result = await each.fromRequest!(req).run({ em: em(), user: req.user })
			return result === undefined ? res.status(facts.status ?? 204).end() : res.status(facts.status ?? 200).json(result)
		})
	}
	return router
}
