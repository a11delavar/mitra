import { Controller, eventListener, type Component } from '@a11d/lit'

/**
 * The shared mechanics of a view's density (zoom) gesture: a trackpad pinch (which the OS delivers as
 * ctrl+wheel), a plain wheel over the view's rail chrome, or a two-finger touch pinch — eased toward a
 * target across animation frames (so a coarse mouse-wheel notch animates instead of jumping) and
 * persisted per browser. What zoom spatially MEANS — which CSS property it drives, and how the scroll
 * position is pinned while it changes — belongs to the subclass: {@link apply} writes the zoom out;
 * {@link captureAnchor}/{@link driftAnchor}/{@link pin} keep the content under the pointer still, on
 * cached values only — they run per animation frame and must read no layout.
 *
 * Listeners are registered manually rather than via `@eventListener`: the decorator keeps initializers
 * in a set that subclasses end up SHARING with their base (its copy-on-write seeds from a property that
 * never exists), so a decorated subclass would leak its listeners onto every sibling subclass.
 */
export abstract class DensityController extends Controller {
	protected zoom: number
	private target: number
	private frame?: number
	private pinch?: { startDistance: number, startZoom: number }

	constructor(
		protected override readonly host: Component,
		private readonly options: {
			readonly storageKey: string
			readonly min: number
			readonly max: number
			/** The sticky chrome a PLAIN wheel zooms over — ctrl+wheel zooms anywhere. */
			readonly rail: string
		},
	) {
		super(host)
		this.zoom = this.target = this.clamp(Number(localStorage.getItem(options.storageKey)) || options.min)
	}

	private clamp(zoom: number) {
		return Math.min(this.options.max, Math.max(this.options.min, zoom))
	}

	/** Whether a zoom gesture is mid-flight. Scroll handlers deriving state from the scroll position
	 * should skip these frames — the per-frame pinning scrolls too; {@link settle} nudges one real
	 * pass once the gesture lands. */
	get active() {
		return this.frame !== undefined || this.pinch !== undefined
	}

	/** Persist the landed zoom and let the host's scroll handler settle whatever it derives from the
	 * scroll position — the gesture's own (typically skipped) scroll events are all there ever were. */
	private settle() {
		localStorage.setItem(this.options.storageKey, String(this.zoom))
		this.host.dispatchEvent(new Event('scroll'))
	}

	override hostConnected() {
		this.apply()
	}

	override hostDisconnected() {
		if (this.frame !== undefined) {
			cancelAnimationFrame(this.frame)
		}
	}

	/** Write the current {@link zoom} out (typically a host CSS custom property). */
	protected abstract apply(): void

	/** Remember what sits under `clientY`, so {@link pin} can hold it there as the density changes —
	 * caching along whatever layout it needs. */
	protected abstract captureAnchor(clientY: number): void

	/** Follow the anchor to a drifted pointer position (a two-finger pinch's centre moves). */
	protected abstract driftAnchor(clientY: number): void

	/** After the density changed from `previous` to {@link zoom}, scroll the anchor back under its
	 * pointer position. */
	protected abstract pin(previous: number): void

	private setTarget(zoom: number) {
		this.target = this.clamp(zoom)
		this.frame ??= requestAnimationFrame(this.tick)
	}

	private readonly tick = () => {
		this.frame = undefined
		const remaining = this.target - this.zoom
		const previous = this.zoom
		// Ease ~a quarter of the way each frame; snap when close enough to stop the loop.
		this.zoom = Math.abs(remaining) < 0.0005 ? this.target : this.zoom + remaining * 0.25
		this.apply()
		this.pin(previous)
		if (this.zoom !== this.target) {
			this.frame = requestAnimationFrame(this.tick)
		} else {
			this.settle()
		}
	}

	@eventListener('wheel', { passive: false })
	protected handleWheel(e: WheelEvent) {
		// Zoom when pinching (ctrl+wheel) anywhere, or when scrolling over the rail; a plain wheel over
		// the content scrolls as usual.
		const onRail = !!(e.target as Element | null)?.closest?.(this.options.rail)
		if (!e.ctrlKey && !onRail) {
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
		this.pinch = { startDistance: DensityController.distance(e.touches), startZoom: this.zoom }
		this.captureAnchor(DensityController.midpointY(e.touches))
	}

	@eventListener('touchmove', { passive: false })
	protected handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 2 || !this.pinch) {
			return
		}
		e.preventDefault()
		this.driftAnchor(DensityController.midpointY(e.touches)) // the pinch centre may drift
		// A pinch is continuous, so it drives zoom directly (no easing) for a 1:1 feel.
		const previous = this.zoom
		this.zoom = this.target = this.clamp(this.pinch.startZoom * (DensityController.distance(e.touches) / this.pinch.startDistance))
		this.apply()
		this.pin(previous)
	}

	@eventListener('touchend')
	@eventListener('touchcancel')
	protected handleTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2 && this.pinch) {
			this.pinch = undefined
			this.settle()
		}
	}

	private static distance(touches: TouchList) {
		return Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)
	}

	private static midpointY(touches: TouchList) {
		return (touches[0]!.clientY + touches[1]!.clientY) / 2
	}
}
