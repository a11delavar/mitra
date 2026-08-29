import { Controller, eventListener } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Task } from '@lit/task'
import { fetchEvents } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { Relations } from '../../relations/client/Relations.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
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
			const monthIndex = this.host.navigatingDate.year * 12 + this.host.navigatingDate.month
			const yearView = this.host.view === 'year'
			const timelineView = this.host.view === 'timeline'
			return [yearView, timelineView, timelineView ? 0 : yearView ? Math.floor(monthIndex / 6) : monthIndex] as const
		},
		task: () => {
			if (this.host.view === 'timeline') {
				const today = new DateTime()
				return fetchEvents(today.monthStart.subtract({ months: EntryFetcherController.timelineMonths }), today.monthEnd.add({ months: EntryFetcherController.timelineMonths }))
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
		this.eventSource.onmessage = event => {
			this.lastContact = Date.now()
			if (event.data === 'updated') {
				void this.task.run()
			}
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
