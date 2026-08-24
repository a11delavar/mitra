import { Controller, eventListener, type Component } from '@a11d/lit'
import type { DateTime } from '@3mo/date-time'
import { ResizeController } from '@3mo/resize-observer'
import type { CalendarDatesController } from './CalendarDatesController.js'

/**
 * A view's half of the scroll↔date contract: two functions that MUST be exact inverses of each other
 * (see {@link CalendarScrollController}), plus the facts the controller needs to know when a reading
 * is meaningful. All members are functions because they read live view state (measured widths, the
 * rendered scroller, a zoom gesture's flight) — a snapshot would go stale.
 */
export interface CalendarScrollGeometry {
	/** The axis the strip virtualizes — which scroll offset and which box sizes the controller watches. */
	readonly axis: 'inline' | 'block'

	/** The scroll container — resolved per call, since the week-row view renders its scroller in its template. */
	scroller(): HTMLElement | null

	/** Whether offsets are backed by settled measurements. Until then nothing read off the scroll
	 * position may be COMMITTED (the strip is laid out from approximations about to change), while
	 * anchoring is always allowed — an approximate anchor is corrected by the next real one. */
	ready(): boolean

	/** Whether a gesture driver (density-zoom pinning) owns the scroll right now. Its per-frame
	 * pinning scrolls too, and resolving those frames would walk the navigating date through every
	 * intermediate position; the driver re-dispatches one (synthetic) scroll once it lands. */
	suspended?(): boolean

	/**
	 * The content offset (absolute px along the axis) at which `date` reads as the viewport's centre —
	 * deliberately the exact INVERSE of {@link dateAt}, so an arrival and the reading its own scroll
	 * event triggers can never disagree. `scrollIntoView` cannot promise that: with an even number of
	 * visible tracks the centred box straddles two, which is no snap position at all — the mandatory
	 * snap breaks the tie whichever way it likes, and the reading then answers one track off the track
	 * that was framed, which commits as navigation (and as a MONTH hop whenever the track ends one).
	 * Deriving the offset also reaches dates outside the render window, which an element lookup
	 * silently skips. `undefined` while the geometry can't answer yet (no layout, empty buffer).
	 */
	offsetOf(date: DateTime): number | undefined

	/** The date the viewport centres on at content offset `offset` — {@link offsetOf}'s exact inverse. */
	dateAt(offset: number): DateTime | undefined

	/** Whether moving between these two dates is NO navigation at this view's granularity (same day /
	 * week / month) — what keeps a coarse view from overwriting the finer date it was handed. */
	equivalent(a: DateTime, b: DateTime): boolean

	/** After an ARRIVAL (external navigation) anchored the strip's axis — the week view centres the
	 * day's cell on its non-virtualized block axis here. Not called for geometry re-anchors, which
	 * hold the strip still and must never touch the other axis. */
	arrived?(date: DateTime): void
}

/**
 * The scroll↔date contract every calendar view shares: the navigating DATE is the source of truth,
 * and the scroll offset is derived state — never the other way around once geometry has moved.
 *
 * The views virtualize a years-long strip whose track sizes are viewport-fit functions (`100cqi`/
 * `100cqb` integer-fit math), so ANY geometry change — a window resize, the sidebar toggling, the
 * zone lane folding, a buffer regeneration — rescales thousands of offscreen tracks under a pixel
 * offset the browser keeps. The date at that offset drifts proportionally to the distance from the
 * scroll origin (weeks per resize step, near the buffer's middle), and the snap/clamp scroll events
 * the relayout fires would commit the misreading as navigation, compounding per resize frame until
 * the buffer regenerates and the strip dead-ends at its edge. This controller forbids the whole
 * class: a scroll offset is only ever READ against the geometry it was made in.
 *
 * Mechanism: a signature of the scroller's content+client size along the virtualized axis, adopted
 * whenever the date→offset direction runs ({@link anchor}) or a settled reading commits.
 *  - A trusted scroll event under an UNCHANGED signature is the user scrolling: read the centre date
 *    (via the view's {@link CalendarScrollGeometry.dateAt}) and commit it as navigation.
 *  - A trusted scroll event under a CHANGED signature — and likewise a host resize — is geometry
 *    moving under the offset: re-anchor to the held date instead, so the view stays on the dates it
 *    was showing and only the offset changes.
 *  - A SYNTHETIC scroll event (a density controller's settle — the one dispatcher of untrusted
 *    scrolls) is a driver announcing a deliberate geometry change: adopt the new signature and read,
 *    because its pinning held the content point, not the pixel offset.
 * When a committed reading regenerates the buffer (`dates.days` identity changes), every track just
 * shifted under the unchanged offset — re-anchor immediately to the date the reading meant.
 */
