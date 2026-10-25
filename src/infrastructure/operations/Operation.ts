import type { EntityManager } from '@mikro-orm/sqlite'
import type { Request } from 'express'
import { Api } from '@a11d/api'
import { createMetadataDecorator } from '@a11d/metadata'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { construct, deconstruct } from '@a11d/converter'
import type { User } from '#features/identity'
import { validation } from '#infrastructure/validation'
import { createLogger } from '#infrastructure/logging/Logger.js'

/** On whose behalf an operation runs, and in which unit of work. */
export interface OperationContext {
	readonly em: EntityManager
	readonly user: User
}

type OperationConstructor = new (parameters: never) => Operation<unknown, unknown>

/** An operation's parameters as a caller gives them: their fields, without their methods. */
export type ParametersOf<O> = O extends Operation<infer Parameters, unknown> ? { [K in keyof Parameters as Parameters[K] extends (...args: never) => unknown ? never : K]: Parameters[K] } : never

/** What an operation answers with. */
export type ResultOf<O> = O extends Operation<unknown, infer Result> ? Result : never

/** What `call` takes: nothing, where every parameter may be left out. */
type CallArguments<O> = object extends ParametersOf<O> ? [parameters?: ParametersOf<O>] : [parameters: ParametersOf<O>]

/** A value as an address writes it: a date as its instant. */
const textOf = (value: unknown) => value instanceof Date ? value.toISOString() : String(value)

/**
 * One thing a user asks of the server, whichever way it arrives: its `parameters` are what is asked, `run` does it in its
 * context and throws what it refuses. The class carries its facts as metadata, `@label` and `@description` for every
 * reader and `@http` for the route, so a route holds no orchestration of its own.
 */
export abstract class Operation<Parameters = object, Result = unknown> {
	/**
	 * Reads a request into the operation: a body the value converter built is taken as it is, the path's and query's
	 * values joining it; any other body's fields are read as written. A body `@http` names is that parameter, taken as it arrives.
	 */
	static fromRequest(this: OperationConstructor, request: Request): Operation<unknown, unknown> {
		const named = http.get(this)?.body
		if (named) {
			return new this({ ...request.query, ...request.params, [named]: request.body } as never)
		}
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

	/**
	 * Asks the server to run the operation, as the browser and the tests do: the path is filled from the parameters it
	 * names, the body is the parameter `@http` names, or a model's members, or for a POST or PUT every other parameter,
	 * and whatever is left goes in the query, each in its written form.
	 */
	static call<O extends Operation<object, unknown>>(this: new (parameters: never) => O, ...[parameters = {} as ParametersOf<O>]: CallArguments<O>) {
		const facts = http.get(this)
		if (!facts) {
			return Promise.reject(new Error(`${this.name} names no route: declare one with @http`))
		}
		const Parameters = operation.parametersOf(this)
		const given: Record<string, unknown> = { ...parameters }
		const written = deconstruct(Parameters ? Object.assign(new Parameters(), parameters) : parameters)
		const path = facts.path.replace(/:(\w+)/g, (_, key: string) => {
			delete given[key]
			return encodeURIComponent(textOf(written[key]))
		})
		const bodied = facts.method === 'POST' || facts.method === 'PUT'
		// The server's value converter rebuilds a model as its own class, so members only the parameters declare travel beside it.
		const Model = bodied && !facts.body && Parameters ? ModelValueConstructor.modelConstructorsByTypeName.get(ModelValueConstructor.typeNameOf(Parameters.prototype) ?? '') as Constructor<object> | undefined : undefined
		const inBody = (key: string) => key === facts.body || (!facts.body && bodied && (!Model || validation.declares(Model, key)))
		const body = facts.body ? given[facts.body]
			: Model ? Object.assign(new Parameters!(), Object.fromEntries(Object.entries(given).filter(([key]) => inBody(key))))
				: Object.fromEntries(Object.keys(given).filter(inBody).map(key => [key, written[key]]))
		const query = new URLSearchParams(Object.keys(given).filter(key => !inBody(key) && written[key] !== undefined).map(key => [key, textOf(written[key])])).toString()
		const route = query ? `${path}?${query}` : path
		if (facts.type) {
			return Operation.send<ResultOf<O>>(facts.method, route, facts.type, body as BodyInit)
		}
		switch (facts.method) {
			case 'GET':
				return Api.get<ResultOf<O>>(route)
			case 'DELETE':
				return Api.delete<ResultOf<O>>(route)
			case 'POST':
				return Api.post<ResultOf<O>>(route, body)
			case 'PUT':
				return Api.put<ResultOf<O>>(route, body)
		}
	}

	/** Sends a body in a media type of its own, past the JSON transport and its size limit, answered as `Api` answers. */
	private static async send<T>(method: string, route: string, type: string, body: BodyInit) {
		const request: RequestInit = { method, headers: { 'accept': 'application/json', 'content-type': type }, body }
		const response = await fetch(Api.url + route, Api.authenticator?.processRequest(request) ?? request)
		if (response.status >= 400) {
			if (Api.httpErrorConstructor) {
				await new Api.httpErrorConstructor(response).throw()
			}
			throw new Error(response.statusText)
		}
		return JSON.parse(await response.text(), (_, value: unknown) => [...Api.valueConstructors].find(converter => converter.shallConstruct(value))?.construct(value) ?? value) as T
	}

	/** Tagged with the operation's class name (`[App:CompleteTask]`), which the server build keeps as it does not minify. */
	protected readonly logger = createLogger(this.constructor.name)

	constructor(readonly parameters: Parameters) { }

	abstract run(context: OperationContext): Promise<Result>
}

/**
 * How an operation arrives over HTTP: its method and path, the status its result answers with (200, or 204 for none), and
 * the parameter that is the whole body where it is a value of its own, in its media type where that is not JSON.
 */
export interface HttpFacts {
	readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	readonly path: string
	readonly status?: number
	readonly body?: string
	readonly type?: string
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
