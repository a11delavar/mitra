import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Source } from '../../sources/Source.js'
import { EntryPlan } from '../../relations/EntryPlan.js'
import { EntryChange } from '../EntryChange.js'
import { Entry, SNAP_MINUTES, DEFAULT_REMINDER_MINUTES } from '../Entry.js'
import { getPrimarySource, getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import * as Hierarchy from '../../relations/client/Hierarchy.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import type { EntrySegmentComponent } from './EventSegment.js'
import { placeAllDay, placeTimed, resizePlacement, snapToGrid } from './entryPlacement.js'
import { haptic } from '../../../design/haptics.js'

/** Whether a gesture works in minutes (the week's timed grid) or whole days (the all-day lane / month). */
type Mode = 'timed' | 'allday'

/** What a gesture does: place a new entry, translate an existing one, or drag one of its edges. */
type Kind = 'create' | 'move' | 'resize'

/** Touch only: how long (ms) a finger must stay pressed — within {@link TOUCH_HOLD_TOLERANCE} — before a
 * grid gesture begins, so a plain swipe scrolls instead of creating. ~half a second matches the OS long-press. */
const TOUCH_HOLD_MS = 500

/** Movement (px) tolerated during the hold before the press is read as a scroll and the gesture is released. */
const TOUCH_HOLD_TOLERANCE = 10

/** Haptic pulse (ms) fired the instant the hold lands, where the Vibration API exists (absent on iOS Safari). */
const TOUCH_HOLD_FEEDBACK_MS = 15

/** A day cell snapshotted once per drag (it can't move while the pointer is captured): its box, for
 * hit-testing the pointer to a day, and its timed-grid (`.entries`) box, for mapping Y to a minute in the
 * week view. Snapshotting up front makes each move pure arithmetic — no `getBoundingClientRect` per frame. */
interface Cell {
	readonly date: DateTime
	readonly left: number
	readonly right: number
	readonly top: number
	readonly bottom: number
	readonly gridTop: number
	readonly gridHeight: number
}

interface DragPoint {
	readonly date: DateTime
	readonly minute: number
}

/** Everything about one in-progress gesture, or `undefined` when idle — so "are we dragging" is a single
 * check and tearing down is a single assignment. `point`/`moved`/`frame` mutate as the gesture runs. */
interface Drag {
	readonly kind: Kind
	readonly mode: Mode
	readonly anchor: DragPoint                  // the pointer-down point (create: first corner; move: grab point)
	readonly source?: Source                    // create only — the calendar a new entry lands in
	readonly entry?: Entry                       // move/resize only — the live working entry (resize mutates it per frame; move only at release)
	readonly before?: Entry                      // move/resize only — the span at pointer-down: the frames' fixed reference, and a cancelled resize's restore point
	readonly edge?: 'start' | 'end'              // resize only — which edge is being dragged
	readonly grabbedSegment?: EntrySegmentComponent // move only — opened on a plain tap (no drag)
	readonly pointerId: number
	/** Captures the pointer and carries the listeners — the grid, or the section a drag started in. */
	readonly surface: HTMLElement
	readonly origin: { x: number, y: number }
	readonly cells: ReadonlyArray<Cell>
	readonly laneBottom?: number                 // week only — the all-day strip's lower edge: a move above it previews all-day, below it timed
	/** The one drop target outside the grid; absent when the section isn't on screen. */
	readonly unscheduledBox?: DOMRect
	point: { x: number, y: number }
	moved: boolean
	armed: boolean                               // touch only — waiting for the press-and-hold; listening but not yet captured (see requiresHold)
	holdTimer?: ReturnType<typeof setTimeout>    // touch only — the pending long-press timer, live only while armed
	frame?: number
	gestureDraft?: Entry                         // create only — the one draft instance the gesture mutates per frame
	preview?: Entry                              // move only — the one dashed ghost instance the gesture mutates per frame
}

/**
 * The single drag gesture controller for a calendar grid, attached to the *container* (`Days`/`Weeks`),
 * never per-`Day`, so a gesture can span day cells. One controller serves three gestures that share all
 * the geometry (cell snapshot, hit-testing, minute mapping, rAF coalescing, pointer capture) and differ
 * only in what pointer-down starts, how a frame builds the entry, and what release does:
 *
 * - **create** — on empty grid / lane / cell: a new entry from anchor→current (week timed reads the
 *   1440-row grid snapped to {@link SNAP_MINUTES}; the all-day lane and month are day-granular). A plain
 *   click does nothing in the week, and quick-creates a single day in the month.
 * - **move** — on a persisted entry's body: translate it (preserving duration) by the drag delta. Timed
 *   in the week shifts by minutes+days; everything else (all-day, or anything in the month) by whole days,
 *   so a timed entry moved in the month keeps its clock time. In the week, the move may also cross between
 *   the timed grid and the all-day lane — the entry converts (via {@link Entry.setAllDay}) to whichever
 *   zone the pointer is in. A plain tap opens the editor.
 *
 * - **resize** — on a persisted entry's `.resize-start`/`.resize-end` handle: drag that edge while the
 *   other stays fixed (reusing {@link resizePlacement}, so dragging an edge past the other flips it).
 *
 * A move reaches ONE surface outside the grid, the **unscheduled section**, in both directions — and
 * as the same gesture rather than a mode of its own, because "unscheduled" is simply the placement
 * that has no span. A drag out of the section starts where the section is, so it hands the gesture
 * over through {@link beginExternal} and lends its own pointer capture; everything downstream is the
 * move path untouched. An EVENT is never offered it (see {@link Entry.unschedulable}).
 *
 * A create's in-progress entry is pushed to the {@link EntryStore} as the draft. A *move* never touches
 * the entry until release: the original stays dimmed in place (the drag *source*) while a dashed, id-less
 * ghost — the store's *preview*, sharing the draft's not-yet-persisted look because that's literally what
 * it is — tracks the pointer. A *resize* stretches the entry itself live. Create opens the draft's editor
 * on release; move/resize commit through the store, which reverts to the canonical server state on failure.
 */
export class EntryDragController extends Controller {
	/** The granularity timed gestures snap to. */
	static readonly snapMinutes = SNAP_MINUTES

	/** One view is mounted at a time, and during a view transition's frames the LAST connected is the
	 * incoming one. */
	private static readonly grids = new Set<EntryDragController>()

	/**
	 * Take over a move whose pointer-down landed outside the grid. `surface` captures the pointer,
	 * which also keeps the trailing click off the row's own segment (a captured pointer retargets it)
	 * — so a real drag can't open the editor of the task it just scheduled, while a plain tap still
	 * does through the ordinary tap-to-open release path.
	 */
	static beginExternal(entry: Entry, segment: EntrySegmentComponent, surface: HTMLElement, e: PointerEvent) {
		const controller = [...this.grids].filter(controller => controller.element.isConnected).at(-1)
		controller?.beginExternal(entry, segment, surface, e)
	}

	/** Found by TAG, not through a layout the calendar knows about: where planning surfaces live is the
	 * shell's business, and this only needs the box. */
	private static unscheduledBox() {
		const section = document.querySelector('mitra-unscheduled')
		const box = section && EntryDragController.visibleBox(section)
		return box && box.width > 0 && box.height > 0 ? box : undefined
	}

	/** The box intersected with every clipping ancestor's. Without this, a panel scrolled out of the
	 * sidebar's tab carousel reports a rectangle sitting over the calendar — and half the grid would
	 * silently become an unschedule drop zone. */
	private static visibleBox(element: Element) {
		let box = element.getBoundingClientRect()
		// Composed, not light-tree: `parentElement` stops at a shadow boundary, and a host may be the
		// thing doing the clipping (mitra-tabs' carousel is inside its shadow root).
		const up = (node: Element): Element | undefined => node.parentElement ?? (node.getRootNode() as ShadowRoot).host
		for (let ancestor = up(element); ancestor && box.width > 0 && box.height > 0; ancestor = up(ancestor)) {
			const style = getComputedStyle(ancestor)
			if (style.overflowX === 'visible' && style.overflowY === 'visible') {
				continue
			}
			const clip = ancestor.getBoundingClientRect()
			const left = Math.max(box.left, clip.left)
			const top = Math.max(box.top, clip.top)
			box = new DOMRect(left, top, Math.min(box.right, clip.right) - left, Math.min(box.bottom, clip.bottom) - top)
		}
		return box
	}

	private readonly element: Component
	private drag?: Drag

	constructor(host: Component, private readonly grid: 'week' | 'month' | 'year' = 'week') {
		super(host)
		this.element = host
	}

	override hostConnected() {
		EntryDragController.grids.add(this)
		this.element.addEventListener('pointerdown', this.onPointerDown)
	}

	override hostDisconnected() {
		EntryDragController.grids.delete(this)
		this.element.removeEventListener('pointerdown', this.onPointerDown)
	}

	private beginExternal(entry: Entry, segment: EntrySegmentComponent, surface: HTMLElement, e: PointerEvent) {
		if (this.drag || !entry.persisted || !getCapabilities(entry.sourceId).editEntries) {
			return
		}
		const cells = this.snapshotCells()
		if (!cells.length) {
			return // nothing on screen to place it on
		}
		const mode = this.editMode(entry)
		const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.begin({
			...this.commonAt(e, cells, surface),
			kind: 'move', mode, anchor, entry, before: entry.clone(), grabbedSegment: segment,
		})
	}

	/** Snapshotted at pointer-down, so every frame stays free of DOM reads: the two boxes outside the
	 * day cells a frame may land in, plus what the drag captures and listens on. */
	private commonAt(e: PointerEvent, cells: ReadonlyArray<Cell>, surface: HTMLElement) {
		return {
			pointerId: e.pointerId,
			surface,
			origin: { x: e.clientX, y: e.clientY },
			point: { x: e.clientX, y: e.clientY },
			cells,
			laneBottom: this.element.querySelector('.all-day')?.getBoundingClientRect().bottom,
			unscheduledBox: EntryDragController.unscheduledBox(),
			moved: false,
			armed: this.requiresHold(e.pointerType),
		}
	}

	/** Whether a pointer of this type must press-and-hold before a grid drag begins. Touch and pen do: a
	 * finger can't hover and a swipe is how you scroll, so an immediate drag can't tell "scroll the grid"
	 * from "create/move an entry" — the hold makes the intent explicit while a plain swipe keeps scrolling.
	 * Mouse points precisely and doesn't scroll by dragging on the grid, so it starts immediately.
	 * NOTE (pen): the hold arms the same as touch, but the native-pan veto in {@link onTouchMove} is
	 * touch-event-only — pen emits none — so if a pen can pan the grid (Windows Ink), a committed pen drag
	 * can still be seized by a native pan and `pointercancel`led. Testing whether that actually bites. */
	private requiresHold(pointerType: string): boolean {
		return pointerType === 'touch' || pointerType === 'pen'
	}

	/** The create mode a pointerdown starts on empty space, or `undefined` if it shouldn't start one. Month
	 * and year are all-day only: any day cell is a create surface there, while the week splits into the
	 * all-day lane and the timed grid. */
	private createModeAt(target: HTMLElement): Mode | undefined {
		if (this.grid !== 'week') {
			return target.closest('mitra-day') ? 'allday' : undefined
		}
		return target.closest('.all-day') ? 'allday' : target.closest('.entries') ? 'timed' : undefined
	}

	/** The zone a move/resize *starts* in: minutes only for a timed entry in the week; the all-day lane
	 * and the whole month/year are day-granular (a timed entry moved there therefore shifts by days and
	 * keeps its time). A week *move* may leave this zone per frame — see {@link buildAt}. */
	private editMode(entry: Entry): Mode {
		return this.grid !== 'week' || entry.allDay ? 'allday' : 'timed'
	}

	/** Snapshot every day cell's box (and its timed-grid box) once, so moves need no DOM reads. Every view
	 * renders its cells as `mitra-day` (each carrying the `data-date` read below). */
	private snapshotCells(): Array<Cell> {
		return [...this.element.querySelectorAll<HTMLElement>('mitra-day')].map(element => {
			const rect = element.getBoundingClientRect()
			const grid = element.querySelector<HTMLElement>('.entries')?.getBoundingClientRect() ?? rect
			return { date: new DateTime(element.dataset.date!), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, gridTop: grid.top, gridHeight: grid.height }
		})
	}

	/** The day cell at a pointer position. In the week (a single row) this is a horizontal lookup clamped
	 * to the first/last column (correct in both LTR and RTL); in the month/year (2-D grids) it's the cell
	 * containing the point, else the nearest by edge distance so a stray drag still resolves to a day. */
	private cellAt(cells: ReadonlyArray<Cell>, x: number, y: number): Cell | undefined {
		if (!cells.length) {
			return undefined
		}
		if (this.grid === 'week') {
			return cells.find(cell => x >= cell.left && x <= cell.right)
				?? (x < cells[0]!.left ? cells[0]! : cells[cells.length - 1]!)
		}
		const inside = cells.find(cell => x >= cell.left && x <= cell.right && y >= cell.top && y <= cell.bottom)
		if (inside) {
			return inside
		}
		let nearest = cells[0]!
		let nearestDistance = Infinity
		for (const cell of cells) {
			const dx = x < cell.left ? cell.left - x : x > cell.right ? x - cell.right : 0
			const dy = y < cell.top ? cell.top - y : y > cell.bottom ? y - cell.bottom : 0
			const distance = dx * dx + dy * dy
			if (distance < nearestDistance) {
				nearestDistance = distance
				nearest = cell
			}
		}
		return nearest
	}

	/** The snapped minute-of-day at a vertical position, off the cell's cached timed-grid box. */
	private minuteIn(cell: Cell, y: number): number {
		const raw = (y - cell.gridTop) / (cell.gridHeight / 1440)
		const snapped = Math.round(raw / EntryDragController.snapMinutes) * EntryDragController.snapMinutes
		return Math.max(0, Math.min(1440, snapped))
	}

	/** Resolve a pointer position to a day (and, for a timed gesture, a minute) against the cached geometry. */
	private pointAt(cells: ReadonlyArray<Cell>, x: number, y: number, mode: Mode): DragPoint | undefined {
		const cell = this.cellAt(cells, x, y)
		return cell ? { date: cell.date, minute: mode === 'timed' ? this.minuteIn(cell, y) : 0 } : undefined
	}

	private buildCreate(anchor: DragPoint, current: DragPoint): Entry {
		const drag = this.drag!
		// No id: it's a draft until the backend assigns one on create (see Entry.persisted / EntryStore).
		// A drag makes an EVENT wherever the target can hold one — mitra is calendar-first, and a
		// collection that also accepts tasks is still a calendar; only a tasks-only source (a Notion view)
		// makes a task. The editor's type switch is how a draft becomes the other one (see Source.defaultEntryType).
		const base = { sourceId: drag.source!.id, type: drag.source!.defaultEntryType, heading: '' }
		if (drag.mode === 'allday') {
			const { start, end } = placeAllDay(anchor.date, current.date)
			return new Entry({ ...base, start, end, allDay: true })
		}
		const { start, end } = placeTimed(anchor.date.dayStart.add({ minutes: anchor.minute }), current.date.dayStart.add({ minutes: current.minute }))
		// A timed draft gets the default reminder — unless the target provider can't hold reminders
		// at all (e.g. Notion), where seeding one would just be silently dropped on save. The gesture
		// only ever adopts its span afterwards (see `apply`), so this seed survives to the editor.
		const reminders = getCapabilities(drag.source!.id).reminders ? [DEFAULT_REMINDER_MINUTES] : undefined
		return new Entry({ ...base, start, end, allDay: false, reminders })
	}

	/** Translate the dragged entry by the gesture delta, preserving its duration — or, when a week move
	 * crosses between the timed grid and the all-day lane, convert it through the same domain flip the
	 * editor's all-day switch uses ({@link Entry.setAllDay}), placed at the pointer. Every frame is
	 * computed from `before` (the span at pointer-down), so frames are stateless: crossing over and
	 * back restores the original span exactly. */
	private buildMove(current: DragPoint, mode: Mode): Entry | undefined {
		const drag = this.drag!
		const before = drag.before!
		// No span to translate: placing it IS giving it one, so the length comes from the domain default.
		if (!before.start || !before.end) {
			const placed = before.clone()
			placed.scheduleAt(mode === 'allday' ? current.date : current.date.dayStart.add({ minutes: current.minute }), mode === 'allday')
			return placed
		}
		if (drag.laneBottom !== undefined && (mode === 'allday') !== before.allDay) {
			const converted = before.clone()
			converted.setAllDay(mode === 'allday')
			converted.moveStart(mode === 'allday' ? current.date.dayStart : current.date.dayStart.add({ minutes: current.minute }))
			return converted
		}
		if (drag.mode === 'allday') {
			const days = Math.round((current.date.dayStart.valueOf() - drag.anchor.date.dayStart.valueOf()) / 86_400_000)
			return new Entry({ ...before, start: before.start.add({ days }), end: before.end.add({ days }) })
		}
		const grabMs = drag.anchor.date.dayStart.add({ minutes: drag.anchor.minute }).valueOf()
		const currentMs = current.date.dayStart.add({ minutes: current.minute }).valueOf()
		// Snap the moved start onto the grid (the user's choice), then shift both ends by that to keep duration.
		const shift = snapToGrid(before.start.valueOf() + (currentMs - grabMs)) - before.start.valueOf()
		return new Entry({ ...before, start: before.start.add({ milliseconds: shift }), end: before.end.add({ milliseconds: shift }) })
	}

	private overUnscheduled(point: { x: number, y: number }) {
		const box = this.drag!.unscheduledBox
		return !!box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
	}

	/** Drag one edge of the entry to the current point, keeping the other fixed (and flipping past it). */
	private buildResize(current: DragPoint): Entry | undefined {
		const drag = this.drag!
		const before = drag.before!
		if (!before.start || !before.end) {
			return undefined
		}
		const dragged = before.allDay ? current.date : current.date.dayStart.add({ minutes: current.minute })
		const { start, end } = resizePlacement(before, drag.edge!, dragged)
		return new Entry({ ...before, start, end })
	}

	/** The entry a frame should render for the current gesture, resolved against the cached geometry.
	 * A move's zone follows the pointer between the week's all-day lane and its timed grid (converting
	 * the entry accordingly); create and resize stay in the zone they started in. */
	private buildAt(point: { x: number, y: number }): Entry | undefined {
		const drag = this.drag!
		// Asked BEFORE any cell lookup: `cellAt` resolves every position to some nearest day, so a
		// pointer parked over the section would otherwise read as a day underneath it.
		if (drag.kind === 'move' && this.overUnscheduled(point)) {
			if (!drag.entry!.unschedulable) {
				return undefined
			}
			const cleared = drag.before!.clone()
			cleared.unschedule()
			return cleared
		}
		const mode: Mode = drag.kind === 'move' && drag.laneBottom !== undefined
			? (point.y <= drag.laneBottom ? 'allday' : 'timed')
			: drag.mode
		const current = this.pointAt(drag.cells, point.x, point.y, mode)
		if (!current) {
			return undefined
		}
		switch (drag.kind) {
			case 'create': return this.buildCreate(drag.anchor, current)
			case 'move': return this.buildMove(current, mode)
			case 'resize': return this.buildResize(current)
		}
	}

	/** Start (or, on touch, arm) a gesture. Mouse and pen capture the pointer immediately — there's no
	 * scroll to disambiguate. Touch instead *arms*: it listens but doesn't capture, waiting for a
	 * press-and-hold (see {@link activate}) so a plain swipe still scrolls the grid. Either way the
	 * move/up/cancel handlers bind now; capture and any draft wait until the gesture actually commits. */
	private begin(drag: Drag) {
		this.drag = drag
		drag.surface.addEventListener('pointermove', this.onPointerMove)
		drag.surface.addEventListener('pointerup', this.onPointerUp)
		drag.surface.addEventListener('pointercancel', this.onPointerCancel)
		// Non-passive so it can veto the surface's own panning while a touch drag runs (see onTouchMove).
		drag.surface.addEventListener('touchmove', this.onTouchMove, { passive: false })
		if (drag.armed) {
			drag.holdTimer = setTimeout(() => this.activate(true), TOUCH_HOLD_MS)
		} else {
			this.activate(false)
		}
	}

	/** Commit an armed/starting gesture to the pointer: capture it, so from here the drag owns every move
	 * and the browser stops scrolling. `fromHold` is the touch path — the press-and-hold just landed, so
	 * confirm it at once with a haptic pulse (where supported) and immediate feedback: a create drops its
	 * draft at the press point, a move/resize lifts the entry. Mouse/pen (`fromHold` false) capture silently
	 * and let the dead-zone in {@link processFrame} decide when the drag has really started. */
	private activate(fromHold: boolean) {
		const drag = this.drag!
		drag.armed = false
		if (drag.holdTimer !== undefined) {
			clearTimeout(drag.holdTimer)
			drag.holdTimer = undefined
		}
		drag.surface.setPointerCapture(drag.pointerId)
		if (!fromHold) {
			return
		}
		// The draft appearing is the feedback that always works — see haptics.ts for why the buzz can't be.
		haptic(TOUCH_HOLD_FEEDBACK_MS)
		if (drag.kind === 'create') {
			drag.moved = true // the hold *is* the create intent — a release without dragging still makes an entry
			const built = this.buildAt(drag.point)
			if (built) {
				this.apply(built)
			}
		} else {
			EntryStore.setDragging(drag.entry) // float it above its cluster; a real drag still governs the commit
		}
	}

	/** Release an armed touch gesture whose hold never landed — the finger scrolled away or lifted first.
	 * Nothing was captured, drafted, or committed while armed, so this is a bare teardown. */
	private abort() {
		if (this.drag) {
			this.teardown(this.drag.pointerId)
		}
	}

	/** End the gesture: release capture (if still held), unbind, cancel any pending frame, go idle. */
	private teardown(pointerId: number) {
		const surface = this.drag?.surface ?? this.element
		if (surface.hasPointerCapture(pointerId)) {
			surface.releasePointerCapture(pointerId)
		}
		surface.removeEventListener('pointermove', this.onPointerMove)
		surface.removeEventListener('pointerup', this.onPointerUp)
		surface.removeEventListener('pointercancel', this.onPointerCancel)
		surface.removeEventListener('touchmove', this.onTouchMove)
		if (this.drag?.holdTimer !== undefined) {
			clearTimeout(this.drag.holdTimer)
		}
		if (this.drag?.frame !== undefined) {
			cancelAnimationFrame(this.drag.frame)
		}
		this.drag = undefined
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) {
			return
		}
		// A second pointer while a gesture is in flight means multi-touch (a pinch-zoom) — abandon the
		// single-pointer drag so it neither fights the zoom nor leaves a stray draft behind.
		if (this.drag && e.pointerId !== this.drag.pointerId) {
			this.onPointerCancel(new PointerEvent('pointercancel', { pointerId: this.drag.pointerId }))
			return
		}
		const target = e.target as HTMLElement
		if (target.closest('mitra-entry-details') || target.closest('mitra-task-status')) {
			// Interactions inside the editor popover, or on a task's status checkbox/menu, are never grid
			// gestures — otherwise a tap on the checkbox would also register as a tap-to-open on the segment.
			return
		}
		const cells = this.snapshotCells()
		// Snapshotted up front, like the cells, so every frame stays free of DOM reads — see commonAt.
		const common = this.commonAt(e, cells, this.element)

		// Move / resize an existing entry — persisted ones only (a draft is owned by the create flow + editor).
		// A series occurrence drags like any entry: the drop's commit resolves the edit's scope.
		const segment = target.closest('mitra-entry-segment') as EntrySegmentComponent | null
		const entry = segment?.segment?.entry
		if (segment) {
			// A tap still has to open the editor of an entry whose provider mitra may only read, so the
			// bar is on beginning a drag, not on handling the pointer at all.
			if (!entry?.persisted || !getCapabilities(entry.sourceId).editEntries) {
				return
			}
			const mode = this.editMode(entry)
			const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
			if (!anchor) {
				return
			}
			const edge = target.closest('.resize-start') ? 'start' : target.closest('.resize-end') ? 'end' : undefined
			const kind: Kind = edge ? 'resize' : 'move'
			this.begin({ ...common, kind, mode, anchor, entry, before: entry.clone(), edge, grabbedSegment: kind === 'move' ? segment : undefined })
			return
		}

		// Create on empty grid / lane / cell.
		const mode = this.createModeAt(target)
		const source = mode ? getPrimarySource() : undefined
		if (!mode || !source || !getCapabilities(source.id).createEntries) {
			return
		}
		const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.begin({ ...common, kind: 'create', mode, anchor, source })
	}

	// Coalesce: record the latest position and process at most once per frame (pointermove fires far more
	// often than the screen refreshes, and each update is a full re-render).
	private readonly onPointerMove = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		if (drag.armed) {
			// Still waiting for the hold: a finger that travels past the tolerance is scrolling, not pressing,
			// so release the gesture and let the browser pan (we never captured or preventDefaulted).
			if (Math.hypot(e.clientX - drag.origin.x, e.clientY - drag.origin.y) > TOUCH_HOLD_TOLERANCE) {
				this.abort()
			}
			return
		}
		drag.point = { x: e.clientX, y: e.clientY }
		drag.frame ??= requestAnimationFrame(this.processFrame)
	}

	/** Touch only: once a gesture has committed — its press-and-hold landed and it captured the pointer —
	 * stop the grid (whose `touch-action: pan-x pan-y` lets a single finger pan it) from scrolling out from
	 * under the drag. Pointer capture alone does NOT: a captured touch still drives the container's native
	 * pan, which seizes the touch mid-drag and fires `pointercancel`, silently dropping the create/move.
	 * Vetoing the default here (the listener is non-passive) keeps the finger on the gesture instead. While
	 * still `armed` we let it through, so a plain swipe before the hold keeps scrolling; mouse/pen never
	 * emit touch events, so this is a no-op for them. */
	private readonly onTouchMove = (e: TouchEvent) => {
		if (this.drag && !this.drag.armed) {
			e.preventDefault()
		}
	}

	private readonly processFrame = () => {
		const drag = this.drag
		if (!drag) {
			return
		}
		drag.frame = undefined
		if (!drag.moved) {
			if (Math.hypot(drag.point.x - drag.origin.x, drag.point.y - drag.origin.y) <= 4) {
				return // ignore an incidental click; only a real drag updates the draft
			}
			drag.moved = true
			if (drag.kind !== 'create') {
				EntryStore.setDragging(drag.entry) // float the entry above its cluster while it's dragged
			}
		}
		const built = this.buildAt(drag.point)
		if (built) {
			this.apply(built)
		}
	}

	/** Render a frame's result. Create and move both drive a single gesture-local, id-less instance (the
	 * draft / the ghost) so keyed renders reuse its DOM across frames; only a resize manipulates the real
	 * entry live — a move leaves the original untouched (dimmed in place) until release. */
	private apply(built: Entry) {
		const drag = this.drag!
		switch (drag.kind) {
			case 'create': {
				const draft = drag.gestureDraft ??= built
				draft.adoptSpan(built)
				EntryStore.upsertDraft(draft)
				break
			}
			case 'move': {
				const preview = drag.preview ??= new Entry({ ...built, id: undefined })
				preview.adoptSpan(built) // including all-day-ness — the zone the pointer is in decides it
				EntryStore.setPreview(preview)
				break
			}
			case 'resize': {
				drag.entry!.adoptSpan(built)
				EntryStore.notify()
				break
			}
		}
	}

	private readonly onPointerUp = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}

		if (drag.armed) {
			// Lifted before the hold landed — never a drag, so this is a plain tap. Drop the pending hold and
			// fall through to the unmoved-release logic below, which yields each kind's tap outcome: a move
			// opens its segment's editor; a create makes nothing (creation needs a drag — see below).
			drag.armed = false
			if (drag.holdTimer !== undefined) {
				clearTimeout(drag.holdTimer)
				drag.holdTimer = undefined
			}
		}

		if (drag.kind === 'create') {
			// Creating an entry always takes a drag, in every view — a plain click/tap on empty space makes
			// nothing (it would otherwise spawn stray entries just from clicking around, most visibly in the
			// month/year where a whole day cell is easy to hit). A touch hold counts as that drag: it forces
			// `moved` when it lands (see activate), so press-and-hold still creates. The last coalesced frame
			// may not have run, so resolve the release position here (before teardown).
			const built = drag.moved ? this.buildAt(drag.point) : undefined
			this.teardown(e.pointerId)
			if (built) {
				const draft = drag.gestureDraft ?? built
				draft.adoptSpan(built)
				EntryStore.upsertDraft(draft)
				EntryEditorIntent.openDraft(draft)
			} else {
				EntryStore.discardDraft()
			}
			return
		}

		// Move / resize: commit a real drag; a plain tap on a body opens the editor (handles never open).
		if (drag.moved) {
			const built = this.buildAt(drag.point)
			const entry = drag.entry!
			// Alt (⌥ on a Mac) held at the drop turns a move into a DUPLICATE — Explorer's copy-drag: the
			// original stays untouched and a standalone copy of it lands at the drop span. Standalone even
			// for a series occurrence: the copy is a single entry based on that very occurrence, so no
			// scope arises and Ctrl has nothing to add.
			if (drag.kind === 'move' && e.altKey && getCapabilities(entry.sourceId).createEntries) {
				this.teardown(e.pointerId)
				EntryStore.setPreview(undefined) // the ghost has served its purpose — the copy takes over
				EntryStore.setDragging(undefined)
				if (built) {
					// On failure the store already dropped the copy — the grid is back as it was; see duplicate.
					EntryStore.duplicate(entry, built).catch(() => void 0)
				}
				return
			}
			// Ctrl/⌘ held at release bypasses the scope dialog for single-entry move.
			const bypass = e.ctrlKey || e.metaKey
			const delta = built?.start && entry.start ? built.start.valueOf() - entry.start.valueOf() : 0
			const isMove = drag.kind === 'move'
			this.teardown(e.pointerId)
			EntryStore.setPreview(undefined) // a move's ghost has served its purpose — the entry takes over
			EntryStore.setDragging(undefined)
			if (built) {
				entry.adoptSpan(built)
				EntryStore.notify()
			}
			// Track initial span to derive translation delta for dependency shift strategies.
			const change = EntryChange.of(entry, drag.before)
			void Hierarchy.resolveScope(entry, isMove ? 'move' : 'edit', bypass, isMove && delta !== 0, change).then(scope => {
				if (!scope) {
					return EntryStore.revert(entry)
				}
				return EntryStore.commit(entry, scope.recurrence)
					.then(() => scope.subtasks && delta !== 0 ? Hierarchy.shiftSubtree(entry, delta) : EntryPlan.empty)
					.then(subtree => scope.shift ? Hierarchy.shiftDependents(change, scope.shift, subtree) : undefined)
					.catch(() => EntryStore.revert(entry))
			})
		} else {
			const segment = drag.kind === 'move' ? drag.grabbedSegment : undefined
			this.teardown(e.pointerId)
			EntryStore.setDragging(undefined)
			if (segment) {
				segment.open = true
			}
		}
	}

	/** A browser-interrupted gesture (touch hand-off, OS/context-menu gesture): tear down and undo what
	 * the gesture did — a create's draft and a move's ghost are simply dropped (a moved entry was never
	 * touched); only a live resize has to restore the pointer-down span. */
	private readonly onPointerCancel = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		if (drag.armed) {
			this.teardown(e.pointerId) // scroll / touch hand-off before the hold: nothing was drafted to undo
			return
		}
		this.teardown(e.pointerId)
		switch (drag.kind) {
			case 'create':
				EntryStore.discardDraft()
				break
			case 'move':
				EntryStore.setPreview(undefined)
				EntryStore.setDragging(undefined)
				break
			case 'resize':
				EntryStore.setDragging(undefined)
				drag.entry!.adoptSpan(drag.before!)
				EntryStore.notify()
				break
		}
	}
}
