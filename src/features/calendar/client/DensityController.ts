import { Controller, eventListener, type Component } from '@a11d/lit'

/**
 * Base controller managing zoom gesture mechanics (pinch, wheel on rail, touch gestures).
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
			readonly rail: string
			readonly initial?: number
			readonly axis?: 'block' | 'inline'
		},
	) {
		super(host)
		this.zoom = this.target = this.clamp(Number(localStorage.getItem(options.storageKey)) || options.initial || options.min)
	}

	private pointerOf(point: { clientX: number, clientY: number }) {
		return this.options.axis === 'inline' ? point.clientX : point.clientY
	}

	protected clamp(zoom: number) {
		return Math.min(this.options.max, Math.max(this.options.min, zoom))
	}

	/** Whether a zoom gesture is mid-flight. */
	get active() {
		return this.frame !== undefined || this.pinch !== undefined
	}

	private settle() {
		localStorage.setItem(this.options.storageKey, String(this.zoom))
		this.settled()
	}

	/** Dispatches synthetic scroll event on gesture settle. Subclasses override when scroller is not host. */
	protected settled() {
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

	protected abstract apply(): void

	protected abstract captureAnchor(pointer: number): void

	protected abstract driftAnchor(pointer: number): void

	protected abstract pin(previous: number): void

	/** Animates zoom toward target value across animation frames. */
	protected setTarget(zoom: number) {
		this.target = this.clamp(zoom)
		this.frame ??= requestAnimationFrame(this.tick)
	}

	private readonly tick = () => {
		this.frame = undefined
		const remaining = this.target - this.zoom
		const previous = this.zoom
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
		const onRail = !!(e.target as Element | null)?.closest?.(this.options.rail)
		if (!e.ctrlKey && !onRail) {
			return
		}
		e.preventDefault()
		this.captureAnchor(this.pointerOf(e))
		this.setTarget(this.target * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
	}

	@eventListener('touchstart', { passive: false })
	protected handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 2) {
			return
		}
		e.preventDefault()
		this.pinch = { startDistance: DensityController.distance(e.touches), startZoom: this.zoom }
		this.captureAnchor(this.midpoint(e.touches))
	}

	@eventListener('touchmove', { passive: false })
	protected handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 2 || !this.pinch) {
			return
		}
		e.preventDefault()
		this.driftAnchor(this.midpoint(e.touches))
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

	private midpoint(touches: TouchList) {
		return (this.pointerOf(touches[0]!) + this.pointerOf(touches[1]!)) / 2
	}
}
