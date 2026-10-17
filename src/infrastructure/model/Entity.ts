import { equals } from '@a11d/equals'

/** What a field is to its entity: part of what tells it apart, or part of what makes two equal. A field with neither role is bookkeeping. */
export type EntityFieldRole = 'identity' | 'equality'

const declarations = new WeakMap<object, Record<EntityFieldRole, Array<string>>>()

function declare(role: EntityFieldRole): PropertyDecorator {
	return (prototype, key) => {
		let roles = declarations.get(prototype)
		if (!roles) {
			roles = { identity: [], equality: [] }
			declarations.set(prototype, roles)
		}
		roles[role].push(String(key))
	}
}

/** Part of what tells the entity apart from every other: a draft without one is only itself. On a getter, an identity computed from other fields. */
export const identity = () => declare('identity')

/** Part of what makes two entities equal, and all a copy carries. */
export const equality = () => declare('equality')

type Init<Self> = new (init: Partial<Self>) => Self

const valuesOf = (entity: object) => entity as Record<string, unknown>

/**
 * A value as a copy takes it: an array or a plain object copied through, an entity as `entity` makes it, and anything else
 * as it is, since a value object (`EntryType`, `TimeZone`, a `DateTime`) is immutable and often told by `===`.
 */
function deep(value: unknown, entity: (nested: Entity) => Entity): unknown {
	if (value instanceof Entity) {
		return entity(value)
	}
	if (Array.isArray(value)) {
		return value.map(item => deep(item, entity))
	}
	if (value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deep(item, entity)]))
	}
	return value
}

/**
 * A thing with an identity, whose fields declare their role (`@identity`, `@equality`) and whose operations follow from them, by
 * identity or by equality: `is` and `equals` compare, `clone` and `copy` make a new one, `assign` and `equate` make this one the
 * other. Copying is deep (see {@link deep}), so no two entities share what either may change. A subclass takes its fields as its
 * constructor's `init`, so a new one is made as the class makes any.
 */
export abstract class Entity {
	/** The fields of `role` on `type`, a base class's first. */
	static fieldsOf(type: abstract new (...args: never) => Entity, role: EntityFieldRole): ReadonlyArray<string> {
		const fields = new Array<string>()
		for (let prototype = type.prototype as object | null; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
			fields.unshift(...declarations.get(prototype)?.[role] ?? [])
		}
		return fields
	}

	private fields(role: EntityFieldRole) {
		return Entity.fieldsOf(this.constructor as typeof Entity, role)
	}

	/** Whether `other` is this one: the same identity, which this one has. The other may be a plain object, as the wire delivers one. */
	is(other: this): boolean {
		const fields = this.fields('identity')
		return this === other || fields.length > 0 && fields.every(field => valuesOf(this)[field] !== undefined && Object[equals](valuesOf(this)[field], valuesOf(other)[field]))
	}

	/** Whether `other` equals this one in every field of equality, whatever their identities. */
	equals(other: this): boolean {
		return this.fields('equality').every(field => Object[equals](valuesOf(this)[field], valuesOf(other)[field]))
	}

	/** The library's equality, which collections compare by: the same one, unchanged. */
	[equals](other: unknown): boolean {
		return other instanceof Entity && other.constructor === this.constructor && this.is(other as this) && this.equals(other as this)
	}

	/** The same one as another instance, identity and bookkeeping included, holding nothing this one holds. */
	clone(): this {
		return new (this.constructor as Init<this>)(taken(this, Object.keys(this), nested => nested.clone()))
	}

	/** An equal one with an identity of its own: the fields of equality, as the class makes a new one; the entities among them copies too. */
	copy(): this {
		return new (this.constructor as Init<this>)(taken(this, this.fields('equality'), nested => nested.copy()))
	}

	/** Makes this one `other`, identity and bookkeeping included: every field either holds, as a spread copies them. */
	assign(other: this): this {
		return Object.assign(this, taken(other, [...new Set([...Object.keys(this), ...Object.keys(other)])], nested => nested.clone()))
	}

	/** Makes this one equal to `other`, keeping its own identity and bookkeeping. */
	equate(other: this): this {
		return Object.assign(this, taken(other, this.fields('equality'), nested => nested.clone()))
	}
}

/** The given fields of `source`, each as a copy takes it. */
function taken<Self>(source: Self, fields: ReadonlyArray<string>, nested: (entity: Entity) => Entity) {
	return Object.fromEntries(fields.map(field => [field, deep(valuesOf(source as object)[field], nested)])) as Partial<Self>
}
