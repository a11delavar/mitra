import { TaskStatus } from '#features/entries'
import type { Source } from '#features/sources'

type Init = {
	readonly entries?: Partial<IntegrationCapabilities['entries']>
	readonly sources?: Partial<IntegrationCapabilities['sources']>
	readonly availability?: boolean
}

/**
 * What an integration can do: which writes it takes, and whether its calendars hold availability. `attach` is whether the user
 * may change an entry's attachments there: a provider may hold files of its own kind and drop any other (Google keeps Drive files).
 * `statuses` are those a task can hold there, a provider of two states (open, done) holding neither Doing nor Cancelled.
 */
export class IntegrationCapabilities {
	readonly entries: { readonly create: boolean, readonly edit: boolean, readonly delete: boolean, readonly rename: boolean, readonly statuses: ReadonlyArray<TaskStatus>, readonly attach: boolean }
	readonly sources: { readonly create: boolean, readonly delete: boolean }
	readonly availability: boolean

	constructor(init: Init = {}) {
		this.entries = { create: true, edit: true, delete: true, rename: true, statuses: TaskStatus.all, attach: true, ...init.entries }
		this.sources = { create: false, delete: false, ...init.sources }
		this.availability = init.availability ?? true
	}

	/** These, with `changes` over them. */
	with(changes: Init) {
		return new IntegrationCapabilities({
			entries: { ...this.entries, ...changes.entries },
			sources: { ...this.sources, ...changes.sources },
			availability: changes.availability ?? this.availability,
		})
	}

	/** In a read-only source, nothing can be written. */
	in(source: Pick<Source, 'readOnly'> | undefined) {
		return !source?.readOnly ? this : this.with({
			entries: { create: false, edit: false, delete: false, rename: false, attach: false },
			sources: { delete: false },
		})
	}
}
