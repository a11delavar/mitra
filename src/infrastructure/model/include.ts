import type { EntityClass } from '@mikro-orm/core'
import { ManyToOne } from '@mikro-orm/decorators/legacy'
import { converter } from '@a11d/converter'
import { carried } from './Entity.js'

const lookups = new Map<object, (id: string) => object | undefined>()
const loaded = new WeakMap<object, Map<string, object>>()

/**
 * The entity an id names (`@include(() => Source, 'sourceId') source!: Source`), read as a member of its own while the id stays
 * what changes it: on the server a read-only relation over the id's column, joined as the entity loads; in the browser found
 * by the id through what {@link include.from} registered for its class, so it is always the one the store holds now. An
 * assigned one wins until the id names another, and travels with the id into a clone or copy. Never on the wire, and kept
 * off the instance, so no spread walks into it.
 */
export function include<Target extends object>(entity: () => EntityClass<Target>, key: string) {
	return (prototype: object, member: string) => {
		const field = `@include ${member}`
		Object.defineProperty(prototype, field, {
			get(this: object) { return loaded.get(this)?.get(member) },
			set(this: object, value: object) { loaded.set(this, (loaded.get(this) ?? new Map<string, object>()).set(member, value)) },
			configurable: true,
		})
		Object.defineProperty(prototype, member, {
			get(this: Record<string, unknown>) {
				const assigned = this[field] as { id?: unknown } | undefined
				const stale = assigned !== undefined && this[key] !== undefined && assigned.id !== this[key]
				return (stale ? undefined : assigned) ?? lookups.get(entity())?.(this[key] as string)
			},
			set(this: Record<string, unknown>, value: object) { this[field] = value },
			configurable: true,
		})
		converter({ out: {} })(prototype, member)
		carried(key)(prototype, member)
		const column = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
		ManyToOne(entity, { persist: false, fieldName: column, eager: true, accessor: field } as never)(prototype, member)
	}
}

/** Where the browser finds an entity of `type` by its id, which `@include` reads where no relation set it. */
include.from = <Target extends object>(type: EntityClass<Target>, lookup: (id: string) => Target | undefined) => {
	lookups.set(type, lookup)
}
