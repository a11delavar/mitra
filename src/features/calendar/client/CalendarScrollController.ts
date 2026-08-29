import { Controller, eventListener, type Component } from '@a11d/lit'
import type { DateTime } from '@3mo/date-time'
import { ResizeController } from '@3mo/resize-observer'
import type { CalendarDatesController } from './CalendarDatesController.js'

/**
 * View-specific scroll geometry interface mapping scroll offsets to dates.
 */
export interface CalendarScrollGeometry {
	readonly axis: 'inline' | 'block'

	scroller(): HTMLElement | null

	ready(): boolean

	suspended?(): boolean

	offsetOf(date: DateTime): number | undefined

	dateAt(offset: number): DateTime | undefined

	equivalent(a: DateTime, b: DateTime): boolean

	arrived?(date: DateTime): void
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

	/** Navigate to date and anchor scroll position. */
	navigate(date: DateTime) {
		this.dates.navigatingDate = date
		void this.anchor(date).then(() => this.geometry.arrived?.(date))
	}

	/** Anchor scroll offset to the specified date. */
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
			scroller.scrollLeft = getComputedStyle(scroller).direction === 'rtl' ? -distance : distance
		} else {
			scroller.scrollTop = distance
		}
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
		if (!scroller || e.target !== scroller || !this.geometry.ready() || this.geometry.suspended?.()) {
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