export class CalendarScrollController extends Controller {
	private signature?: string

	readonly observer = new ResizeController(this.host, { callback: () => this.handleResize() })

	constructor(
		protected override readonly host: Component,
		private readonly dates: CalendarDatesController,
		private readonly geometry: CalendarScrollGeometry,
	) {
		super(host)
	}

	/** An ARRIVAL — external navigation (Today, the palette, prev/next, a view switch mounting):
	 * adopt `date` and derive the scroll position from it. */
	navigate(date: DateTime) {
		this.dates.navigatingDate = date
		void this.anchor(date).then(() => this.geometry.arrived?.(date))
	}

	/** Re-derive the scroll offset from `date` — the date→offset direction of the contract. Waits for
	 * the pending render (a navigation may just have regenerated the buffer), so the offset math runs
	 * against the tracks it will land in. */
	async anchor(date = this.dates.navigatingDate) {
		await this.host.updateComplete
		const scroller = this.geometry.scroller()
		const offset = scroller ? this.geometry.offsetOf(date) : undefined
		if (!scroller || offset === undefined) {
			return
		}
		const distance = this.geometry.axis === 'inline'
			? Math.max(0, Math.min(offset, scroller.scrollWidth - scroller.clientWidth))
			: Math.max(0, Math.min(offset, scroller.scrollHeight - scroller.clientHeight))
		if (this.geometry.axis === 'inline') {
			// Negated in RTL, where scrollLeft counts backwards — the mirror of the reading's Math.abs().
			scroller.scrollLeft = getComputedStyle(scroller).direction === 'rtl' ? -distance : distance
		} else {
			scroller.scrollTop = distance
		}
		this.signature = this.currentSignature
	}

	/** The geometry a reading is only valid against: content and client size along the virtualized
	 * axis. Any track re-fit changes the content size; any viewport change the client size. */
	private get currentSignature() {
		const scroller = this.geometry.scroller()
		return !scroller ? undefined : this.geometry.axis === 'inline'
			? `${scroller.scrollWidth}:${scroller.clientWidth}`
			: `${scroller.scrollHeight}:${scroller.clientHeight}`
	}

	/** The host resizing is geometry moving under the offset — same verdict as a signature-mismatched
	 * scroll event, needed separately because a resize that leaves the offset valid fires no scroll
	 * event at all, and the strip would silently sit on different dates. */
	private handleResize() {
		if (this.currentSignature !== this.signature) {
			void this.anchor()
		}
	}

	@eventListener('scroll', { capture: true, passive: true })
	protected handleScroll(e: Event) {
		const scroller = this.geometry.scroller()
		// Only the strip's own scroll means navigation — a capturing listener also hears every inner
		// scrollable (the all-day lane's overflow, an open editor's list).
		if (!scroller || e.target !== scroller || !this.geometry.ready() || this.geometry.suspended?.()) {
			return
		}
		const signature = this.currentSignature
		if (e.isTrusted && signature !== this.signature) {
			// Geometry moved under the offset (a resize re-fit the tracks): the offset no longer means
			// the date it did when the user last scrolled — hold the date, never commit the misreading.
			void this.anchor()
			return
		}
		this.signature = signature
		const offset = this.geometry.axis === 'inline' ? Math.abs(scroller.scrollLeft) : scroller.scrollTop
		const read = this.geometry.dateAt(offset)
		if (!read || this.geometry.equivalent(read, this.dates.navigatingDate)) {
			return
		}
		const days = this.dates.days
		this.dates.navigatingDate = read
		if (this.dates.days !== days) {
			// The commit regenerated the buffer around the new date: every track shifted under the
			// unchanged offset, so re-anchor to the date the reading meant.
			void this.anchor(read)
		}
	}
}
