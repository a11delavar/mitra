import { Controller, eventListener, type Component } from '@a11d/lit'
import type { DateTime } from '@3mo/date-time'
import { ResizeController } from '@3mo/resize-observer'
import type { CalendarDatesController } from './CalendarDatesController.js'

/**
 * View-specific scroll geometry interface mapping scroll offsets to dates.
 */
export interface CalendarScrollGeometry {
	readonly axis: 'inline' | 'block'

	/** Where {@link offsetOf} puts the date in the viewport: at its start (default) or its center. */
	readonly alignment?: 'start' | 'center'

	scroller(): HTMLElement | null

	ready(): boolean

	suspended?(): boolean

	offsetOf(date: DateTime): number | undefined

	dateAt(offset: number): DateTime | undefined

	equivalent(a: DateTime, b: DateTime): boolean

	/** Where the other axis rests on arriving at `date`. Both axes move in one scroll, so a glide is never cancelled halfway. */
	arrival?(date: DateTime): number | undefined
}

/**
 * Synchronizes scroll offset with navigating date, anchoring geometry across resizes.
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

	/** Navigate to date and anchor scroll position, gliding there when it is near and the days in view stay loaded. */
	navigate(date: DateTime) {
		const days = this.dates.days
		this.dates.navigatingDate = date
		void this.anchor(date, { arrive: true, glide: this.anchored && (() => this.dates.days === days) })
	}

	/** Whether the date is on screen now, not merely among the rendered days. */
	shows(date: DateTime) {
		const scroller = this.geometry.scroller()
		const offset = scroller ? this.geometry.offsetOf(date) : undefined
		if (!scroller || offset === undefined) {
			return false
		}
		const inline = this.geometry.axis === 'inline'
		const distance = offset - (inline ? Math.abs(scroller.scrollLeft) : scroller.scrollTop)
		const viewport = inline ? scroller.clientWidth : scroller.clientHeight
		return this.geometry.alignment === 'center'
			? Math.abs(distance) < viewport / 2
			: distance >= -1 && distance < viewport
	}

	/**
	 * A change that moved what the user looks at (`reveal`) is followed there, and one within view stays put.
	 * It goes out as `navigate` like any other: the page owns the date, so setting it here would be undone by its next render.
	 */
	@eventListener('reveal')
	protected handleReveal(e: CustomEvent<DateTime>) {
		e.stopPropagation()
		if (!this.shows(e.detail)) {
			this.host.dispatchEvent(new CustomEvent('navigate', { detail: e.detail, bubbles: true, composed: true }))
		}
	}

	private anchored = false
	private glideRunning = false

	/** Any other write to the scroller while this is true cancels the glide. */
	get gliding() { return this.glideRunning }

	/**
	 * Anchor scroll offset to the specified date. A glide happens only within two viewports and without
	 * reduced motion; while it runs the offset is not read back into a date, which would chase the glide.
	 */
	async anchor(date = this.dates.navigatingDate, { glide, arrive }: { glide?: false | (() => boolean), arrive?: boolean } = {}) {
		await this.host.updateComplete
		const scroller = this.geometry.scroller()
		const offset = scroller ? this.geometry.offsetOf(date) : undefined
		if (!scroller || offset === undefined) {
			return
		}
		const inline = this.geometry.axis === 'inline'
		const distance = inline
			? Math.max(0, Math.min(offset, scroller.scrollWidth - scroller.clientWidth))
			: Math.max(0, Math.min(offset, scroller.scrollHeight - scroller.clientHeight))
		const current = inline ? Math.abs(scroller.scrollLeft) : scroller.scrollTop
		const viewport = inline ? scroller.clientWidth : scroller.clientHeight
		const smooth = !!glide && glide() && Math.abs(distance - current) >= 1 && Math.abs(distance - current) <= viewport * 2
			&& !matchMedia('(prefers-reduced-motion: reduce)').matches
		const position = inline && scroller.matches(':dir(rtl)') ? -distance : distance
		const cross = arrive ? this.geometry.arrival?.(date) : undefined
		if (smooth) {
			this.glideRunning = true
			scroller.addEventListener('scrollend', () => this.glideRunning = false, { once: true })
		}
		scroller.scrollTo({
			[inline ? 'left' : 'top']: position,
			...(cross === undefined ? {} : { [inline ? 'top' : 'left']: cross }),
			behavior: smooth ? 'smooth' : 'instant',
		})
		this.anchored = true
		this.signature = this.currentSignature
	}

	private get currentSignature() {
		const scroller = this.geometry.scroller()
		return !scroller ? undefined : this.geometry.axis === 'inline'
			? `${scroller.scrollWidth}:${scroller.clientWidth}`
			: `${scroller.scrollHeight}:${scroller.clientHeight}`
	}

	private handleResize() {
		if (this.currentSignature !== this.signature) {
			void this.anchor()
		}
	}

	@eventListener('scroll', { capture: true, passive: true })
	protected handleScroll(e: Event) {
		const scroller = this.geometry.scroller()
		if (!scroller || e.target !== scroller || this.gliding || !this.geometry.ready() || this.geometry.suspended?.()) {
			return
		}
		const signature = this.currentSignature
		if (e.isTrusted && signature !== this.signature) {
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
			void this.anchor(read)
		}
	}
}
