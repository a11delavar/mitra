import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Vertical density (zoom) of the week view's day grid — the gesture mechanics live in
 * {@link DensityController}; this owns what the zoom means there.
 *
 * The controller drives a single host inline property, `--_week-zoom`: a bare multiplier over "the
 * whole day fits". The timed row's height is a pure CSS formula on it — zoom × (100% minus the header
 * and all-day rows, see the grid-template-rows rule in Days.ts) — so this controller measures NOTHING
 * to size the grid: a window resize re-resolves the row in the same layout pass, with no observer lag
 * and no way for a stale measurement to lock the layout in (which a px-valued row once did — the
 * remeasure read its own bloat back). Zoom is thus:
 *   zoom 1 → the viewport-fit height: the entire 24h fits, nothing scrolls
 *   zoom 3 → 8h fill the viewport (24 / 3), the rest scrolls
 *
 * Layout IS still read for pinning — keeping the fraction of the day under the pointer at its screen Y
 * while the density changes — but only once per gesture ({@link captureAnchor}); the per-frame path is
 * arithmetic on those cached values.
 */
export class DayDensityController extends DensityController {
	/** The timed viewport's height in px — what a whole day fits into (zoom 1). Captured per gesture. */
	private available = 0
	/** What to hold still while the density changes: a fraction of the day (0–1), kept at a screen Y. */
	private anchor?: { fraction: number, clientY: number, hostTop: number }

	constructor(host: Component) {
		super(host, { storageKey: 'Mitra.WeekZoom', min: 1, max: 3, rail: '.axis, .timezone' })
	}

	/** Below this, a measured `available` is treated as a transient degenerate reading and ignored —
	 * a viewport briefly shrunk to ≤ the timed row's offset (e.g. mid-resize) would otherwise anchor
	 * the gesture's pinning math to garbage. */
	private static readonly minAvailable = 100

	/** The height a whole day fits into: the viewport minus everything laid out above the timed row —
	 * measured from the row's actual position rather than by summing the heights of what's above it. */
	private measure() {
		// The axis spans the timed row; without it (hideTime), any day's entries grid does.
		const row = this.host.renderRoot.querySelector('.axis') ?? this.host.renderRoot.querySelector('mitra-day .entries')
		if (!row || this.host.clientHeight === 0) {
			return
		}
		const top = row.getBoundingClientRect().top - this.host.getBoundingClientRect().top + this.host.scrollTop
		const available = this.host.clientHeight - top
		// A transiently tiny viewport yields a degenerate (or negative) height — keep the last good value.
		if (available < DayDensityController.minAvailable) {
			return
		}
		this.available = available
	}

	/** The content offset (px from the scroll top) at which the timed row begins = everything above it. */
	private get timedTop() {
		return this.host.clientHeight - this.available
	}

	protected apply() {
		this.host.style.setProperty('--_week-zoom', `${this.zoom}`)
	}

	/** Remember which fraction of the day sits under `clientY`, so we can keep it there as zoom changes.
	 * Measures here — once per gesture — so re-pinning every animation frame reads no layout. */
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

	/** After the density changed, scroll so the anchored fraction sits back under its screen Y. */
	protected pin(_previous: number) {
		if (!this.anchor) {
			return
		}
		const contentY = this.timedTop + this.anchor.fraction * this.available * this.zoom
		this.host.scrollTop = contentY - (this.anchor.clientY - this.anchor.hostTop)
	}
}
