import { OneToMany } from '@mikro-orm/decorators/legacy'
import { Collection, FlushMode, type EntityClass, type EntityManager, type EventSubscriber, type OneToManyOptions } from '@mikro-orm/core'
import { converter, definitionsOf } from '@a11d/converter'
import { type Entity } from './Entity.js'

interface State<Child extends object> {
	rows?: Collection<Child>
	/** What the owner was set to, as set: the collection value object, a plain array, or nothing. */
	given?: Iterable<Child> | object
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
 * A collection value object the domain reads the children as, built from the rows. `of([])` must be a fresh object each
 * time: MikroORM reads the member off two new instances and takes a value they share by reference as the column's default.
 */
export interface ChildrenCollection<Child extends object, Value = Iterable<Child>> {
	of(children: ReadonlyArray<Child>): Value
}

interface Reading<Child extends object, Value> {
	as?: () => ChildrenCollection<Child, Value>
	/** Whether an owner made outside the ORM and given none reads them as `undefined`, since it cannot know them. */
	unknown?: boolean
}

/** The parents whose children are saved, by class, with the keys holding them and how each key's value becomes rows. */
const saved = new Map<abstract new (...args: never) => object, Array<{ key: string, rows?: (value: never) => Iterable<object> }>>()

function read<Child extends object, Value>(owner: object, key: string, { as, unknown }: Reading<Child, Value>): unknown {
	const { given, rows } = stateOf<Child>(owner, key)
	if (given !== undefined) {
		return as && given.constructor !== (as() as unknown) ? as().of([...given as Iterable<Child>]) : given
	}
	if (!rows && unknown) {
		return undefined
	}
	const children = rows?.isInitialized() ? [...rows] : []
	return as ? as().of(children) : children
}

function write<Child extends object>(owner: object, key: string, value: Iterable<Child> | object | undefined) {
	stateOf(owner, key).given = value
}

/** Once an owner holds children, they are its own enumerable property, so a spread of it copies them as any other field. */
function materialize<Child extends object, Value>(owner: object, key: string, reading: Reading<Child, Value>) {
	if (!Object.getOwnPropertyDescriptor(owner, key)) {
		Object.defineProperty(owner, key, {
			get() { return read(this, key, reading) },
			set(value: Iterable<Child> | object | undefined) { write(this, key, value) },
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
 * With `as`, a collection value object (`() => EntryFiles`, lazily, as entities are named), the domain reads them as one; where its
 * values are not the rows (`EntryRelations` holds lines, stored as `EntryRelation` rows), `rows` maps what was set to the rows to
 * save. With `unknown`, an owner made outside the ORM and given none reads them as `undefined`, as a provider may not say.
 */
export function children<Owner extends object, Child extends object, Value = Iterable<Child>>(entity: () => EntityClass<Child>, mappedBy: (child: Child) => unknown, options?: Partial<OneToManyOptions<Owner, Child>> & {
	// `NoInfer`: the child is the entity named, never what the collection's `of` happens to accept.
	as?: () => ChildrenCollection<NoInfer<Child>, Value>
	rows?: (value: Value) => Iterable<NoInfer<Child>>
	unknown?: true
	saves?: Child extends Entity ? true : never
}) {
	return (prototype: Owner, key: string) => {
		const field = `_${key}`
		const { as, rows, unknown, saves, ...relation } = options ?? {}
		const reading = { as, unknown }
		Object.defineProperty(prototype, field, {
			get(this: object) { return stateOf(this, key).rows },
			set(this: object, collection: Collection<Child>) {
				stateOf<Child>(this, key).rows = collection
				materialize(this, key, reading)
			},
			configurable: true,
		})
		Object.defineProperty(prototype, key, {
			get(this: object) { return read(this, key, reading) },
			set(this: object, value: Iterable<Child> | object | undefined) {
				write(this, key, value)
				materialize(this, key, reading)
			},
			configurable: true,
		})
		if (!definitionsOf(prototype.constructor as never).has(key)) {
			converter({ out: {} })(prototype, key)
		}
		if (saves) {
			const type = prototype.constructor as abstract new (...args: never) => object
			saved.set(type, [...saved.get(type) ?? [], { key, rows: rows as never }])
		}
		OneToMany(entity, mappedBy as never, { ...relation, accessor: field } as never)(prototype, key)
	}
}

/** Writes what `owner.<key>` was set to into its rows: a child a row `is` equates it, another becomes a row (a `copy` where another parent's row holds its id), and the rest are removed. */
async function save(em: EntityManager, owner: object, key: string, rowsOf?: (value: never) => Iterable<object>) {
	const state = stateOf<Entity>(owner, key)
	if (state.given === undefined) {
		return
	}
	const given = [...(rowsOf ? rowsOf(state.given as never) : state.given as Iterable<Entity>)] as Array<Entity>
	const metadata = em.getMetadata()
	const property = metadata.find(owner.constructor as EntityClass<object>)!.properties[`_${key}` as never] as { mappedBy: string, targetMeta: { class: EntityClass<object>, primaryKeys: Array<string>, properties: Record<string, { mapToPk?: boolean }> } }
	// A row naming its parent by primary key takes the key, not the entity.
	const parent = property.targetMeta.properties[property.mappedBy]?.mapToPk ? (owner as Record<string, unknown>)[metadata.find(owner.constructor as EntityClass<object>)!.primaryKeys[0]!] : owner
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
		Object.assign(row, { [property.mappedBy]: parent })
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
						for (const { key, rows } of keys) {
							await save(em, owner, key, rows)
						}
					}
				}
			}
		},
	}
}
