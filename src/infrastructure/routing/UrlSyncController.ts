import { Controller, eventListener } from '@a11d/lit'
import type { PageCalendar } from '../../features/calendar/client/PageCalendar.js'

/**
 * Keeps the page's URL in step with its state without flooding session history: writes REPLACE the
 * current entry, and are coalesced so a continuous gesture writes once, when it settles.
 */
export class UrlSyncController extends Controller {
	/** Long enough that a scroll writes once on settle, short enough to be invisible to a reload. */
	private static readonly settleDelay = 100

	private pending?: ReturnType<typeof setTimeout>
	private known?: string

	constructor(protected override readonly host: PageCalendar) {
		super(host)
	}

	override hostUpdated() {
		this.schedule()
	}

	/** Every render asks, so only a URL that actually moved starts the clock — an unrelated re-render
	 * (an entry saved, a drag frame) must neither write nor postpone a write already due. */
	schedule() {
		if (this.stale) {
			clearTimeout(this.pending)
			this.pending = setTimeout(() => this.write(), UrlSyncController.settleDelay)
		}
	}

	/** A tab can be frozen or discarded between the last change and the settle — which is the very case
	 * the URL is being kept current for. */
	@eventListener({ target: window, type: 'pagehide' })
	@eventListener({ target: document, type: 'visibilitychange' })
	protected write() {
		clearTimeout(this.pending)
		if (this.stale) {
			this.known = this.host.url.href
			history.replaceState(history.state, '', this.known)
		}
	}

	/** Whether a URL the router delivers is a navigation. The router re-renders the page with whatever the address
	 * bar says, so the URL it last delivered, or this controller's own earlier write, arrives again after the state
	 * has moved on; restoring that would undo the move. */
	arrived(url: URL) {
		const news = url.href !== this.known
		this.known = url.href
		return news
	}

	private get stale() {
		return this.host.url.href !== globalThis.location.href
	}

	override hostDisconnected() {
		clearTimeout(this.pending)
	}
}
