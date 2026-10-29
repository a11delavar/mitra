import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { Source, Color } from '#features/sources'
import { type Entry, EntryType, TaskStatus } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { EntryRelations, RelationType } from '#features/relations'
import { TimeZone } from '#features/time/TimeZone.js'
import { Integration, integration, IntegrationCapabilities, IntegrationOwnership } from '#integrations'
import { model, withheld } from '#infrastructure/model'
import { type TodoistClient } from './server/TodoistClient.js'

export interface TodoistCredentials {
	/** The account's name or address, read on connect. */
	username: string
	/** A personal API token (Settings → Integrations → Developer). */
	token: string
	/** The account's zone, where a time Mitra holds without one is fixed when written. */
	timeZone: string
	/** Whether the plan holds deadlines (Pro and Business; Free does not). */
	deadlines: boolean
	/** Whether the plan holds durations, a task's length (Pro and Business; Free does not). */
	durations: boolean
}

/** A task's date: a day (`2026-10-13`), a floating wall clock (`2026-10-13T18:30:00`, no zone), or an instant in a zone. */
export interface TodoistDue {
	date: string
	timezone?: string | null
	/** The words the date was written in (`every other monday`), which carry a repeat's rule. */
	string?: string
	lang?: string | null
	is_recurring?: boolean
}

export interface TodoistDeadline {
	date: string
	lang?: string | null
}

export interface TodoistDuration {
	amount: number
	unit: 'minute' | 'day'
}

/** A task as API v1 serves it (`items` in a sync). */
export interface TodoistTask {
	id: string
	project_id: string
	section_id?: string | null
	parent_id?: string | null
	content: string
	description?: string
	priority?: number
	labels?: Array<string>
	due?: TodoistDue | null
	deadline?: TodoistDeadline | null
	duration?: TodoistDuration | null
	checked?: boolean
	is_deleted?: boolean
	child_order?: number
	updated_at?: string | null
	completed_at?: string | null
}

export interface TodoistProject {
	id: string
	name: string
	/** One of Todoist's named colors ({@link Todoist.colors}). */
	color?: string
	parent_id?: string | null
	child_order?: number
	/** A personal project's place among its siblings, compared as text; a workspace project has none. */
	order_key?: string | null
	inbox_project?: boolean
	is_archived?: boolean
	is_deleted?: boolean
}

export interface TodoistUser {
	id: string
	full_name?: string
	email?: string
	tz_info?: { timezone?: string }
}

/** What the account's plan allows (`user_plan_limits.current`), named by feature. */
export interface TodoistPlanLimits {
	deadlines?: boolean
	durations?: boolean
}

/** What Mitra writes of a task: never priority, labels or section, which stay as Todoist has them. */
export interface TodoistTaskArgs {
	content?: string
	description?: string
	due?: TodoistDue | null
	deadline?: TodoistDeadline | null
	duration?: TodoistDuration | null
}

/** A Sync API command; the client stamps each with its `uuid`. A `temp_id` names a new task to the commands after it. */
export type TodoistCommand =
	| { readonly type: 'item_add', readonly temp_id: string, readonly args: TodoistTaskArgs & { content: string, project_id: string, parent_id?: string } }
	| { readonly type: 'item_update', readonly args: TodoistTaskArgs & { id: string } }
	| { readonly type: 'item_move', readonly args: { id: string, project_id: string } | { id: string, parent_id: string } }
	| { readonly type: 'item_close' | 'item_uncomplete' | 'item_delete', readonly args: { id: string } }

/** How a write reads the account: its zone, and which uids are its tasks, the only parents Todoist can hold. */
export interface TodoistWriteContext {
	readonly zone: string
	readonly isTask: (uid: string) => boolean
}

/** Todoist projects as task calendars: a task's date is the schedule, its duration the end or the estimate, its deadline the due date. */
@model('Todoist')
@integration('todoist')
export class Todoist extends Integration<TodoistCredentials> {
	static readonly label: string = 'Todoist'
	static readonly logo: string = 'todoist'
	static readonly description: string = 'The tasks of your Todoist projects'
	static override readonly docs: string | undefined = 'integrations/todoist'

