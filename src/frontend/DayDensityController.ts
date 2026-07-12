import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Vertical density (zoom) of the week view's day grid — the gesture mechanics live in
 * {@link DensityController}; this owns what the zoom means there.
 *
 * The controller drives a single host inline property, `--grid-min-height`: the timed row's fixed height
 * = `available` (the measured height a whole day fits into) × zoom. The 1440 minute rows inside (.axis,
 * .overlays, mitra-day .entries) use fr tracks, so they sum to exactly this row whatever it is (see the
 * .axis rule in Days.ts for why they must never be a repeated length) — nothing else needs to be kept in
 * sync. Zoom is thus a pure multiplier over "the whole day fits":
 *   zoom 1 → the viewport-fit height: the entire 24h fits, nothing scrolls
 *   zoom 3 → 8h fill the viewport (24 / 3), the rest scrolls
 *
 * Pinning keeps the fraction of the day under the pointer at its screen Y while the density changes —
 * everything in that per-frame path is arithmetic on cached values, no layout reads.
 */
export class DayDensityController extends DensityController {
	/** The timed viewport's height in px — what a whole day fits into (zoom 1). 0 until first measured. */
	private available = 0
	/** What to hold still while the density changes: a fraction of the day (0–1), kept at a screen Y. */
	private anchor?: { fraction: number, clientY: number, hostTop: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.WeekZoom', min: 1, max: 3, rail: '.axis, .timezone' })
	}

	private readonly resizeObserver = new ResizeObserver(() => {
		this.measure()
		this.apply()
	})

	override hostConnected() {
		super.hostConnected()
		this.resizeObserver.observe(this.host)
	}

	// The rows above the timed area (zone header + all-day lane) can change height as data loads, and the
	// now-indicator re-renders every minute — remeasure so a whole day keeps fitting exactly at zoom 1.
	override hostUpdated() {
		this.measure()
		this.apply()
	}

	override hostDisconnected() {
		super.hostDisconnected()
		this.resizeObserver.disconnect()
	}

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

	protected apply() {
		if (!this.available) {
			return // not measured yet — leave the CSS fallback (whole day fits) in place
		}
		// Since zoom ≥ 1 keeps this ≥ the viewport-fit height, the fixed row always fills the viewport.
		this.host.style.setProperty('--grid-min-height', `${this.available * this.zoom}px`)
	}

	/** Remember which fraction of the day sits under `clientY`, so we can keep it there as zoom changes.
	 * The host's top is cached along, so re-pinning every animation frame reads no layout. */
	protected captureAnchor(clientY: number) {
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

	/** After the density changed, scroll so the anchored fraction sits back under its screen Y. */
	protected pin(_previous: number) {
		if (!this.anchor) {
			return
		}
		const contentY = this.timedTop + this.anchor.fraction * this.available * this.zoom
		this.host.scrollTop = contentY - (this.anchor.clientY - this.anchor.hostTop)
	}
}
