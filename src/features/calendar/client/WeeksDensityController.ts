import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Vertical density (zoom) controller for month view week rows.
 * Drives `--month-zoom` host property and quantizes landed zoom to integer week row fits.
 */
export class WeeksDensityController extends DensityController {
	private anchor?: { pointer: number, content: number, pitch: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.MonthZoom', min: 0.2, max: 8, initial: 1, rail: '.week-number, .corner' })
		void host.updateComplete.then(() => {
			this.rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
			const quantized = this.quantized()
			if (quantized !== undefined) {
				this.zoom = quantized
				this.setTarget(quantized)
				this.apply()
			}
		})
	}

	private static readonly idealRem = 8.5
	private static readonly weeks = { min: 2, max: 9 }
	private static readonly minRowRem = 4.5
	private rootFontSize = 16

	private weekBounds(height: number) {
		const { min, max } = WeeksDensityController.weeks
		const fits = Math.floor((height + 1) / (WeeksDensityController.minRowRem * this.rootFontSize + 1))
		return { min, max: Math.max(min, Math.min(max, fits)) }
	}

	private zoomFor(weeks: number, height: number) {
		return ((height + 1) / weeks - 1) / (WeeksDensityController.idealRem * this.rootFontSize)
	}

	protected override clamp(zoom: number) {
		const height = this.scroller?.clientHeight
		if (!height) {
			return super.clamp(zoom)
		}
		const bounds = this.weekBounds(height)
		return Math.min(this.zoomFor(bounds.min, height), Math.max(this.zoomFor(bounds.max, height), zoom))
	}

	private quantized(): number | undefined {
		const height = this.scroller?.clientHeight
		if (!height) {
			return undefined
		}
		const bounds = this.weekBounds(height)
		const raw = (height + 1) / (WeeksDensityController.idealRem * this.rootFontSize * this.zoom + 1)
		return this.zoomFor(Math.min(bounds.max, Math.max(bounds.min, Math.round(raw))), height)
	}

	private get scroller() {
		return this.host?.renderRoot?.querySelector<HTMLElement>('.days') ?? null
	}

	private get pitch() {
		const week = this.host.renderRoot.querySelector('.week')
		return !week ? 0 : week.getBoundingClientRect().height + 1
	}

	protected apply() {
		this.host.style.setProperty('--month-zoom', String(this.zoom))
	}

	private reference(clientY: number) {
		const scroller = this.scroller
		const pitch = this.pitch
		if (!scroller || !pitch) {
			return undefined
		}
		const pointer = clientY - scroller.getBoundingClientRect().top
		return { pointer, content: scroller.scrollTop + pointer, pitch }
	}

	protected captureAnchor(clientY: number) {
		this.host.toggleAttribute('data-zooming', true)
		this.rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
		this.anchor = this.reference(clientY)
	}

	protected driftAnchor(clientY: number) {
		this.anchor = this.reference(clientY) ?? this.anchor
	}

	protected pin(_previous: number) {
		const scroller = this.scroller
		const anchor = this.anchor
		const pitch = this.pitch
		if (!scroller || !anchor || !pitch || pitch === anchor.pitch) {
			return
		}
		scroller.scrollTop = anchor.content * (pitch / anchor.pitch) - anchor.pointer
	}

	protected override settled() {
		const quantized = this.quantized()
		if (quantized !== undefined && Math.abs(quantized - this.zoom) > 0.001) {
			this.setTarget(quantized)
			return
		}
		this.host.toggleAttribute('data-zooming', false)
		this.scroller?.dispatchEvent(new Event('scroll'))
	}
}