	static readonly accountPrefix = 'todoist://account/'
	static readonly projectPrefix = 'todoist://project/'

	static accountUri(userId: string) {
		return `${Todoist.accountPrefix}${userId}`
	}

	static sourceUri(projectId: string) {
		return `${Todoist.projectPrefix}${projectId}`
	}

	static projectIdOf(source: Pick<Source, 'uri'>) {
		const id = source.uri.startsWith(Todoist.projectPrefix) ? source.uri.slice(Todoist.projectPrefix.length) : ''
		if (!id) {
			throw new Error(`Not a Todoist source uri: ${source.uri}`)
		}
		return id
	}

	static taskUrl(taskId: string) {
		return `https://app.todoist.com/app/task/${taskId}`
	}

	/** Todoist's project colors by name, as its apps paint them; `charcoal` is what a project has until someone picks one. */
	static readonly colors: Readonly<Record<string, string>> = {
		berry_red: '#b8255f', red: '#db4035', orange: '#ff9933', yellow: '#fad000', olive_green: '#afb83b', lime_green: '#7ecc49',
		green: '#299438', mint_green: '#6accbc', teal: '#158fad', sky_blue: '#14aaf5', light_blue: '#96c3eb', blue: '#4073ff',
		grape: '#884dff', violet: '#af38eb', lavender: '#eb96eb', magenta: '#e05194', salmon: '#ff8d85', charcoal: '#808080',
		grey: '#b8b8b8', taupe: '#ccac93',
	}

	@converter(withheld<TodoistCredentials>('token')) override credentials!: TodoistCredentials

	@converter({ out: {} }) client?: TodoistClient

	constructor(init?: Partial<Todoist>) {
		super()
		this.credentials = { username: '', token: '', timeZone: '', deadlines: false, durations: false }
		Object.assign(this, init)
	}

