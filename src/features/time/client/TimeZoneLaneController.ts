import { Controller, type Component } from '@a11d/lit'
import { TimeZones } from './TimeZones.js'
import { haptic } from '../../../design/haptics.js'
import { startedInOverlay } from '../../../design/eventOrigin.js'

/** Absent until the user folds deliberately; until then the viewport decides. */
const STORAGE_KEY = 'Mitra.TimeZones.Folded'

/** Inline travel (px) before a press on the rail reads as a fold gesture rather than a tap or a scroll. */
const CLAIM_DISTANCE = 8

/** Haptic tick (ms) as the lane crosses the point where letting go would flip it. */
const TICK_MS = 8

/** Haptic pulse (ms) when the lane lands, the same scale as the grid's press-and-hold confirmation. */
const COMMIT_MS = 15

interface Drag {
	readonly pointerId: number
	readonly originX: number
	readonly originY: number
	/** The lane's per-column width (px) at pointer-down, what the travel is added to. */
	readonly startWidth: number
	/** +1 in LTR, −1 in RTL: pulling toward the inline-end always opens the lane. */
	readonly sign: number
	claimed: boolean
}

/**
 * Folds the time axis' other zone columns (the anchor never folds), by a rail drag that follows the pointer or by the
 * header's chevron. The width is one registered length, `--zone-width`, transitioned or driven per frame; until the
 * user folds deliberately, the container query in Days.ts decides through `--_auto-fold`.
 */
export class TimeZoneLaneController extends Controller {
	constructor(protected override readonly host: Component) {
		super(host)
	}

	private preference = TimeZoneLaneController.storedPreference
	/** The viewport's verdict, read from `--_auto-fold`. */
	private autoFolded = false
	/** The per-column width (px) under a live gesture; `undefined` whenever the cascade owns it again. */
	private position?: number
	private drag?: Drag
	private observer?: ResizeObserver
	private resolved = false

	private static get storedPreference(): boolean | undefined {
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			return stored === null ? undefined : stored === 'true'
		} catch {
			return undefined
		}
	}

	get folded() {
		return this.preference ?? this.autoFolded
	}

	private get zoneCount() {
		return TimeZones.besides.length
	}

	/** One column's open width, authored in CSS. */
	private get openWidth() {
		return parseFloat(getComputedStyle(this.host).getPropertyValue('--zone-lane-width')) || 0
	}

	/** Where letting go right now would land: past halfway the lane opens. */
	private get wouldFold() {
		return (this.position ?? (this.folded ? 0 : this.openWidth)) * 2 < this.openWidth
	}

	override hostConnected() {
		this.resolved = false
		this.reflect()
		this.host.addEventListener('pointerdown', this.onPointerDown)
		// Only tells when the container query's verdict may have changed (a rotation, a resize, the sidebar).
		this.observer = new ResizeObserver(() => this.resolveAuto())
		this.observer.observe(this.host)
	}

	override hostDisconnected() {
		this.host.removeEventListener('pointerdown', this.onPointerDown)
		this.observer?.disconnect()
		this.observer = undefined
		this.release()
	}

	/** The container query answers only after layout, and reading it here, before the observer's first delivery, keeps a
	 * narrow viewport from painting the lane open. Once only, as a per-render style read would flush layout every minute tick. */
	override hostUpdated() {
		if (this.resolved) {
			return
		}
		this.resolved = true
		// The first verdict must not animate, or the day columns would jump on every narrow load.
		this.host.toggleAttribute('data-zones-immediate', true)
		this.resolveAuto()
		this.host.getBoundingClientRect() // flush style before transitions come back
		this.host.removeAttribute('data-zones-immediate')
	}

	/** Remembered over whatever the viewport would choose. */
	setFolded(folded: boolean) {
		if (folded === this.folded) {
			return
		}
		this.commit(folded)
		haptic(COMMIT_MS)
	}

	private resolveAuto() {
		const folded = getComputedStyle(this.host).getPropertyValue('--_auto-fold').trim() === '1'
		if (folded === this.autoFolded) {
			return
		}
		this.autoFolded = folded
		if (this.preference === undefined) {
			this.reflect()
		}
	}

	private commit(folded: boolean) {
		this.preference = folded
		try {
			localStorage.setItem(STORAGE_KEY, String(folded))
		} catch {
			// Storage unavailable, so the fold just doesn't survive a reload.
		}
		this.reflect()
	}

	private reflect() {
		this.host.toggleAttribute('data-zones-folded', this.folded)
		this.host.requestUpdate()
	}

	/** Drive the lane to `width` px per column, ticking as it crosses the point of no return. */
	private moveTo(width: number) {
		if (width === this.position) {
			return
		}
		const before = this.wouldFold
		this.position = width
		this.host.style.setProperty('--zone-width', `${width}px`)
		if (this.wouldFold !== before) {
			haptic(TICK_MS)
		}
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		// A second pointer is most likely the density controller's pinch, which must not fold the lane mid-zoom.
		if (this.drag) {
			if (e.pointerId !== this.drag.pointerId) {
				this.release()
			}
			return
		}
		const target = e.target as Element | null
		if (e.button !== 0 || !this.zoneCount || !target?.closest('.timezone, .axis') || startedInOverlay(e)) {
			return
		}
		// Capturing the pointer would retarget a click on the header's own controls onto the grid and swallow it.
		if (target.closest('button, mitra-icon-button')) {
			return
		}
		this.drag = {
			pointerId: e.pointerId,
			originX: e.clientX,
			originY: e.clientY,
			startWidth: this.folded ? 0 : this.openWidth,
			sign: this.host.matches(':dir(rtl)') ? -1 : 1,
			claimed: false,
		}
		this.host.addEventListener('pointermove', this.onPointerMove)
		this.host.addEventListener('pointerup', this.onPointerUp)
		this.host.addEventListener('pointercancel', this.onPointerCancel)
	}

	private readonly onPointerMove = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		const travel = (e.clientX - drag.originX) * drag.sign
		if (!drag.claimed) {
			// Claim only a decidedly inline drag: the rail is also how a finger scrolls the day vertically
			// (its `touch-action: pan-y` leaves that to the browser), and a tap must stay a tap.
			if (Math.abs(travel) < CLAIM_DISTANCE || Math.abs(travel) <= Math.abs(e.clientY - drag.originY)) {
				return
			}
			drag.claimed = true
			this.host.setPointerCapture(drag.pointerId)
			this.host.toggleAttribute('data-zones-immediate', true)
		}
		// The LANE follows the pointer 1:1, so each of its columns takes an n-th of the travel.
		this.moveTo(Math.min(this.openWidth, Math.max(0, drag.startWidth + travel / this.zoneCount)))
	}

	private readonly onPointerUp = () => {
		if (!this.drag?.claimed) {
			this.release()
			return
		}
		const folded = this.wouldFold
		const changed = folded !== this.folded
		this.commit(folded)
		// Commit and teardown land in one style change, so the lane glides from where the pointer left it.
		this.release()
		haptic(changed ? COMMIT_MS : TICK_MS)
	}

	private readonly onPointerCancel = () => this.release()

	private release() {
		if (this.drag?.claimed && this.host.hasPointerCapture(this.drag.pointerId)) {
			this.host.releasePointerCapture(this.drag.pointerId)
		}
		this.host.removeEventListener('pointermove', this.onPointerMove)
		this.host.removeEventListener('pointerup', this.onPointerUp)
		this.host.removeEventListener('pointercancel', this.onPointerCancel)
		this.host.removeAttribute('data-zones-immediate')
		this.host.style.removeProperty('--zone-width')
		this.position = undefined
		this.drag = undefined
	}
}
