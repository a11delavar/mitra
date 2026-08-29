import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Horizontal density controller for the timeline, driving `--timeline-zoom`.
 * Pins the anchor by measured track widths rather than zoom ratios to accommodate integer-pixel day track rounding.
 */
export class TimelineDensityController extends DensityController {
	private anchor?: { inline: number, rtl: boolean, hostStart: number, content: number, width: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.TimelineZoom', min: 1, max: 26, initial: 3, rail: '.header', axis: 'inline' })
	}

	private get trackWidth() {
		return this.host.renderRoot.querySelector('.backdrop .day')?.getBoundingClientRect().width ?? 0
	}

	protected apply() {
		this.host.style.setProperty('--timeline-zoom', String(this.zoom))
	}

	private reference(clientX: number, rtl: boolean, hostStart: number) {
		const width = this.trackWidth
		const inline = Math.abs(clientX - hostStart)
		return !width ? undefined : { rtl, hostStart, inline, content: Math.abs(this.host.scrollLeft) + inline, width }
	}

	protected captureAnchor(clientX: number) {
		const rect = this.host.getBoundingClientRect()
		const rtl = getComputedStyle(this.host).direction === 'rtl'
		this.anchor = this.reference(clientX, rtl, rtl ? rect.right : rect.left)
	}

	protected driftAnchor(clientX: number) {
		if (this.anchor) {
			this.anchor = this.reference(clientX, this.anchor.rtl, this.anchor.hostStart) ?? this.anchor
		}
	}

	protected pin(_previous: number) {
		const anchor = this.anchor
		const width = this.trackWidth
		if (!anchor || !width || width === anchor.width) {
			return
		}
		const scroll = anchor.content * (width / anchor.width) - anchor.inline
		this.host.scrollLeft = anchor.rtl ? -scroll : scroll
	}
}
