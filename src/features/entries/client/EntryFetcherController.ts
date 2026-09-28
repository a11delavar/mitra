import { Controller, eventListener } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Task } from '@lit/task'
import { fetchAllEntries, fetchEvents, fetchIntegrations } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { Relations } from '../../relations/client/Relations.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { TableWindow } from '../../calendar/client/TableWindow.js'
import type { PageCalendar } from '../../calendar/client/PageCalendar.js'

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
		task: () => {
			if (this.host.view === 'timeline') {
				const today = new DateTime()
				return fetchEvents(today.monthStart.subtract({ months: EntryFetcherController.timelineMonths }), today.monthEnd.add({ months: EntryFetcherController.timelineMonths }))
			}
			if (this.host.view === 'table') {
				const bounds = TableWindow.current.bounds()
				return !bounds ? fetchAllEntries() : fetchEvents(bounds.start, bounds.end)
			}
			const months = this.host.view === 'year' ? 16 : 1
			const start = this.host.navigatingDate.monthStart.subtract({ months })
			const end = this.host.navigatingDate.monthEnd.add({ months })
			return fetchEvents(start, end)
		},
		onComplete: entries => {
			this.lastContact = Date.now()
			EntryStore.applyServerEntries(entries)
			EntryEditorIntent.settle(entries)
			void Relations.refresh().catch(() => void 0)
		},
	})

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
				await fetchIntegrations().catch(() => undefined)
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
