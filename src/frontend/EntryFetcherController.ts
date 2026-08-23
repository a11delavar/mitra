import { Controller, eventListener } from '@a11d/lit'
import { Task } from '@lit/task'
import { fetchEvents } from './Api.js'
import { EntryStore } from './EntryStore.js'
import { Relations } from './Relations.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import type { PageCalendar } from './PageCalendar.js'

/** Fetches the entries the calendar shows and keeps them fresh: a refetch per navigation bucket
 * (the task), per server tick (the event stream), and on waking from an absence (see {@link wake}). */
export class EntryFetcherController extends Controller {
	/** Quiet longer than this and a wake refetches. Every save echoes a tick, so an alive session
	 * never crosses it — only a genuine absence (sleep, offline) does. */
	private static readonly staleAfter = 60_000

	private eventSource?: EventSource

	/** When the server was last heard from — a completed fetch or a stream tick. */
	private lastContact = 0

	constructor(override readonly host: PageCalendar) {
		super(host)
	}

	readonly task = new Task(this.host, {
		args: () => {
			// The year strip scrolls far and fast, and every refetch mints a new entry array that re-renders
			// the whole strip. So refetch only when crossing a 6-month BUCKET — the wide ±16-month fetch
			// below keeps the render window covered with margin, so scrolling within a bucket needs no new
			// data. Day-based views refetch per month (their windows are only weeks wide).
			const monthIndex = this.host.navigatingDate.year * 12 + this.host.navigatingDate.month
			const yearView = this.host.view === 'year'
			return [yearView, yearView ? Math.floor(monthIndex / 6) : monthIndex] as const
		},
		task: () => {
			// ±16 months for the year strip (≥ its ~8-month render radius plus the 6-month bucket, so the
			// loaded range never gaps between refetches); ±1 month elsewhere.
			const months = this.host.view === 'year' ? 16 : 1
			const start = this.host.navigatingDate.monthStart.subtract({ months })
			const end = this.host.navigatingDate.monthEnd.add({ months })
			return fetchEvents(start, end)
		},
		onComplete: entries => {
			this.lastContact = Date.now()
			EntryStore.applyServerEntries(entries)
			EntryEditorIntent.settle(entries)
			// Refetches relation closure to keep out-of-window linked entries fresh.
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
		// `withCredentials` so the session cookie rides along behind a cookie-based auth proxy (e.g. Traefik OIDC).
		this.eventSource = new EventSource('/api/events', { withCredentials: true })
		this.eventSource.onmessage = event => {
			this.lastContact = Date.now()
			if (event.data === 'updated') {
				// In place, deliberately WITHOUT a view transition: the store adopts server values onto
				// the same working instances, so a background tick (every save echoes one) repaints
				// same-frame — animating it morphed the grid on every edit and snapped any running
				// view-switch transition to its end. Only navigation animates (see calendarTransition.ts).
				void this.task.run()
			}
		}
	}

	/** Returning to the tab (or to the network) is when an absence surfaces: EventSource retries
	 * transient drops by itself, but a laptop sleep can leave it CLOSED for good — and every tick
	 * broadcast while it was down is missed either way. So revive a dead stream (reconnecting also
	 * re-announces presence, which triggers a server-side sync — see backend/events.ts) and refetch
	 * when the silence was long enough that a tick could have been missed. */
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
