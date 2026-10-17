import { OneToMany } from '@mikro-orm/decorators/legacy'
import { Collection, FlushMode, type EntityClass, type EntityManager, type EventSubscriber, type OneToManyOptions } from '@mikro-orm/core'
import { converter, definitionsOf } from '@a11d/converter'
import { type Entity } from './Entity.js'

interface State<Child extends object> {
	rows?: Collection<Child>
	given?: ReadonlyArray<Child>
}

const states = new WeakMap<object, Map<string, State<object>>>()

function stateOf<Child extends object>(owner: object, key: string): State<Child> {
	let byKey = states.get(owner)
	if (!byKey) {
		byKey = new Map()
		states.set(owner, byKey)
	}
	let state = byKey.get(key)
	if (!state) {
		state = {}
		byKey.set(key, state)
	}
	return state as State<Child>
}

/**
 * A collection value object the domain reads the children as, built from the plain array. `of([])` must be a fresh object each
 * time: MikroORM reads the member off two new instances and takes a value they share by reference as the column's default.
 */
export interface ChildrenCollection<Child extends object> {
	of(children: ReadonlyArray<Child>): Iterable<Child>
}

/** The parents whose children are saved, by class, with the keys holding them. */
const saved = new Map<abstract new (...args: never) => object, Array<string>>()

function read<Child extends object>(owner: object, key: string, as?: () => ChildrenCollection<Child>): Iterable<Child> {
	const { given, rows } = stateOf<Child>(owner, key)
	const children = given ?? (rows?.isInitialized() ? [...rows] : [])
	return as ? as().of(children) : children
}

function write<Child extends object>(owner: object, key: string, value: Iterable<Child> | undefined) {
	stateOf(owner, key).given = [...value ?? []]
}

/** Once an owner holds children, they are its own enumerable property, so a spread of it copies them as any other field. */
function materialize<Child extends object>(owner: object, key: string, as?: () => ChildrenCollection<Child>) {
	if (!Object.getOwnPropertyDescriptor(owner, key)) {
		Object.defineProperty(owner, key, {
			get() { return read(this, key, as) },
			set(value: Iterable<Child> | undefined) { write(this, key, value) },
			enumerable: true,
			configurable: true,
		})
	}
}

/**
 * Declares children kept in their own table as a plain array of the domain: `owner.<key>` reads the rows the ORM loaded, or what was
 * set since, and takes an array in the browser as on the server, where an ORM `Collection` can't change outside a running ORM. The ORM
 * keeps its collection under `_<key>` (`accessor`), held off the instance, so a spread copies the children as a value and never the
 * collection. With `saves`, what was set is written into the rows before every flush ({@link children.subscriber}); without, setting
 * them only changes what this instance shows. The children stay off the wire unless the member declares a `@converter` of its own.
 * With `as`, a collection value object (`() => EntryFiles`, lazily, as entities are named), the domain reads them as one.
 */
export function children<Owner extends object, Child extends object>(entity: () => EntityClass<Child>, mappedBy: (child: Child) => unknown, options?: Partial<OneToManyOptions<Owner, Child>> & {
	as?: () => ChildrenCollection<Child>
	saves?: Child extends Entity ? true : never
}) {
	return (prototype: Owner, key: string) => {
		const field = `_${key}`
		const { as, saves, ...relation } = options ?? {}
		Object.defineProperty(prototype, field, {
			get(this: object) { return stateOf(this, key).rows },
			set(this: object, rows: Collection<Child>) {
				stateOf<Child>(this, key).rows = rows
				materialize(this, key, as)
			},
			configurable: true,
		})
		Object.defineProperty(prototype, key, {
			get(this: object) { return read(this, key, as) },
			set(this: object, value: Iterable<Child> | undefined) {
				write(this, key, value)
				materialize(this, key, as)
			},
			configurable: true,
		})
		if (!definitionsOf(prototype.constructor as never).has(key)) {
			converter({ out: {} })(prototype, key)
		}
		if (saves) {
			const type = prototype.constructor as abstract new (...args: never) => object
			saved.set(type, [...saved.get(type) ?? [], key])
		}
		OneToMany(entity, mappedBy as never, { ...relation, accessor: field } as never)(prototype, key)
	}
}

/** Writes what `owner.<key>` was set to into its rows: a child a row `is` equates it, another becomes a row (a `copy` where another parent's row holds its id), and the rest are removed. */
async function save(em: EntityManager, owner: object, key: string) {
	const state = stateOf<Entity>(owner, key)
	const given = state.given
	if (!given) {
		return
	}
	const property = em.getMetadata().find(owner.constructor as EntityClass<object>)!.properties[`_${key}` as never] as { mappedBy: string, targetMeta: { class: EntityClass<object>, primaryKeys: Array<string> } }
	const rows = state.rows ?? Collection.create<Entity>(owner, `_${key}` as never, undefined, true)
	if (!rows.isInitialized()) {
		await rows.init()
	}
	const left = new Set(rows)
	for (const child of given) {
		const kept = [...left].find(row => row.is(child))
		if (kept) {
			left.delete(kept)
			kept.equate(child)
			continue
		}
		const id = property.targetMeta.primaryKeys[0]!
		// A fresh options object each: the ORM writes into it, and a query inside a flush must not flush again.
		const holder = await em.findOne(property.targetMeta.class, { [id]: (child as unknown as Record<string, unknown>)[id] } as never, { flushMode: FlushMode.COMMIT }) as Entity | null
		const row = holder ? holder.copy().equate(child) : child
		Object.assign(row, { [property.mappedBy]: owner })
		rows.add(row)
	}
	rows.remove([...left])
	state.given = undefined
}

export namespace children {
	/** Saves the children set on every parent declared with `saves`, before every flush, whichever path set them. Registered in the ORM config. */
	export const subscriber: EventSubscriber = {
		async beforeFlush({ em, uow }) {
			const removed = uow.getRemoveStack()
			for (const owner of new Set([...uow.getPersistStack(), ...uow.getIdentityMap()])) {
				if (removed.has(owner)) {
					continue
				}
				for (const [type, keys] of saved) {
					if (owner instanceof type) {
						for (const key of keys) {
							await save(em, owner, key)
						}
					}
				}
			}
		},
	}
}
