import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { Type } from '#infrastructure/model'
import { EntryType } from './EntryType.js'

export type EntryStatusCode = 'todo' | 'doing' | 'done' | 'confirmed' | 'tentative' | 'cancelled'

/**
 * Where an entry stands, RFC 5545's STATUS: how far a task is (NEEDS-ACTION, IN-PROCESS, COMPLETED), whether an event takes
 * place (CONFIRMED, TENTATIVE), and CANCELLED for either. Each names the types it applies to, with its glyph for each, so
 * nothing maps a task's statuses onto an event's: a type flip keeps the one both share and drops the rest. One instance per
 * status, so they compare by identity.
 */
export class EntryStatus {
	static readonly ToDo = new EntryStatus('todo', [[EntryType.Task, 'square']])
	static readonly Doing = new EntryStatus('doing', [[EntryType.Task, 'square-minus']])
	static readonly Done = new EntryStatus('done', [[EntryType.Task, 'square-check-big']])
	static readonly Confirmed = new EntryStatus('confirmed', [[EntryType.Event, 'calendar']])
	static readonly Tentative = new EntryStatus('tentative', [[EntryType.Event, 'calendar-clock']])
	static readonly Cancelled = new EntryStatus('cancelled', [[EntryType.Task, 'square-x'], [EntryType.Event, 'calendar-x']])

	static readonly all: ReadonlyArray<EntryStatus> = [EntryStatus.ToDo, EntryStatus.Doing, EntryStatus.Done, EntryStatus.Confirmed, EntryStatus.Tentative, EntryStatus.Cancelled]

	/** The statuses an entry of `type` can hold, in their order. */
	static forType(type: EntryType) {
		return EntryStatus.all.filter(status => status.appliesTo(type))
	}

	/** A status from its code, or undefined for anything else. */
	static parse(value: unknown): EntryStatus | undefined {
		return value instanceof EntryStatus ? value : EntryStatus.all.find(status => status.code === value)
	}

	private readonly icons: ReadonlyMap<EntryType, string>

	private constructor(
		readonly code: EntryStatusCode,
		/** The types it applies to, each with the glyph it wears there. */
		icons: ReadonlyArray<readonly [EntryType, string]>,
	) {
		this.icons = new Map(icons)
	}

	/** Whether an entry of `type` can hold it: cancelled either a task or an event, the rest one kind alone. */
	appliesTo(type: EntryType | undefined) {
		return !!type && this.icons.has(type)
	}

	/** Its glyph on an entry of `type`, a task's checkbox or an event's calendar, also worn by the dialogs that offer a status as a choice. */
	iconFor(type: EntryType) {
		return this.icons.get(type) ?? ''
	}

	/** Done or cancelled: nothing is left to do, or to happen. */
	get closed() {
		return this === EntryStatus.Done || this === EntryStatus.Cancelled
	}

	format() {
		switch (this.code) {
			case 'todo': return t('To Do')
			case 'doing': return t('Doing')
			case 'done': return t('Done')
			case 'confirmed': return t('Confirmed')
			case 'tentative': return t('Maybe')
			case 'cancelled': return t('Cancelled')
		}
	}

	toString() {
		return this.code
	}

	static readonly converter: Converter<EntryStatusCode | null | undefined, EntryStatus | null | undefined> = {
		schema: z.enum(EntryStatus.all.map(status => status.code)),
		construct: value => value === null ? value : EntryStatus.parse(value),
		deconstruct: value => value?.code ?? value as null | undefined,
	}

	/** Declared through `@enum` with the codes as its items, so the column keeps its CHECK constraint. */
	static readonly Mapper = class extends Type<EntryStatus | null, string | null> {
		override convertToDatabaseValue(value: EntryStatus | string | null | undefined) {
			return EntryStatus.parse(value)?.code ?? null
		}

		override convertToJSValue(value: EntryStatus | string | null | undefined) {
			return EntryStatus.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
