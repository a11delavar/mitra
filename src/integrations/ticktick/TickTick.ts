import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { Source, Color } from '#features/sources'
import { type Entry, EntryType, TaskStatus } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { EntryRelations, RelationType } from '#features/relations'
import { EntryReminders } from '#features/reminders/EntryReminders.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { Integration, integration, IntegrationCapabilities, IntegrationOwnership } from '#integrations'
import { model, withheld } from '#infrastructure/model'
import { type TickTickClient } from './server/TickTickClient.js'

export interface TickTickCredentials {
	/** The account's address, read on connect from a list's members. */
	username: string
	/** A personal API token (Settings → Account → API Keys). */
	token: string
	/** The account's zone, where a time Mitra holds without one is fixed when written. */
	timeZone: string
}

/** A checklist item inside a task (`kind: 'CHECKLIST'`), never a task of its own. */
export interface TickTickItem {
	id?: string
	title: string
	/** 0 open, 1 done. */
	status: number
	sortOrder?: number
	isAllDay?: boolean
	timeZone?: string
}

/** A task as the Open API serves it. Its dates are instants written `2026-11-02T08:00:00.000+0000`. */
export interface TickTickTask {
	id: string
	projectId: string
	title: string
	/** The text of a `TEXT` task. */
	content?: string
	/** The text of a `CHECKLIST` task, above its items. */
	desc?: string
	kind?: 'TEXT' | 'CHECKLIST' | 'NOTE'
	items?: Array<TickTickItem>
	isAllDay?: boolean
	isFloating?: boolean
	startDate?: string | null
	dueDate?: string | null
	timeZone?: string
	repeatFlag?: string
	repeatFrom?: string
	/** `TRIGGER:-PT15M`: a duration from the date, negative before it. */
	reminders?: Array<string>
	priority?: number
	tags?: Array<string>
	/** -1 won't do, 0 open, 2 done. */
	status?: number
	parentId?: string
	childIds?: Array<string>
	sortOrder?: number
	etag?: string
	modifiedTime?: string
	completedTime?: string
}

export interface TickTickProject {
	id: string
	name: string
	/** `#F18181`, or none where none was picked. */
	color?: string
	sortOrder?: number
	closed?: boolean
	groupId?: string
	permission?: 'read' | 'write' | 'comment'
	kind?: 'TASK' | 'NOTE'
}

export interface TickTickProjectGroup {
	id: string
	name: string
	sortOrder?: number
}

/** What Mitra writes of a task: never priority, tags or its repeat, which a write leaves as TickTick has them. */
export interface TickTickTaskFields {
	title?: string
	content?: string
	desc?: string
	items?: Array<TickTickItem>
	isAllDay?: boolean
	isFloating?: boolean
	startDate?: string | null
	dueDate?: string | null
	timeZone?: string
	reminders?: Array<string>
}

/** TickTick lists as task calendars: a task's one date is the schedule, its checklist items the description's checkboxes. */
@model('TickTick')
@integration('ticktick')
export class TickTick extends Integration<TickTickCredentials> {
	static readonly label: string = 'TickTick'
	static readonly logo: string = 'ticktick'
	static readonly description: string = 'The tasks of your TickTick lists'
	static override readonly docs: string | undefined = 'integrations/ticktick'

	static readonly accountPrefix = 'ticktick://account/'
	static readonly projectPrefix = 'ticktick://project/'
	/** The inbox is no list of the API's: it is asked for by this name, and its tasks name its real id (`inbox` and digits). */
	static readonly inbox = 'inbox'

	static accountUri(username: string) {
		return `${TickTick.accountPrefix}${username}`
	}

	static sourceUri(projectId: string) {
		return `${TickTick.projectPrefix}${projectId.startsWith(TickTick.inbox) ? TickTick.inbox : projectId}`
	}

	static projectIdOf(source: Pick<Source, 'uri'>) {
		const id = source.uri.startsWith(TickTick.projectPrefix) ? source.uri.slice(TickTick.projectPrefix.length) : ''
		if (!id) {
			throw new Error(`Not a TickTick source uri: ${source.uri}`)
		}
		return id
	}

	static taskUrl(task: Pick<TickTickTask, 'id' | 'projectId'>) {
		return `https://ticktick.com/webapp/#p/${task.projectId.startsWith(TickTick.inbox) ? TickTick.inbox : task.projectId}/tasks/${task.id}`
	}

	@converter(withheld<TickTickCredentials>('token')) override credentials!: TickTickCredentials

	@converter({ out: {} }) client?: TickTickClient

