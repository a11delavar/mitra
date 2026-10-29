import { createMetadataDecorator } from '@a11d/metadata'

/** What changed for a user: their entries, or their calendars and integrations, after which a page reads both again. */
export type UpdateScope = 'entries' | 'sources'

type UpdateListener = (userId: string, scope: UpdateScope) => void

/** What changed for each user, told to their open pages through the event stream; only the server subscribes and dispatches. */
class Updates {
	private readonly listeners = new Set<UpdateListener>()

	/** Calls `listener` with every update until it unsubscribes, which the function this answers does too. */
	subscribe(listener: UpdateListener) {
		this.listeners.add(listener)
		return () => this.unsubscribe(listener)
	}

	unsubscribe(listener: UpdateListener) {
		this.listeners.delete(listener)
	}

	dispatch(userId: string, scope: UpdateScope) {
		this.listeners.forEach(listener => listener(userId, scope))
	}

	/** Dispatches the update `operation` declared, once its run succeeded; one that declares none dispatches nothing. */
	dispatchFor(operation: object, user: { readonly id: string }) {
		const scope = updates.of(operation)
		if (scope) {
			this.dispatch(user.id, scope)
		}
	}
}

const declared = createMetadataDecorator('updates')
const stream = new Updates()

/**
 * Declares that a run of the operation that succeeded updates `scope` for its user, which every transport then dispatches;
 * the same name is the one stream of updates the event stream subscribes to. Shared, so an operation in the browser can
 * wear the decorator.
 */
export function updates(scope: UpdateScope) {
	return declared(scope)
}

/** The scope `operation`'s class declared it updates, if any. */
updates.of = (operation: object) => declared.get(operation.constructor as Constructor<unknown>) as UpdateScope | undefined
updates.subscribe = (listener: UpdateListener) => stream.subscribe(listener)
updates.unsubscribe = (listener: UpdateListener) => stream.unsubscribe(listener)
updates.dispatch = (userId: string, scope: UpdateScope) => stream.dispatch(userId, scope)
updates.dispatchFor = (operation: object, user: { readonly id: string }) => stream.dispatchFor(operation, user)
