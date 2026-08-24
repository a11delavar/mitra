import { Controller, type Component } from '@a11d/lit'
import { getTimeZones } from '../../../infrastructure/http/Api.js'
import { haptic } from '../../../design/haptics.js'

/** A deliberate fold, remembered per browser (like the view's zoom). Absent = the viewport still decides. */
const STORAGE_KEY = 'Mitra.TimeZones.Folded'

/** Inline travel (px) before a press on the rail reads as a fold gesture rather than a tap or a scroll. */
const CLAIM_DISTANCE = 8

/** Haptic tick (ms) as the lane crosses the point where letting go would flip it. */
const TICK_MS = 8

/** Haptic pulse (ms) when the lane lands — the same scale as the grid's press-and-hold confirmation. */
const COMMIT_MS = 15

/** One in-flight rail drag, or `undefined` when idle. */
interface Drag {
	readonly pointerId: number
	readonly originX: number
	readonly originY: number
	/** The lane's per-column width (px) at pointer-down — what the travel is added to. */
	readonly startWidth: number
	/** +1 in LTR, −1 in RTL: pulling toward the inline-end always opens the lane. */
	readonly sign: number
	claimed: boolean
}

/**
 * The time axis' ALTERNATIVE zone columns, and whether they're out or tucked away.
 *
 * The axis is expensive on a phone: every additional zone is another column of sticky rail the day
 * columns never get back. So the lane folds — the anchor zone, the one the grid is built on, always
 * stays — and the alternatives come out on demand, two ways that mean the same thing:
 *
 *   - drag the rail toward the inline-end (finger, pen or mouse) and the columns follow the pointer 1:1,
 *     with a haptic tick the moment releasing would open them and a fuller one when they land;
 *   - or click the chevron in the header's leading track.
 *
 * The width is a CSS custom property (`--zone-width`) the grid tracks are sized from, so opening is a
 * transition on ONE registered length and dragging is that same length driven per frame — no track list
 * is ever rebuilt in JS. What this owns is the STATE: a deliberate fold is remembered per browser, and
 * until there is one the viewport decides. That default stays a styling decision — the container query
 * in Days.ts writes its verdict into `--_auto-fold` and this reads it back, so the breakpoint lives in
 * the stylesheet with every other one.
 */
export class TimeZoneLaneController extends Controller {
	constructor(protected override readonly host: Component) {
		super(host)
	}

	/** The user's own answer, or `undefined` while they haven't given one. */
	private preference = TimeZoneLaneController.storedPreference
	/** What the viewport wants in that case (see `--_auto-fold`). */
	private autoFolded = false
	/** The per-column width (px) under a live gesture; `undefined` whenever the cascade owns it again. */
	private position?: number
	private drag?: Drag
	private observer?: ResizeObserver
	/** Whether the container query has been consulted since connecting — see {@link hostUpdated}. */
	private resolved = false

	private static get storedPreference(): boolean | undefined {
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			return stored === null ? undefined : stored === 'true'
		} catch {
			return undefined // storage unavailable — every session starts on the viewport's default
		}
	}

	/** Whether the alternative zones are currently tucked away. */
	get folded() {
		return this.preference ?? this.autoFolded
	}

	/** Nothing to fold without alternative zones — the anchor column alone is not a lane. */
	private get zoneCount() {
		return getTimeZones().length
	}

	/** One alternative column's open width, authored in CSS so the number stays a styling decision. */
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
		// The container query owns the default; the observer is only how we learn its verdict changed
		// (a rotated phone, a resized window, the sidebar opening).
		this.observer = new ResizeObserver(() => this.resolveAuto())
		this.observer.observe(this.host)
	}

	override hostDisconnected() {
		this.host.removeEventListener('pointerdown', this.onPointerDown)
		this.observer?.disconnect()
		this.observer = undefined
		this.release()
	}

	/** The container query can only answer once the strip has been laid out, which is a layout later than
	 * connecting — reading it here (rather than waiting for the observer's first delivery) is what keeps a
	 * narrow viewport from painting the lane open at all. Once only: every later change of verdict arrives
	 * through the observer, and a per-render style read would flush layout on every minute tick. */
	override hostUpdated() {
		if (this.resolved) {
			return
		}
		this.resolved = true
		// This first verdict is not a state CHANGE the user made, so it must not animate — the day columns
		// would jump on every load of a narrow viewport. Adopting it behind the no-transition attribute and
		// flushing style before lifting that attribute is what makes the lane start out where it belongs.
		this.host.toggleAttribute('data-zones-immediate', true)
		this.resolveAuto()
		this.host.getBoundingClientRect() // flush the adoption through style while it still can't animate
		this.host.removeAttribute('data-zones-immediate')
	}

	/** Fold or unfold deliberately — the header's chevron, and the reveal a newly added zone asks for.
	 * From here on this is the remembered preference, whatever the viewport would have chosen. */
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
			// Storage unavailable — the fold just doesn't survive a reload.
		}
		this.reflect()
	}

	/** Publish the settled state: the attribute the grid tracks key off, and a render so the header's
	 * chevron turns and relabels itself. */
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
		// A second pointer means multi-touch — the density controller's pinch, most likely. Abandon the
		// single-pointer drag rather than let one finger's sideways component fold the lane mid-zoom.
		if (this.drag) {
			if (e.pointerId !== this.drag.pointerId) {
				this.release()
			}
			return
		}
		const target = e.target as Element | null
		if (e.button !== 0 || !this.zoneCount || !target?.closest('.timezone, .axis')) {
			return
		}
		// A press on the header's own controls (the chevron, the "+", a zone's menu button) is a click,
		// not a drag — capturing the pointer would retarget the click onto the grid and swallow it.
		if (target.closest('button, mitra-icon-button')) {
			return
		}
		this.drag = {
			pointerId: e.pointerId,
			originX: e.clientX,
			originY: e.clientY,
			startWidth: this.folded ? 0 : this.openWidth,
			sign: getComputedStyle(this.host).direction === 'rtl' ? -1 : 1,
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
			this.release() // a tap, or a scroll that never turned inline — nothing to settle
			return
		}
		const folded = this.wouldFold
		const changed = folded !== this.folded
		this.commit(folded)
		// The commit and the teardown land in ONE style change: the transition comes back on, the inline
		// width goes away, and the lane glides from wherever the pointer left it to what it committed to.
		this.release()
		// A fuller pulse for a flip, the same light tick as the crossing for a lane that springs back.
		haptic(changed ? COMMIT_MS : TICK_MS)
	}

	private readonly onPointerCancel = () => this.release()

	/** Hand back the pointer, the listeners and the lane's width — the shared teardown of both endings. */
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
