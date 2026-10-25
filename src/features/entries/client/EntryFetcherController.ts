import { Controller, eventListener } from '@a11d/lit'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { Task } from '@lit/task'
import { ListEntries, ListAllEntries } from '#operations'
import { Calendars } from '#features/sources/client/Calendars.js'
import { TableWindow } from '#features/calendar/client/TableWindow.js'
import type { PageCalendar } from '#features/calendar/client/PageCalendar.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'

/** Fetches and keeps calendar entries synchronized via navigation tasks and SSE. */
export class EntryFetcherController extends Controller {
	private static readonly staleAfter = 60_000
	private static readonly timelineMonths = 6

	private eventSource?: EventSource
	private lastContact = 0

	constructor(override readonly host: PageCalendar) {
		super(host)
	}

	readonly task = new Task(this.host, {
		args: () => {
			const { view, navigatingDate } = this.host
			const monthIndex = navigatingDate.year * 12 + navigatingDate.month
			switch (view) {
				case 'timeline': return ['timeline', 0] as const
				case 'year': return ['year', Math.floor(monthIndex / 6)] as const
				// Today is part of the key: a window counted from it moves on at midnight.
				case 'table': return ['table', `${TableWindow.current.key}:${new DateTime().dayStart.valueOf()}`] as const
				default: return ['grid', monthIndex] as const
			}
		},
		task: async () => {
			const window = this.window
			return { entries: await (window ? ListEntries.call({ start: window.start!, end: window.end! }) : ListAllEntries.call()), window }
		},
		onComplete: ({ entries, window }) => {
			this.lastContact = Date.now()
			EntryStore.applyServerEntries(entries, window)
			EntryEditorIntent.settle(EntryStore.occurrences)
		},
	})

	/** The dates the view fetches, none for every entry. */
	private get window() {
		if (this.host.view === 'timeline') {
			const today = new DateTime()
			return new DateTimeRange(today.monthStart.subtract({ months: EntryFetcherController.timelineMonths }), today.monthEnd.add({ months: EntryFetcherController.timelineMonths }))
		}
		if (this.host.view === 'table') {
			return TableWindow.current.bounds()
		}
		const months = this.host.view === 'year' ? 16 : 1
		return new DateTimeRange(this.host.navigatingDate.monthStart.subtract({ months }), this.host.navigatingDate.monthEnd.add({ months }))
	}

	override hostConnected() {
		this.task.run()
		this.connect()
	}

	override hostDisconnected() {
		this.eventSource?.close()
	}

	private connect() {
		this.eventSource?.close()
		this.eventSource = new EventSource('/api/events', { withCredentials: true })
		this.eventSource.onmessage = async event => {
			this.lastContact = Date.now()
			// Sources change triggers full integration refresh to sync import states, renames, and colors.
			if (event.data === 'sources') {
				await Calendars.fetch().catch(() => undefined)
				this.host.sourcesRefreshed()
			}
			void this.task.run()
		}
	}

	/** Reconnects SSE and refetches on visibility or connectivity recovery if stale. */
	@eventListener({ target: document, type: 'visibilitychange' })
	@eventListener({ target: window, type: 'online' })
	protected wake() {
		if (document.visibilityState !== 'visible') {
			return
		}
		const dead = this.eventSource?.readyState === EventSource.CLOSED
		if (dead) {
			this.connect()
		}
		if (dead || Date.now() - this.lastContact > EntryFetcherController.staleAfter) {
			void this.task.run()
		}
	}
}
