import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { Type } from '#infrastructure/model'

export type TaskStatusCode = 'todo' | 'doing' | 'done' | 'cancelled'

/** Where a task stands, RFC 5545's STATUS of a VTODO. One instance per status, so they compare by identity. */
export class TaskStatus {
	static readonly ToDo = new TaskStatus('todo', 'square')
	static readonly Doing = new TaskStatus('doing', 'square-minus')
	static readonly Done = new TaskStatus('done', 'square-check-big')
	static readonly Cancelled = new TaskStatus('cancelled', 'square-x')

	static readonly all: ReadonlyArray<TaskStatus> = [TaskStatus.ToDo, TaskStatus.Doing, TaskStatus.Done, TaskStatus.Cancelled]

	/** A status from its code, or undefined for anything else. */
	static parse(value: unknown): TaskStatus | undefined {
		return value instanceof TaskStatus ? value : TaskStatus.all.find(status => status.code === value)
	}

	private constructor(
		readonly code: TaskStatusCode,
		/** Its glyph, also worn by the dialogs that offer a status as a choice. */
		readonly icon: string,
	) { }

	/** Done or cancelled: nothing is left to do. */
	get closed() {
		return this === TaskStatus.Done || this === TaskStatus.Cancelled
	}

	format() {
		switch (this.code) {
			case 'todo': return t('To Do')
			case 'doing': return t('Doing')
			case 'done': return t('Done')
			case 'cancelled': return t('Cancelled')
		}
	}

	toString() {
		return this.code
	}

	static readonly converter: Converter<TaskStatusCode | null | undefined, TaskStatus | null | undefined> = {
		schema: z.enum(TaskStatus.all.map(status => status.code)),
		construct: value => value === null ? value : TaskStatus.parse(value),
		deconstruct: value => value?.code ?? value as null | undefined,
	}

	/** Declared through `@enum` with the codes as its items, so the column keeps its CHECK constraint. */
	static readonly Mapper = class extends Type<TaskStatus | null, string | null> {
		override convertToDatabaseValue(value: TaskStatus | string | null | undefined) {
			return TaskStatus.parse(value)?.code ?? null
		}

		override convertToJSValue(value: TaskStatus | string | null | undefined) {
			return TaskStatus.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