	constructor(init?: Partial<TickTick>) {
		super()
		this.credentials = { username: '', token: '', timeZone: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `TickTick integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	/** Tasks move between lists in place. Open, done and won't do, so no Doing; no files of Mitra's, no availability. */
	override get capabilities() {
		return new IntegrationCapabilities({ entries: { statuses: [TaskStatus.ToDo, TaskStatus.Done, TaskStatus.Cancelled], attach: false, move: true }, availability: false })
	}

	/**
	 * A task holds one date: given a start and a due date, a free account keeps the due date as both, so no end is held,
	 * and no due date beside the schedule. Subtasks are mirrored to `parentId`; dependencies have nowhere to go.
	 */
	override get ownership() {
		return new IntegrationOwnership({
			description: 'upstream', allDay: 'upstream', timeZone: 'upstream', reminders: 'upstream',
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
		}
	}

	/** Takes what a read learns of the account: its address, and the zone a time without one is fixed in. */
	adopt({ username, timeZone }: { username?: string, timeZone?: string }) {
		if (username) {
			this.uri = TickTick.accountUri(username)
		}
		this.credentials = {
			...this.credentials,
			username: username || this.credentials.username || 'TickTick',
			timeZone: TimeZone.parse(timeZone)?.id ?? (this.credentials.timeZone || 'UTC'),
		}
	}

	static zoneOf(integration: { credentials: Pick<TickTickCredentials, 'timeZone'> }) {
		return integration.credentials.timeZone || 'UTC'
	}

	// --- Lists ------------------------------------------------------------------------------------

	/**
	 * The open task lists as calendars, the inbox first, then in TickTick's order, each in a group named after it. Note lists
	 * hold notes, which Mitra has no place for; a list shared to read or comment on is read-only.
	 */
	static sourcesFrom(projects: ReadonlyArray<TickTickProject>, groups: ReadonlyArray<TickTickProjectGroup> = []) {
		const groupNames = new Map(groups.map(group => [group.id, group.name]))
		const lists = projects
			.filter(project => !project.closed && project.kind !== 'NOTE')
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
		const inbox = TickTick.sourceUri(TickTick.inbox)
		return [
			new Source({ uri: inbox, name: 'Inbox', entryTypes: [EntryType.Task], color: Color.derivedFrom(inbox), enabled: false }),
			...lists.map(project => {
				const uri = TickTick.sourceUri(project.id)
				const group = project.groupId ? groupNames.get(project.groupId) : undefined
				return new Source({
					uri,
					name: group ? `${group} · ${project.name}` : project.name,
					entryTypes: [EntryType.Task],
					color: Color.parse(project.color) ?? Color.derivedFrom(uri),
					readOnly: project.permission === 'read' || project.permission === 'comment',
					enabled: false,
				})
			}),
		]
	}

	// --- Dates ------------------------------------------------------------------------------------

	/** An instant as TickTick writes one (`+0000` rather than `Z`, which it answers with milliseconds). */
	static instantOf(value: string | null | undefined) {
		return !value ? undefined : new Date(value.replace(/([+-]\d\d)(\d\d)$/, '$1:$2'))
	}

	static writtenOf(instant: Date) {
		return `${instant.toISOString().slice(0, 19)}+0000`
	}

	private static wallClockIn(instant: Date, zone: string) {
		return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDateTime()
	}

	private static instantAt(dateTime: Temporal.PlainDateTime, zone: string) {
		return new Date(dateTime.toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds)
	}

	/**
	 * The schedule a task's one date stands for: a day in the task's zone, a floating wall clock stored as if in UTC, as every
	 * floating time in Mitra is, or an instant in its zone. A span from a plan that keeps one starts the schedule, its end aside.
	 */
	static scheduleOf(task: Pick<TickTickTask, 'startDate' | 'dueDate' | 'isAllDay' | 'isFloating' | 'timeZone'>, zone: string): Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone'> {
		const date = TickTick.instantOf(task.startDate) ?? TickTick.instantOf(task.dueDate)
		if (!date) {
			return { start: undefined, end: undefined, allDay: false, timeZone: undefined }
		}
		const own = TimeZone.parse(task.timeZone)?.id ?? zone
		if (task.isAllDay) {
			const day = TimeZone.of(own).dayOf(date)
			return { start: TimeZone.UTC.midnightOf(day) as never, end: TimeZone.UTC.midnightOf(day.add({ days: 1 })) as never, allDay: true, timeZone: undefined }
		}
		if (task.isFloating) {
			return { start: TickTick.instantAt(TickTick.wallClockIn(date, own), 'UTC') as never, end: undefined, allDay: false, timeZone: EntryTimeZone.floating }
		}
		return { start: date as never, end: undefined, allDay: false, timeZone: EntryTimeZone.parse(own) }
	}

	/** The date the schedule stands for, written as both start and due date, as TickTick keeps one; a day is its midnight in the zone. */
	static datesFrom(entry: Pick<Entry, 'start' | 'allDay' | 'timeZone'>, zone: string): TickTickTaskFields {
		const start = entry.start as Date | undefined
		if (!start) {
			return { startDate: null, dueDate: null }
		}
		const own = entry.timeZone?.zone?.id ?? zone
		const instant = entry.allDay
			? TimeZone.of(own).midnightOf(TimeZone.UTC.dayOf(start))
			: entry.timeZone?.floating ? TickTick.instantAt(TickTick.wallClockIn(start, 'UTC'), own) : start
		const date = TickTick.writtenOf(instant)
		return { isAllDay: !!entry.allDay, isFloating: !entry.allDay && !!entry.timeZone?.floating, startDate: date, dueDate: date, timeZone: own }
	}

	// --- Reminders --------------------------------------------------------------------------------

	private static secondsOf(trigger: string) {
		const match = /^TRIGGER:(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(trigger)
		if (!match) {
			return undefined
		}
		const [, minus, days, hours, minutes, seconds] = match
		const total = Number(days ?? 0) * 86_400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)
		return minus ? -total : total
	}

	/** The minutes before the date each reminder rings. One after it (a day's `P0DT9H0M0S`, 9:00 that day) Mitra cannot hold. */
	static remindersFrom(triggers: ReadonlyArray<string> | undefined) {
		return EntryReminders.normalize((triggers ?? []).flatMap(trigger => {
			const seconds = TickTick.secondsOf(trigger)
			return seconds === undefined || seconds > 0 ? [] : [Math.round(-seconds / 60)]
		}))
	}

	/** The reminders as triggers, keeping those Mitra does not show (after the date) as TickTick has them. */
	static triggersFrom(reminders: ReadonlyArray<number> | undefined, stored: ReadonlyArray<string> | undefined) {
		const kept = (stored ?? []).filter(trigger => (TickTick.secondsOf(trigger) ?? 1) > 0)
		return [...(reminders ?? []).map(minutes => minutes ? `TRIGGER:-PT${minutes}M` : 'TRIGGER:PT0S'), ...kept]
	}

	// --- Text -------------------------------------------------------------------------------------

	private static readonly checkbox = /^- \[( |x|X)\] (.*)$/

	/** A checklist task's items as the description's checkboxes, below its text. */
	static descriptionOf(task: Pick<TickTickTask, 'kind' | 'content' | 'desc' | 'items'>) {
		if (task.kind !== 'CHECKLIST') {
			return task.content ?? ''
		}
		const items = [...task.items ?? []].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(item => `- [${item.status ? 'x' : ' '}] ${item.title}`)
		return [task.desc ?? '', items.join('\n')].filter(Boolean).join('\n\n')
	}

	/**
	 * The description as a task of its kind holds it: a checklist's checkboxes become its items, matched to those it had by
	 * title so each keeps its id, the rest its text. Any other task holds the text whole.
	 */
	static textFrom(description: string, stored: Pick<TickTickTask, 'kind' | 'items'> | undefined): TickTickTaskFields {
		if (stored?.kind !== 'CHECKLIST') {
			return { content: description }
		}
		const unused = [...stored.items ?? []]
		const items = new Array<TickTickItem>()
		const text = new Array<string>()
		for (const line of description.split('\n')) {
			const match = TickTick.checkbox.exec(line)
			if (!match) {
				text.push(line)
				continue
			}
			const title = match[2]!
			const index = unused.findIndex(item => item.title === title)
			const known = index >= 0 ? unused.splice(index, 1)[0] : undefined
			items.push({ ...known ? { id: known.id } : {}, title, status: match[1] === ' ' ? 0 : 1, sortOrder: items.length })
		}
		return { desc: text.join('\n').trim(), items }
	}

	// --- Reading ----------------------------------------------------------------------------------

	static statusOf(task: Pick<TickTickTask, 'status'>) {
		return task.status === 2 ? TaskStatus.Done : task.status === -1 ? TaskStatus.Cancelled : TaskStatus.ToDo
	}

	/**
	 * Its parent as Mitra holds it, beside what Mitra keeps of its own: dependencies, and a parent beyond the account.
	 * A parent among the account's tasks is TickTick's to say.
	 */
	static relationsFrom(task: Pick<TickTickTask, 'parentId'>, stored?: EntryRelations, isTask: (uid: string) => boolean = () => true) {
		const retained = (stored?.writes ?? []).filter(relation => relation.type !== RelationType.Parent || !isTask(relation.targetUid))
		return EntryRelations.of([
			...task.parentId ? [{ type: RelationType.Parent, targetUid: task.parentId }] : [],
			...retained,
		])
	}

	/** Maps a task onto `entry`, keeping the task itself so a write leaves what Mitra does not show as it is. */
	static applyTask(entry: Entry, task: TickTickTask, { zone, relations }: { zone: string, relations?: EntryRelations }) {
		const schedule = TickTick.scheduleOf(task, zone)
		entry.type = EntryType.Task
		entry.uri = task.id
		entry.uid = task.id
		entry.heading = task.title || 'Untitled Task'
		entry.description = TickTick.descriptionOf(task)
		entry.status = TickTick.statusOf(task)
		entry.start = schedule.start
		entry.end = schedule.end
		entry.allDay = schedule.allDay
		entry.timeZone = schedule.timeZone
		entry.estimate = undefined
		entry.due = undefined
		entry.reminders = schedule.start ? TickTick.remindersFrom(task.reminders) : undefined
		entry.relations = relations ?? TickTick.relationsFrom(task)
		entry.percentComplete = undefined
		entry.location = ''
		entry.color = undefined
		entry.recurrence = undefined
		entry.participants = undefined
		entry.transparency = undefined
		entry.visibility = undefined
		entry.data = { raw: JSON.stringify(task), etag: task.etag, url: TickTick.taskUrl(task) }
	}

	static storedTaskOf(entry: Pick<Entry, 'data'>) {
		try {
			return entry.data?.raw ? JSON.parse(entry.data.raw) as TickTickTask : undefined
		} catch {
			return undefined
		}
	}

	// --- Writing ----------------------------------------------------------------------------------

	/** Everything Mitra writes of `entry`, so a new task and a changed one are told the same. */
	static fieldsFrom(entry: Entry, stored: TickTickTask | undefined, zone: string): TickTickTaskFields {
		return {
			title: entry.heading,
			...TickTick.textFrom(entry.description ?? '', stored),
			...TickTick.datesFrom(entry, zone),
			reminders: entry.start ? TickTick.triggersFrom(entry.reminders, stored?.reminders) : [],
		}
	}

	/** The parent TickTick can hold: a task of the account. */
	static parentIdFrom(relations: EntryRelations | undefined, isTask: (uid: string) => boolean) {
		return relations?.writes.find(relation => relation.type === RelationType.Parent && isTask(relation.targetUid))?.targetUid
	}

	/** What a new task is created with, in `projectId` and under its parent. */
	static createdFrom(entry: Entry, projectId: string, { zone, isTask }: { zone: string, isTask: (uid: string) => boolean }) {
		const parentId = TickTick.parentIdFrom(entry.relations, isTask)
		const { startDate, dueDate, ...fields } = TickTick.fieldsFrom(entry, undefined, zone)
		return { projectId, ...fields, ...startDate ? { startDate, dueDate } : {}, ...parentId ? { parentId } : {} }
	}

	/**
	 * Only the fields that differ between what `existing` and `incoming` write, so what Mitra does not show stays; a date
	 * goes with all its fields, as TickTick reads them together. An emptied parent is `''`, which TickTick takes as none.
	 */
	static changesFrom(existing: Entry, incoming: Entry, { zone, isTask }: { zone: string, isTask: (uid: string) => boolean }) {
		const stored = TickTick.storedTaskOf(existing)
		const before = TickTick.fieldsFrom(existing, stored, zone)
		const after = TickTick.fieldsFrom(incoming, stored, zone)
		const dates = ['isAllDay', 'isFloating', 'startDate', 'dueDate', 'timeZone'] as const
		const differs = (key: keyof TickTickTaskFields) => !Object[equals](after[key], before[key])
		const changed: Record<string, unknown> = Object.fromEntries((Object.keys(after) as Array<keyof TickTickTaskFields>)
			.filter(key => !dates.includes(key as typeof dates[number]) && differs(key))
			.map(key => [key, after[key]]))
		if (dates.some(differs)) {
			Object.assign(changed, Object.fromEntries(dates.filter(key => after[key] !== undefined).map(key => [key, after[key]])))
		}
		const parentBefore = TickTick.parentIdFrom(existing.relations, isTask)
		const parentAfter = TickTick.parentIdFrom(incoming.relations, isTask)
		if (parentAfter !== parentBefore) {
			changed.parentId = parentAfter ?? ''
		}
		return changed as TickTickTaskFields & { parentId?: string }
	}
}
