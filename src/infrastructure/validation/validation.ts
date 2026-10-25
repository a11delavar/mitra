import { description } from '@a11d/metadata'
import { definitionsOf } from '@a11d/converter'
import { z } from 'zod'
import { ValidationError } from './ValidationError.js'

declare module '@a11d/converter' {
	// A merged declaration restates the interface's type parameters, though it adds nothing that uses them.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface Converter<Deconstructed = any, Constructed = any> {
		/** The form it reads, which is how a member it converts is shown to whoever writes it. */
		readonly schema?: z.ZodType
	}
}

const declared = new WeakMap<object, Map<string, z.ZodType>>()
const described = new WeakMap<object, z.ZodObject>()

/**
 * Declares what a member holds once built, as a Zod schema: its type, whether it may be absent, its range. A built
 * instance is judged by its members' (`validation.errorsIn`), each failure a `ValidationError` naming its member.
 */
export function validation(schema: z.ZodType) {
	return (prototype: object, key: string) => {
		const schemas = declared.get(prototype.constructor) ?? new Map<string, z.ZodType>()
		declared.set(prototype.constructor, schemas.set(key, schema))
	}
}

/** The classes from `constructor` up, each of which may declare members. */
function *lineOf(constructor: Constructor<object>) {
	for (let each: object | null = constructor; each !== null && each !== Object && each !== Function.prototype; each = Object.getPrototypeOf(each) as object | null) {
		yield each as Constructor<object>
	}
}

/** Every member's schema, a class's own over its base's. */
function schemasOf(constructor: Constructor<object>) {
	const schemas = new Map<string, z.ZodType>()
	for (const each of [...lineOf(constructor)].reverse()) {
		for (const [key, schema] of declared.get(each) ?? []) {
			schemas.set(key, schema)
		}
	}
	return schemas
}

/**
 * The members as whoever writes them sees them, each described by its `@description`: a member whose converter names a
 * form (`schema`) in that form, absent or null where its schema allows, any other as its schema has it. A member
 * with neither is not written by them.
 */
validation.schemaOf = (constructor: Constructor<object>) => {
	let schema = described.get(constructor)
	if (!schema) {
		const held = schemasOf(constructor)
		const converted = definitionsOf(constructor)
		const shape: Record<string, z.ZodType> = {}
		for (const key of new Set([...held.keys(), ...[...converted.keys()].map(String)])) {
			const member = held.get(key)
			const converter = converted.get(key)?.in.get(key)
			let written = converter?.schema ?? member
			if (!written) {
				continue
			}
			if (converter?.schema && (!member || member.safeParse(null).success)) {
				written = written.nullable()
			}
			if (converter?.schema && (!member || member.safeParse(undefined).success)) {
				written = written.optional()
			}
			const words = [...lineOf(constructor)].map(each => description.get(each, key) as string | undefined).find(Boolean)
			shape[key] = words ? written.describe(words) : written
		}
		schema = z.object(shape)
		described.set(constructor, schema)
	}
	return schema
}

/** The members `values` carries as they are written, anything else dropped; what is written wrongly throws as one `AggregateError`. */
validation.read = (constructor: Constructor<object>, values: unknown) => {
	const result = validation.schemaOf(constructor).safeParse(values)
	if (!result.success) {
		throw new AggregateError(result.error.issues.map(issue => new ValidationError(issue.message, issue.path.length ? [issue.path.join('.')] : [])))
	}
	return result.data as Record<string, unknown>
}

/** Every member a built `instance` fails, each a `ValidationError` naming it, none when it stands; it yields them, never throws. */
validation.errorsIn = function *(instance: object) {
	for (const [key, schema] of schemasOf(instance.constructor as Constructor<object>)) {
		const result = schema.safeParse((instance as Record<string, unknown>)[key])
		for (const issue of result.success ? [] : result.error.issues) {
			yield new ValidationError(issue.message, [[key, ...issue.path].join('.')])
		}
	}
}

/** Whether `constructor` or a class it extends declares `key`, by its schema or its converter. */
validation.declares = (constructor: Constructor<object>, key: string) => schemasOf(constructor).has(key) || definitionsOf(constructor).has(key)
