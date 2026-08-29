import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Vertical density zoom controller for the year view months strip.
 */
export class MonthsDensityController extends DensityController {
	private anchor?: { y: number, headerHeight: number, hostTop: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.YearZoom', min: 1, max: 4, rail: '.label, .corner' })
	}

	protected apply() {
		this.host.style.setProperty('--months-zoom', String(this.zoom))
	}

	protected captureAnchor(clientY: number) {
		const hostTop = this.host.getBoundingClientRect().top
		this.anchor = {
			y: clientY - hostTop,
			headerHeight: this.host.querySelector('.corner')?.clientHeight ?? 0,
			hostTop,
		}
	}

	protected driftAnchor(clientY: number) {
		if (this.anchor) {
			this.anchor.y = clientY - this.anchor.hostTop
		}
	}

	protected pin(previous: number) {
		if (!this.anchor || this.zoom === previous) {
			return
		}
		const content = this.host.scrollTop + this.anchor.y - this.anchor.headerHeight
		this.host.scrollTop = content * (this.zoom / previous) + this.anchor.headerHeight - this.anchor.y
	}
}