	override toString() {
		return `Todoist integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	/** Tasks move between projects in place. Two states only, open and done, so no Doing and no Cancelled; no files of Mitra's, no availability. */
	override get capabilities() {
		return new IntegrationCapabilities({ entries: { statuses: [TaskStatus.ToDo, TaskStatus.Done], attach: false, move: true }, availability: false })
	}

	/**
	 * Subtasks are mirrored to `parent_id`, but dependencies have nowhere to go, so the relations are Mitra's. Deadlines are
	 * held only where the plan has them, and a length, the end or the estimate, only where it has durations.
	 */
	override get ownership() {
		return new IntegrationOwnership({
			description: 'upstream', allDay: 'upstream', timeZone: 'upstream',
			...this.credentials.deadlines ? { due: 'upstream' } : {},
			...this.credentials.durations ? { end: 'upstream', estimate: 'upstream' } : {},
			relations: 'mitra', rank: 'mitra',
		})
	}

	override get canConnect() {
		return !!this.credentials.token
	}

	override get syncInterval() { return 60_000 }

	override merge(incoming: this) {
		this.credentials = {
			username: this.credentials.username ?? '',
			token: incoming.credentials?.token || this.credentials.token,
			timeZone: this.credentials.timeZone ?? '',
			deadlines: this.credentials.deadlines ?? false,
			durations: this.credentials.durations ?? false,
		}
	}

	/** Takes what a read learns of the account: who it is, its zone, and what its plan allows, which a delta names only once it changes. */
	adopt({ user, limits }: { user?: TodoistUser, limits?: TodoistPlanLimits }) {
		if (user) {
			this.uri = Todoist.accountUri(user.id)
			this.credentials = {
				...this.credentials,
				username: user.email || user.full_name || 'Todoist',
				timeZone: TimeZone.parse(user.tz_info?.timezone)?.id ?? 'UTC',
			}
		}
		if (limits) {
			this.credentials = { ...this.credentials, deadlines: !!limits.deadlines, durations: !!limits.durations }
		}
	}

	static zoneOf(integration: { credentials: Pick<TodoistCredentials, 'timeZone'> }) {
		return integration.credentials.timeZone || 'UTC'
	}

	// --- Projects ---------------------------------------------------------------------------------

	/**
	 * The active projects as calendars, in Todoist's order, the Inbox first and a nested one named after its parents. A
	 * project keeps its color unless none was ever picked, which would paint every calendar of a new account grey.
	 */
	static sourcesFrom(projects: ReadonlyArray<TodoistProject>) {
		const active = projects.filter(project => !project.is_archived && !project.is_deleted)
		const ids = new Set(active.map(project => project.id))
		// Personal projects sort by their key (their `child_order` is 0 throughout), workspace projects, which have none, after them.
		const key = (project: TodoistProject) => project.order_key ?? '\uffff'
		const order = (a: TodoistProject, b: TodoistProject) => Number(!!b.inbox_project) - Number(!!a.inbox_project)
			|| (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)
			|| (a.child_order ?? 0) - (b.child_order ?? 0)
		const childrenOf = (parentId: string | undefined) => active
			.filter(project => (project.parent_id && ids.has(project.parent_id) ? project.parent_id : undefined) === parentId)
			.sort(order)
		const sources = new Array<Source>()
		const walk = (parentId: string | undefined, path: ReadonlyArray<string>) => {
			for (const project of childrenOf(parentId)) {
				const uri = Todoist.sourceUri(project.id)
				const names = [...path, project.name]
				const color = project.color && project.color !== 'charcoal' ? Color.parse(Todoist.colors[project.color]) : undefined
				sources.push(new Source({ uri, name: names.join(' · '), entryTypes: [EntryType.Task], color: color ?? Color.derivedFrom(uri), enabled: false }))
				walk(project.id, names)
			}
		}
		walk(undefined, [])
		return sources
	}

	// --- Reading ----------------------------------------------------------------------------------

	private static minutesOf(duration: TodoistDuration | null | undefined) {
		return !duration ? undefined : duration.amount * (duration.unit === 'day' ? 24 * 60 : 1)
	}

	private static instantOf(dateTime: Temporal.PlainDateTime, zone: string) {
		return new Date(dateTime.toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds)
	}

	/** The schedule a date stands for. A floating time is stored as if in UTC, as every floating time in Mitra is. */
	static scheduleOf(task: Pick<TodoistTask, 'due' | 'duration'>): Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone' | 'estimate'> {
		const minutes = Todoist.minutesOf(task.duration)
		const due = task.due
		if (!due?.date) {
			return { start: undefined, end: undefined, allDay: false, timeZone: undefined, estimate: minutes }
		}
		if (!due.date.includes('T')) {
			const day = Temporal.PlainDate.from(due.date)
			const days = task.duration?.unit === 'day' ? Math.max(1, task.duration.amount) : 1
			return { start: TimeZone.UTC.midnightOf(day) as never, end: TimeZone.UTC.midnightOf(day.add({ days })) as never, allDay: true, timeZone: undefined, estimate: undefined }
		}
		const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(due.date)
		const timeZone = zoned || due.timezone ? EntryTimeZone.parse(due.timezone) : EntryTimeZone.floating
		const start = zoned
			? new Date(Temporal.Instant.from(due.date).epochMilliseconds)
			: Todoist.instantOf(Temporal.PlainDateTime.from(due.date), timeZone?.clock.id ?? 'UTC')
		return {
			start: start as never,
			end: minutes ? new Date(start.getTime() + minutes * 60_000) as never : undefined,
			allDay: false,
			timeZone,
			estimate: undefined,
		}
	}

	/** A deadline is a day: the due date itself beside a day's schedule, else the end of that working day on the schedule's clock. */
	static dueOf(deadline: TodoistDeadline | null | undefined, schedule: Pick<Entry, 'allDay' | 'timeZone'>, zone: string) {
		if (!deadline?.date) {
			return undefined
		}
		const day = Temporal.PlainDate.from(deadline.date)
		return (schedule.allDay
			? TimeZone.UTC.midnightOf(day)
			: Todoist.instantOf(day.toPlainDateTime({ hour: 17 }), schedule.timeZone?.clock.id ?? zone)) as never
	}

	/**
	 * Its parent as Mitra holds it, beside what Mitra keeps of its own: dependencies, and a parent beyond the account.
	 * A parent among the account's tasks is Todoist's to say.
	 */
	static relationsFrom(task: Pick<TodoistTask, 'parent_id'>, stored?: EntryRelations, isTask: (uid: string) => boolean = () => true) {
		const retained = (stored?.writes ?? []).filter(relation => relation.type !== RelationType.Parent || !isTask(relation.targetUid))
		return EntryRelations.of([
			...task.parent_id ? [{ type: RelationType.Parent, targetUid: task.parent_id }] : [],
			...retained,
		])
	}

	/** Maps a task onto `entry`, keeping the task itself so a write leaves what Mitra does not show as it is. */
	static applyTask(entry: Entry, task: TodoistTask, { ownership, zone, relations }: { ownership: Pick<IntegrationOwnership, 'holds'>, zone: string, relations?: EntryRelations }) {
		const schedule = Todoist.scheduleOf(task)
		const deadline = ownership.holds('due') ? task.deadline : undefined
		entry.type = EntryType.Task
		entry.uri = task.id
		entry.uid = task.id
		entry.heading = task.content || 'Untitled Task'
		entry.description = task.description ?? ''
		entry.status = task.checked ? TaskStatus.Done : TaskStatus.ToDo
		entry.start = schedule.start
		entry.end = schedule.end
		// Without a schedule, the precision is the deadline's, a day.
		entry.allDay = schedule.allDay || (!schedule.start && !!deadline)
		entry.timeZone = schedule.timeZone
		entry.estimate = schedule.estimate
		entry.due = Todoist.dueOf(deadline, entry, zone)
		entry.relations = relations ?? Todoist.relationsFrom(task)
		entry.percentComplete = undefined
		entry.location = ''
		entry.color = undefined
		entry.reminders = undefined
		entry.recurrence = undefined
		entry.participants = undefined
		entry.transparency = undefined
		entry.visibility = undefined
		entry.data = { raw: JSON.stringify(task), etag: task.updated_at ?? undefined, url: Todoist.taskUrl(task.id) }
	}

	static storedTaskOf(entry: Pick<Entry, 'data'>) {
		try {
			return entry.data?.raw ? JSON.parse(entry.data.raw) as TodoistTask : undefined
		} catch {
			return undefined
		}
	}

	// --- Writing ----------------------------------------------------------------------------------

	private static wallClockOf(instant: Date, zone: string) {
		return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' })
	}

	/**
	 * The date the schedule stands for, keeping a repeat's words and language, so moving a repeating task moves its next
	 * date and keeps its rule. A time without a zone is fixed in the account's.
	 */
	static dueFrom(entry: Pick<Entry, 'start' | 'allDay' | 'timeZone'>, stored: TodoistDue | null | undefined, zone: string) {
		const start = entry.start as Date | undefined
		if (!start) {
			return null
		}
		const repeat = stored?.is_recurring ? { string: stored.string, lang: stored.lang, is_recurring: true } : {}
		if (entry.allDay) {
			return { date: TimeZone.UTC.dayOf(start).toString(), timezone: null, ...repeat }
		}
		if (entry.timeZone?.floating) {
			return { date: Todoist.wallClockOf(start, 'UTC'), timezone: null, ...repeat }
		}
		return { date: Temporal.Instant.fromEpochMilliseconds(start.getTime()).toString({ smallestUnit: 'second' }), timezone: entry.timeZone?.id ?? zone, ...repeat }
	}

	/**
	 * The span's length, or the estimate while there is none. A one-day schedule has no length in Todoist, so the minutes
	 * a task on a day carried stay.
	 */
	static durationFrom(entry: Pick<Entry, 'start' | 'end' | 'allDay' | 'estimate'>, stored: TodoistDuration | null | undefined): TodoistDuration | null {
		const start = entry.start as Date | undefined
		const end = entry.end as Date | undefined
		if (!start) {
			return entry.estimate ? { amount: entry.estimate, unit: 'minute' } : null
		}
		if (!end) {
			return null
		}
		if (entry.allDay) {
			const days = TimeZone.UTC.dayOf(start).until(TimeZone.UTC.dayOf(end)).days
			return days > 1 ? { amount: days, unit: 'day' } : stored?.unit === 'minute' ? stored : null
		}
		const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
		return minutes > 0 ? { amount: minutes, unit: 'minute' } : null
	}

	/** The due date's day on the schedule's clock. Todoist keeps no time on a deadline, so a due time is lost. */
	static deadlineFrom(entry: Pick<Entry, 'due' | 'allDay' | 'timeZone'>, zone: string) {
		const due = entry.due as Date | undefined
		return !due ? null : { date: (entry.allDay ? TimeZone.UTC : (entry.timeZone?.clock ?? TimeZone.of(zone))).dayOf(due).toString() }
	}

	/** The parent Todoist can hold: a task of the account. Todoist moves a subtask into its parent's project. */
	static parentIdFrom(relations: EntryRelations | undefined, isTask: (uid: string) => boolean) {
		return relations?.writes.find(relation => relation.type === RelationType.Parent && isTask(relation.targetUid))?.targetUid
	}

	/** Everything Mitra writes of `entry`, so a new task and a changed one are told the same. A plan without durations holds no estimate and no length. */
	static argsFrom(entry: Entry, stored: TodoistTask | undefined, ownership: Pick<IntegrationOwnership, 'holds'>, zone: string) {
		return {
			content: entry.heading,
			description: entry.description ?? '',
			due: Todoist.dueFrom(entry, stored?.due, zone),
			...ownership.holds('estimate') ? { duration: Todoist.durationFrom(entry, stored?.duration) } : {},
			...ownership.holds('due') ? { deadline: Todoist.deadlineFrom(entry, zone) } : {},
		}
	}

	/** The commands that create `entry` in `projectId`: a done task is added, then closed. */
	static addCommandsFor(entry: Entry, { projectId, tempId, ownership, context }: { projectId: string, tempId: string, ownership: Pick<IntegrationOwnership, 'holds'>, context: TodoistWriteContext }) {
		const { due, deadline, duration, ...args } = Todoist.argsFrom(entry, undefined, ownership, context.zone)
		const parentId = Todoist.parentIdFrom(entry.relations, context.isTask)
		return [
			{
				type: 'item_add', temp_id: tempId, args: {
					...args, project_id: projectId,
					...parentId ? { parent_id: parentId } : {},
					...due ? { due } : {},
					...deadline ? { deadline } : {},
					...duration ? { duration } : {},
				},
			},
			...entry.done ? [{ type: 'item_close', args: { id: tempId } } as const] : [],
		] satisfies Array<TodoistCommand>
	}

	/**
	 * The commands that make the task `existing` stands for into `incoming`: only the fields that differ, so what Mitra
	 * does not show stays, then a move, then completion. Both are written out the same way and compared there.
	 */
	static commandsFor(existing: Entry, incoming: Entry, { projectId, ownership, context }: { projectId: string, ownership: Pick<IntegrationOwnership, 'holds'>, context: TodoistWriteContext }) {
		const id = existing.uri
		if (!id) {
			throw new Error('This entry has no Todoist task id')
		}
		const stored = Todoist.storedTaskOf(existing)
		const before = Todoist.argsFrom(existing, stored, ownership, context.zone)
		const after = Todoist.argsFrom(incoming, stored, ownership, context.zone)
		const changed = Object.fromEntries(Object.entries(after).filter(([key, value]) => !Object[equals](value, before[key as keyof typeof before])))

		const commands = new Array<TodoistCommand>()
		if (Object.keys(changed).length) {
			commands.push({ type: 'item_update', args: { id, ...changed } })
		}

		const parentBefore = Todoist.parentIdFrom(existing.relations, context.isTask)
		const parentAfter = Todoist.parentIdFrom(incoming.relations, context.isTask)
		if (parentAfter && parentAfter !== parentBefore) {
			commands.push({ type: 'item_move', args: { id, parent_id: parentAfter } })
		} else if ((!parentAfter && parentBefore) || (stored && stored.project_id !== projectId)) {
			commands.push({ type: 'item_move', args: { id, project_id: projectId } })
		}

		if (existing.done !== incoming.done) {
			commands.push({ type: incoming.done ? 'item_close' : 'item_uncomplete', args: { id } })
		}
		return commands
	}
}
