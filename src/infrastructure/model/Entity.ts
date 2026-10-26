import { equals } from '@a11d/equals'

/** What a field is to its entity: part of what tells it apart, or part of what makes two equal. A field with neither role is bookkeeping. */
export type EntityFieldRole = 'identity' | 'equality'

const declarations = new WeakMap<object, Record<EntityFieldRole, Array<string>>>()
const carriages = new WeakMap<object, Array<readonly [member: string, key: string]>>()

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

/** A member that goes wherever `key` is taken, as it is, never copied: the entity an id names (`@include`). */
export const carried = (key: string): PropertyDecorator => (prototype, member) => {
	carriages.set(prototype, [...carriages.get(prototype) ?? [], [String(member), key]])
}

type Init<Self> = new (init: Partial<Self>) => Self

const valuesOf = (entity: object) => entity as Record<string, unknown>

/**
 * A value as a copy takes it: an array or a plain object copied through, an entity as `entity` makes it, a collection of entities
 * rebuilt through its class's `of` (as `@children` asks of one), and anything else as it is, since a value object (`EntryType`,
 * `TimeZone`, a `DateTime`) is immutable and often told by `===`.
 */
function deep(value: unknown, entity: (nested: Entity) => Entity): unknown {
	if (value instanceof Entity) {
		return entity(value)
	}
	if (Array.isArray(value)) {
		const items = value.map(item => deep(item, entity))
		// An array of its own kind (`Participants`, `EntryTypes`) stays one, though `map` may answer a plain array (its species).
		return value.constructor === Array ? items : (value.constructor as ArrayConstructor).from(items)
	}
	if (value === null || typeof value !== 'object') {
		return value
	}
	if ([Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deep(item, entity)]))
	}
	const collection = value.constructor as { of?: (items: Array<unknown>) => unknown }
	const items = Symbol.iterator in value && typeof collection.of === 'function' ? [...value as Iterable<unknown>] : []
	return items.length && items.every(item => item instanceof Entity) ? collection.of!(items.map(item => entity(item as Entity))) : value
}

/** What a clone takes of a field outside equality: the entity it points at (a child's holder) left out, anything else as {@link deep} takes it with entities kept. */
function bookkept(value: unknown) {
	return value instanceof Entity ? undefined : deep(value, entity => entity)
}

/**
 * A thing with an identity, whose fields declare their role (`@identity`, `@equality`) and whose operations follow from them, by
 * identity or by equality: `is` and `equals` compare, `clone` and `copy` make a new one, `assign` and `equate` make this one the
 * other. Copying is deep (see {@link deep}) through the fields of equality, so no two entities share what either is made of. The
 * entity another field points at, the holder a child names, is left out: whoever takes the child sets it, and an ORM puts a child
 * into its holder's rows once it names it. A subclass takes its fields as its constructor's `init`, so a new one is made as the
 * class makes any.
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

	/** The carried members of this entity's class, each with the key it follows. */
	private carried() {
		const members = new Array<readonly [member: string, key: string]>()
		for (let prototype = Object.getPrototypeOf(this) as object | null; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
			members.push(...carriages.get(prototype) ?? [])
		}
		return members
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

	/** The same one as another instance, identity and bookkeeping included, holding nothing this one is made of. */
	clone(): this {
		return new (this.constructor as Init<this>)(this.taken(this, Object.keys(this), nested => nested.clone()))
	}

	/** An equal one with an identity of its own: the fields of equality, as the class makes a new one; the entities among them copies too. */
	copy(): this {
		return new (this.constructor as Init<this>)(this.taken(this, this.fields('equality'), nested => nested.copy()))
	}

	/** Makes this one `other`, identity and bookkeeping included: every field either holds, as a spread copies them. */
	assign(other: this): this {
		return Object.assign(this, this.taken(other, [...new Set([...Object.keys(this), ...Object.keys(other)])], nested => nested.clone()))
	}

	/** Makes this one equal to `other`, keeping its own identity and bookkeeping. */
	equate(other: this): this {
		return Object.assign(this, this.taken(other, this.fields('equality'), nested => nested.clone()))
	}

	/** The given fields of `source`, each as a copy takes it: deep through the fields of equality, the rest {@link bookkept}, and a carried member with its key. */
	private taken(source: this, fields: ReadonlyArray<string>, nested: (entity: Entity) => Entity) {
		const equality = new Set(this.fields('equality'))
		const taken = Object.fromEntries(fields.map(field => [field, equality.has(field) ? deep(valuesOf(source)[field], nested) : bookkept(valuesOf(source)[field])]))
		for (const [member, key] of this.carried()) {
			if (fields.includes(key)) {
				taken[member] = valuesOf(source)[member]
			}
		}
		return taken as Partial<this>
	}
}
