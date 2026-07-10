import { Controller, eventListener, type Component } from '@a11d/lit'

/**
 * Horizontal density (zoom) of the timeline, driven by a trackpad pinch (which the OS delivers as
 * ctrl+wheel) anywhere, a plain wheel over the axis header, or a two-finger touch pinch.
 *
 * The controller owns a single host inline property, `--day-width` = viewport width ÷ zoom, where zoom
 * is the number of DAYS THE VIEWPORT SPANS — persisting a span rather than a pixel width keeps the
 * chosen horizon meaningful across screen sizes. Every day column is a `var(--day-width)` track, so
 * nothing else needs to be kept in sync. Zoom is thus a pure "how much future fits" dial:
 *   zoom 21  → three weeks fill the viewport (the fine-planning end)
 *   zoom 180 → about six months fill it (the roadmap end)
 *
 * Two details make it feel right (mirroring the week view's DayDensityController):
 *  - The zoom EASES toward a target across animation frames, so a coarse mouse-wheel notch animates
 *    instead of jumping.
 *  - The (fractional) day under the pointer is captured before the change and scrolled back under the
 *    pointer after it, so the content stays put under the gesture. All math is in inline-start
 *    coordinates — `|scrollLeft|` is the scrolled distance from the inline start in LTR and RTL alike —
 *    so RTL needs nothing but the sign restored on write. Everything in the per-frame path is
 *    arithmetic on cached values — no layout reads, no jank.
 */
export class TimelineDensityController extends Controller {
	private static readonly storageKey = 'Mitra.TimelineZoom'
	private static readonly min = 21 // three weeks fill the viewport
	private static readonly max = 180 // about six months fill it
	private static readonly initial = 60 // two months — the planning band the view targets

	private static clamp(zoom: number) {
		return Math.min(TimelineDensityController.max, Math.max(TimelineDensityController.min, zoom))
	}

	private zoom = TimelineDensityController.clamp(Number(localStorage.getItem(TimelineDensityController.storageKey)) || TimelineDensityController.initial)
	private target = this.zoom
	/** The viewport's inline size in px — what `zoom` days fit into. 0 until first measured. */
	private available = 0
	private frame?: number
	/** What to hold still while the density changes: a fractional day index, kept at a pointer offset. */
	private anchor?: { dayIndex: number, pointerInline: number, rtl: boolean }
	private pinch?: { startDistance: number, startZoom: number }

	constructor(protected override readonly host: Component) {
		super(host)
	}

	override hostConnected() {
		this.resizeObserver.observe(this.host)
	}

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

	private measure() {
		if (this.host.clientWidth) {
			this.available = this.host.clientWidth
		}
	}

	private get dayWidth() {
		return this.available / this.zoom
	}

	private apply() {
		if (!this.available) {
			return // not measured yet — leave the CSS fallback in place
		}
		this.host.style.setProperty('--day-width', `${this.dayWidth}px`)
	}

	/** Remember which (fractional) day sits under `clientX`, so we can keep it there as zoom changes.
	 * The pointer's inline offset and direction are cached along, so re-pinning every animation frame
	 * reads no layout. */
	private captureAnchor(clientX: number) {
		const rect = this.host.getBoundingClientRect()
		const rtl = getComputedStyle(this.host).direction === 'rtl'
		const pointerInline = rtl ? rect.right - clientX : clientX - rect.left
		const dayIndex = (Math.abs(this.host.scrollLeft) + pointerInline) / this.dayWidth
		this.anchor = { dayIndex, pointerInline, rtl }
	}

	/** After the density changed, scroll so the anchored day sits back under its pointer offset. */
	private pin() {
		if (!this.anchor) {
			return
		}
		const scroll = this.anchor.dayIndex * this.dayWidth - this.anchor.pointerInline
		this.host.scrollLeft = this.anchor.rtl ? -scroll : scroll
	}

	private setTarget(zoom: number) {
		this.target = TimelineDensityController.clamp(zoom)
		this.frame ??= requestAnimationFrame(this.tick)
	}

	private readonly tick = () => {
		this.frame = undefined
		const remaining = this.target - this.zoom
		// Ease ~a quarter of the way each frame; snap when close enough to stop the loop.
		this.zoom = Math.abs(remaining) < 0.005 ? this.target : this.zoom + remaining * 0.25
		this.apply()
		this.pin()
		if (this.zoom !== this.target) {
			this.frame = requestAnimationFrame(this.tick)
		} else {
			localStorage.setItem(TimelineDensityController.storageKey, String(this.zoom))
		}
	}

	@eventListener('wheel', { passive: false })
	protected handleWheel(e: WheelEvent) {
		// Zoom when pinching (ctrl+wheel) anywhere, or when scrolling over the axis header; a plain wheel
		// over the canvas scrolls as usual.
		const onHeader = !!(e.target as Element | null)?.closest?.('.header')
		if (!e.ctrlKey && !onHeader) {
			return
		}
		e.preventDefault()
		this.captureAnchor(e.clientX)
		// Exponential so each notch is a proportional step. Scrolling up (deltaY < 0) magnifies — FEWER
		// days span the viewport, hence the sign is flipped versus the week view's height zoom.
		this.setTarget(this.target * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
	}

	@eventListener('touchstart', { passive: false })
	protected handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 2) {
			return
		}
		e.preventDefault() // claim the two-finger gesture (browser pinch-zoom is off via touch-action)
		this.pinch = { startDistance: TimelineDensityController.distance(e.touches), startZoom: this.zoom }
		this.captureAnchor(TimelineDensityController.midpointX(e.touches))
	}

	@eventListener('touchmove', { passive: false })
	protected handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 2 || !this.pinch) {
			return
		}
		e.preventDefault()
		if (this.anchor) {
			// The pinch centre may drift — keep anchoring to it, in the same inline-start coordinates.
			const rect = this.host.getBoundingClientRect()
			const midpoint = TimelineDensityController.midpointX(e.touches)
			this.anchor.pointerInline = this.anchor.rtl ? rect.right - midpoint : midpoint - rect.left
		}
		// A pinch is continuous, so it drives zoom directly (no easing); spreading fingers magnifies,
		// i.e. fewer days span the viewport — hence the inverted ratio.
		this.zoom = this.target = TimelineDensityController.clamp(this.pinch.startZoom * (this.pinch.startDistance / TimelineDensityController.distance(e.touches)))
		this.apply()
		this.pin()
	}

	@eventListener('touchend')
	@eventListener('touchcancel')
	protected handleTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2 && this.pinch) {
			this.pinch = undefined
			localStorage.setItem(TimelineDensityController.storageKey, String(this.zoom))
		}
	}

	private static distance(touches: TouchList) {
		return Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)
	}

	private static midpointX(touches: TouchList) {
		return (touches[0]!.clientX + touches[1]!.clientX) / 2
	}
}
