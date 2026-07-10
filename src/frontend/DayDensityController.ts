import { Controller, eventListener, type Component } from '@a11d/lit'

/**
 * Vertical density (zoom) of the week view's day grid, driven by scrolling over the time axis, a trackpad
 * pinch (which the OS delivers as ctrl+wheel), or a two-finger touch pinch.
 *
 * The controller owns a single host inline property, `--grid-min-height`: the timed row's fixed height
 * = `available` (the measured height a whole day fits into) × zoom. The 1440 minute rows inside are fr
 * tracks, so they sum to exactly that row whatever it is (see the .axis rule in Days.ts for why they must
 * never be a repeated length) — nothing else needs to be kept in sync. Zoom is thus a pure multiplier over
 * "the whole day fits":
 *   zoom 1  → the viewport-fit height: the entire 24h fits, nothing scrolls
 *   zoom 3  → 8h fill the viewport (24 / 3), the rest scrolls
 *
 * Two details make it feel right:
 *  - The zoom EASES toward a target across animation frames, so a coarse mouse-wheel notch animates
 *    instead of jumping.
 *  - The fraction of the day under the cursor is captured before the change and scrolled back under the
 *    cursor after it (native scrolling is preventDefault-ed), so the content stays put under the gesture.
 *    Everything in that per-frame path is arithmetic on cached values — no layout reads, no jank.
 */
export class DayDensityController extends Controller {
	private static readonly storageKey = 'Mitra.WeekZoom'
	private static readonly min = 1 // the whole day fits
	private static readonly max = 3 // 8h fill the viewport (24 / 3)

	private static clamp(zoom: number) {
		return Math.min(DayDensityController.max, Math.max(DayDensityController.min, zoom))
	}

	private zoom = DayDensityController.clamp(Number(localStorage.getItem(DayDensityController.storageKey)) || DayDensityController.min)
	private target = this.zoom
	/** The timed viewport's height in px — what a whole day fits into (zoom 1). 0 until first measured. */
	private available = 0
	private frame?: number
	/** What to hold still while the density changes: a fraction of the day (0–1), kept at a screen Y. */
	private anchor?: { fraction: number, clientY: number, hostTop: number }
	private pinch?: { startDistance: number, startZoom: number }

	constructor(protected override readonly host: Component) {
		super(host)
	}

	override hostConnected() {
		this.resizeObserver.observe(this.host)
	}

	// The rows above the timed area (zone header + all-day lane) can change height as data loads, and the
	// now-indicator re-renders every minute — remeasure so a whole day keeps fitting exactly at zoom 1.
	override hostUpdated() {
		this.measure()
		this.apply()
	}

	override hostDisconnected() {
		this.resizeObserver.disconnect()
		if (this.frame !== undefined) {
			cancelAnimationFrame(this.frame)
		}
	}

	private readonly resizeObserver = new ResizeObserver(() => {
		this.measure()
		this.apply()
	})

	/** The height a whole day fits into: the viewport minus everything laid out above the timed row —
	 * measured from the row's actual position rather than by summing the heights of what's above it. */
	private measure() {
		// The axis spans the timed row; without it (hideTime), any day's entries grid does.
		const row = this.host.renderRoot.querySelector('.axis') ?? this.host.renderRoot.querySelector('mitra-day .entries')
		if (!row || this.host.clientHeight === 0) {
			return
		}
		const top = row.getBoundingClientRect().top - this.host.getBoundingClientRect().top + this.host.scrollTop
		this.available = Math.max(1, this.host.clientHeight - top)
	}

	/** The content offset (px from the scroll top) at which the timed row begins = everything above it. */
	private get timedTop() {
		return this.host.clientHeight - this.available
	}

	private apply() {
		if (!this.available) {
			return // not measured yet — leave the CSS fallback (whole day fits) in place
		}
		// Since zoom ≥ 1 keeps this ≥ the viewport-fit height, the fixed row always fills the viewport.
		this.host.style.setProperty('--grid-min-height', `${this.available * this.zoom}px`)
	}

	/** Remember which fraction of the day sits under `clientY`, so we can keep it there as zoom changes.
	 * The host's top is cached along, so re-pinning every animation frame reads no layout. */
	private captureAnchor(clientY: number) {
		const hostTop = this.host.getBoundingClientRect().top
		const contentY = this.host.scrollTop + clientY - hostTop
		const fraction = Math.min(1, Math.max(0, (contentY - this.timedTop) / (this.available * this.zoom)))
		this.anchor = { fraction, clientY, hostTop }
	}

	/** After the density changed, scroll so the anchored fraction sits back under its screen Y. */
	private pin() {
		if (!this.anchor) {
			return
		}
		const contentY = this.timedTop + this.anchor.fraction * this.available * this.zoom
		this.host.scrollTop = contentY - (this.anchor.clientY - this.anchor.hostTop)
	}

	private setTarget(zoom: number) {
		this.target = DayDensityController.clamp(zoom)
		this.frame ??= requestAnimationFrame(this.tick)
	}

	private readonly tick = () => {
		this.frame = undefined
		const remaining = this.target - this.zoom
		// Ease ~a quarter of the way each frame; snap when close enough to stop the loop.
		this.zoom = Math.abs(remaining) < 0.0005 ? this.target : this.zoom + remaining * 0.25
		this.apply()
		this.pin()
		if (this.zoom !== this.target) {
			this.frame = requestAnimationFrame(this.tick)
		} else {
			localStorage.setItem(DayDensityController.storageKey, String(this.zoom))
		}
	}

	@eventListener('wheel', { passive: false })
	protected handleWheel(e: WheelEvent) {
		// Zoom when pinching (ctrl+wheel) anywhere, or when scrolling over the time axis; a plain wheel over
		// the day columns scrolls as usual.
		const onAxis = !!(e.target as Element | null)?.closest?.('.axis, .timezone')
		if (!e.ctrlKey && !onAxis) {
			return
		}
		e.preventDefault()
		this.captureAnchor(e.clientY)
		// Exponential so each notch is a proportional step. Scrolling up (deltaY < 0) magnifies.
		this.setTarget(this.target * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
	}

	@eventListener('touchstart', { passive: false })
	protected handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 2) {
			return
		}
		e.preventDefault() // claim the two-finger gesture (browser pinch-zoom is off via touch-action)
		this.pinch = { startDistance: DayDensityController.distance(e.touches), startZoom: this.zoom }
		this.captureAnchor(DayDensityController.midpointY(e.touches))
	}

	@eventListener('touchmove', { passive: false })
	protected handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 2 || !this.pinch) {
			return
		}
		e.preventDefault()
		if (this.anchor) {
			this.anchor.clientY = DayDensityController.midpointY(e.touches) // the pinch centre may drift
		}
		// A pinch is continuous, so it drives zoom directly (no easing) for a 1:1 feel.
		this.zoom = this.target = DayDensityController.clamp(this.pinch.startZoom * (DayDensityController.distance(e.touches) / this.pinch.startDistance))
		this.apply()
		this.pin()
	}

	@eventListener('touchend')
	@eventListener('touchcancel')
	protected handleTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2 && this.pinch) {
			this.pinch = undefined
			localStorage.setItem(DayDensityController.storageKey, String(this.zoom))
		}
	}

	private static distance(touches: TouchList) {
		return Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)
	}

	private static midpointY(touches: TouchList) {
		return (touches[0]!.clientY + touches[1]!.clientY) / 2
	}
}
