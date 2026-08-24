import { type Component } from '@a11d/lit'
import { DensityController } from './DensityController.js'

/**
 * Vertical density (zoom) of the months strip — the gesture mechanics live in {@link DensityController};
 * this owns what the zoom means there.
 *
 * The controller drives a single host inline property, `--months-zoom`: a pure multiplier over "twelve
 * months fill the viewport" (the host's CSS derives each row's height from it, so nothing else needs to
 * be kept in sync):
 *   zoom 1 → the whole year fits
 *   zoom 4 → a quarter fills the viewport (12 / 4)
 *
 * Pinning holds the content point under the pointer still: every row scales uniformly, so the scroll
 * offset below the sticky header simply scales by the same zoom ratio — pure arithmetic on values cached
 * at gesture start, no per-frame layout reads.
 */
export class MonthsDensityController extends DensityController {
	/** What to hold still while the density changes: the host-relative pointer Y, with the sticky
	 * header's height and the host's top cached along so re-pinning reads no layout. */
	private anchor?: { y: number, headerHeight: number, hostTop: number }

	constructor(host: Component) {
		// max 4 → three months fill the viewport (12 / 4): beyond that the strip stops reading as a
		// bird's-eye and the month view is the better tool.
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

	/** After the density changed, scroll so the anchored content point sits back under the pointer:
	 * the strip below the header scaled by `zoom / previous`, so its scroll offset does too. */
	protected pin(previous: number) {
		if (!this.anchor || this.zoom === previous) {
			return
		}
		const content = this.host.scrollTop + this.anchor.y - this.anchor.headerHeight
		this.host.scrollTop = content * (this.zoom / previous) + this.anchor.headerHeight - this.anchor.y
	}
}
