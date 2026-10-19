import { type EntityManager } from '@mikro-orm/sqlite'
import { createMetadataDecorator } from '@a11d/metadata'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { Router, type Request } from 'express'
import { construct } from '@a11d/converter'
import { validation } from '../validation/validation.js'
import { type User } from '../../features/identity/User.js'
import { createLogger } from '../logging/Logger.js'

/** On whose behalf an operation runs, and in which unit of work. */
export interface OperationContext {
	readonly em: EntityManager
	readonly user: User
}

type OperationConstructor = new (parameters: never) => Operation<unknown, unknown>

/**
 * One thing a user asks of the server, whichever way it arrives: its `parameters` are what is asked, `run` does it in its
 * context and throws what it refuses. The class carries its facts as metadata, `@label` and `@description` for every
 * reader and `@http` for the route, so a route holds no orchestration of its own.
 */
export abstract class Operation<Parameters = object, Result = unknown> {
	/**
	 * Reads a request into the operation: a body the value converter built is taken as it is, the path's and query's
	 * values joining it; any other body's fields are read as written. An operation whose body is a value of its own reads it itself.
	 */
	static fromRequest(this: OperationConstructor, request: Request): Operation<unknown, unknown> {
		const body = typeof request.body === 'object' && request.body !== null && !Array.isArray(request.body) ? request.body as object : {}
		const built = ModelValueConstructor.typeNameOf(body) ? body : undefined
		return Operation.fromValues.call(this, { ...built ? {} : body, ...request.query, ...request.params }, built)
	}

	/**
	 * The operation asking what `values` name, whichever transport they came by: read as written, built
	 * through its parameters' converters, `built`'s fields joining as they are, and judged after construction by the
	 * members' `@validation`.
	 */
	static fromValues(this: OperationConstructor, values: Record<string, unknown>, built?: object): Operation<unknown, unknown> {
		const Parameters = operation.parametersOf(this)
		if (!Parameters) {
			return new this({} as never)
		}
		const read = validation.read(Parameters, values)
		const parameters = construct(Parameters, read)
		for (const [key, value] of Object.entries(built ?? {})) {
			if (!key.startsWith('@') && !(key in read)) {
				Object.assign(parameters, { [key]: value })
			}
		}
		const errors = [...validation.errorsIn(parameters)]
		if (errors.length) {
			throw new AggregateError(errors)
		}
		return new this(parameters as never)
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

http.get = (target: object) => httpFacts.get(target as Constructor<unknown>) as HttpFacts | undefined

export type OperationClass = Constructor<Operation<unknown, unknown>> & Partial<HttpOperationClass> & Pick<typeof Operation, 'fromValues'>

const registered = new Array<OperationClass>()
const parameters = new WeakMap<object, Constructor<object>>()

/**
 * Registers an operation for every transport, in the order its module is evaluated: `app/operations.ts` loads them in the
 * order they are listed. `Parameters`, a class whose members declare their shape, is what the operation takes from any of them.
 */
export function operation<P extends object>(Parameters?: Constructor<P>) {
	return (constructor: OperationClass & Constructor<Operation<P, unknown>>) => {
		if (Parameters) {
			parameters.set(constructor, Parameters)
		}
		registered.push(constructor)
	}
}

/** The class of the parameters an operation declared, whose members a transport reads and describes. */
operation.parametersOf = (target: object) => parameters.get(target)

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
