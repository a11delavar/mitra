import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Controls vertical zoom and content pinning for the week view day grid.
 */
export class DayDensityController extends DensityController {
	private available = 0
	private anchor?: { fraction: number, clientY: number, hostTop: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.WeekZoom', min: 1, max: 3, rail: '.axis, .timezone' })
	}

	private static readonly minAvailable = 100

	/** Measure available height for the 24h timed row. */
	private measure() {
		const row = this.host.renderRoot.querySelector('.axis') ?? this.host.renderRoot.querySelector('mitra-day .entries')
		if (!row || this.host.clientHeight === 0) {
			return
		}
		const top = row.getBoundingClientRect().top - this.host.getBoundingClientRect().top + this.host.scrollTop
		const available = this.host.clientHeight - top
		if (available < DayDensityController.minAvailable) {
			return
		}
		this.available = available
	}

	private get timedTop() {
		return this.host.clientHeight - this.available
	}

	protected apply() {
		this.host.style.setProperty('--_week-zoom', `${this.zoom}`)
	}

	/** Capture anchor point under cursor to hold constant during zoom gesture. */
	protected captureAnchor(clientY: number) {
		this.measure()
		if (!this.available) {
			return
		}
		const hostTop = this.host.getBoundingClientRect().top
		const contentY = this.host.scrollTop + clientY - hostTop
		const fraction = Math.min(1, Math.max(0, (contentY - this.timedTop) / (this.available * this.zoom)))
		this.anchor = { fraction, clientY, hostTop }
	}

	protected driftAnchor(clientY: number) {
		if (this.anchor) {
			this.anchor.clientY = clientY
		}
	}

	/** Adjust scrollTop to keep anchored fraction under clientY. */
	protected pin(_previous: number) {
		if (!this.anchor) {
			return
		}
		const contentY = this.timedTop + this.anchor.fraction * this.available * this.zoom
		this.host.scrollTop = contentY - (this.anchor.clientY - this.anchor.hostTop)
	}
}
