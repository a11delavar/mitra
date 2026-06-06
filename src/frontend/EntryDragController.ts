import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, SourceType, type Source } from 'shared'
import { getDefaultSourceId, getIntegrations, updateEvent } from './Api.js'
import { DraftController } from './DraftController.js'
import type { EntrySegmentComponent } from './EventSegment.js'
import { SNAP_MINUTES, placeAllDay, placeTimed, resizePlacement, snapToGrid } from './entryPlacement.js'

/** Whether a gesture works in minutes (the week's timed grid) or whole days (the all-day lane / month). */
type Mode = 'timed' | 'allday'

/** What a gesture does: place a new entry, translate an existing one, or drag one of its edges. */
type Kind = 'create' | 'move' | 'resize'

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
	readonly entry?: Entry                       // move/resize only — the original persisted entry
	readonly edge?: 'start' | 'end'              // resize only — which edge is being dragged
	readonly grabbedSegment?: EntrySegmentComponent // move only — opened on a plain tap (no drag)
	readonly pointerId: number
	readonly origin: { x: number, y: number }
	readonly cells: ReadonlyArray<Cell>
	point: { x: number, y: number }
	moved: boolean
	frame?: number
}

/**
 * The single drag gesture controller for a calendar grid, attached to the *container* (`Days`/`Month`),
 * never per-`Day`, so a gesture can span day cells. One controller serves three gestures that share all
 * the geometry (cell snapshot, hit-testing, minute mapping, rAF coalescing, pointer capture) and differ
 * only in what pointer-down starts, how a frame builds the entry, and what release does:
 *
 * - **create** — on empty grid / lane / cell: a new entry from anchor→current (week timed reads the
 *   1440-row grid snapped to {@link SNAP_MINUTES}; the all-day lane and month are day-granular). A plain
 *   click does nothing in the week, and quick-creates a single day in the month.
 * - **move** — on a persisted entry's body: translate it (preserving duration) by the drag delta. Timed
 *   in the week shifts by minutes+days; everything else (all-day, or anything in the month) by whole days,
 *   so a timed entry moved in the month keeps its clock time. A plain tap opens the editor.
 * - **resize** — on a persisted entry's `.resize-start`/`.resize-end` handle: drag that edge while the
 *   other stays fixed (reusing {@link resizePlacement}, so dragging an edge past the other flips it).
 *
 * The in-progress entry is pushed to {@link DraftController} so it renders through the normal segment
 * pipeline; create opens the draft's editor on release, move/resize persist via `updateEvent`.
 */
export class EntryDragController extends Controller {
	/** The granularity timed gestures snap to. */
	static readonly snapMinutes = SNAP_MINUTES

	private readonly element: Component
	private drag?: Drag

	constructor(host: Component, private readonly grid: 'week' | 'month' = 'week') {
		super(host)
		this.element = host
	}

	override hostConnected() {
		this.element.addEventListener('pointerdown', this.onPointerDown)
	}

	override hostDisconnected() {
		this.element.removeEventListener('pointerdown', this.onPointerDown)
	}

	private get defaultSource(): Source | undefined {
		const visibleSources = getIntegrations().flatMap(i => [...i.sources]).filter(s => s.visible)
		return visibleSources.find(s => s.id === getDefaultSourceId()) ?? visibleSources[0]
	}

	/** The create mode a pointerdown starts on empty space, or `undefined` if it shouldn't start one. Month
	 * is all-day only (its day cells render an empty `.entries` grid, so the week's zone detection can't be used). */
	private createModeAt(target: HTMLElement): Mode | undefined {
		if (this.grid === 'month') {
			return target.closest('mitra-day') ? 'allday' : undefined
		}
		return target.closest('.all-day') ? 'allday' : target.closest('.entries') ? 'timed' : undefined
	}

	/** Move/resize work in minutes only for a timed entry in the week; the all-day lane and the whole month
	 * are day-granular (a timed entry moved in the month therefore shifts by days and keeps its time). */
	private editMode(entry: Entry): Mode {
		return this.grid === 'month' || entry.allDay ? 'allday' : 'timed'
	}

	/** Snapshot every day cell's box (and its timed-grid box) once, so moves need no DOM reads. */
	private snapshotCells(): Array<Cell> {
		return [...this.element.querySelectorAll<HTMLElement>('mitra-day')].map(element => {
			const rect = element.getBoundingClientRect()
			const grid = element.querySelector<HTMLElement>('.entries')?.getBoundingClientRect() ?? rect
			return { date: new DateTime(element.dataset.date!), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, gridTop: grid.top, gridHeight: grid.height }
		})
	}

	/** The day cell at a pointer position. In the week (a single row) this is a horizontal lookup clamped
	 * to the first/last column (correct in both LTR and RTL); in the month (a 2-D grid) it's the cell
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
		// No id: it's a draft until the backend assigns one on create (see Entry.persisted / DraftController).
		// Type follows the target calendar: a task source makes a task (a VTODO on CalDAV), else an event.
		const type = drag.source!.type === SourceType.Task ? EntryType.Task : EntryType.Event
		const base = { sourceId: drag.source!.id, type, heading: '' }
		if (drag.mode === 'allday') {
			const { start, end } = placeAllDay(anchor.date, current.date)
			return new Entry({ ...base, start, end, allDay: true })
		}
		const { start, end } = placeTimed(anchor.date.dayStart.add({ minutes: anchor.minute }), current.date.dayStart.add({ minutes: current.minute }))
		return new Entry({ ...base, start, end, allDay: false })
	}

	/** Translate the dragged entry by the gesture delta, preserving its duration. A clone (never a mutation
	 * of the authoritative entry) so a cancelled gesture leaves the original untouched. */
	private buildMove(current: DragPoint): Entry | undefined {
		const drag = this.drag!
		const entry = drag.entry!
		if (!entry.start || !entry.end) {
			return undefined
		}
		if (drag.mode === 'allday') {
			const days = Math.round((current.date.dayStart.valueOf() - drag.anchor.date.dayStart.valueOf()) / 86_400_000)
			return new Entry({ ...entry, start: entry.start.add({ days }), end: entry.end.add({ days }) })
		}
		const grabMs = drag.anchor.date.dayStart.add({ minutes: drag.anchor.minute }).valueOf()
		const currentMs = current.date.dayStart.add({ minutes: current.minute }).valueOf()
		// Snap the moved start onto the grid (the user's choice), then shift both ends by that to keep duration.
		const shift = snapToGrid(entry.start.valueOf() + (currentMs - grabMs)) - entry.start.valueOf()
		return new Entry({ ...entry, start: entry.start.add({ milliseconds: shift }), end: entry.end.add({ milliseconds: shift }) })
	}

	/** Drag one edge of the entry to the current point, keeping the other fixed (and flipping past it). */
	private buildResize(current: DragPoint): Entry | undefined {
		const drag = this.drag!
		const entry = drag.entry!
		if (!entry.start || !entry.end) {
			return undefined
		}
		const dragged = entry.allDay ? current.date : current.date.dayStart.add({ minutes: current.minute })
		const { start, end } = resizePlacement(entry, drag.edge!, dragged)
		return new Entry({ ...entry, start, end })
	}

	/** The entry a frame should render for the current gesture, resolved against the cached geometry. */
	private buildAt(point: { x: number, y: number }): Entry | undefined {
		const drag = this.drag!
		const current = this.pointAt(drag.cells, point.x, point.y, drag.mode)
		if (!current) {
			return undefined
		}
		switch (drag.kind) {
			case 'create': return this.buildCreate(drag.anchor, current)
			case 'move': return this.buildMove(current)
			case 'resize': return this.buildResize(current)
		}
	}

	private begin(drag: Drag, e: PointerEvent) {
		this.drag = drag
		this.element.setPointerCapture(e.pointerId)
		this.element.addEventListener('pointermove', this.onPointerMove)
		this.element.addEventListener('pointerup', this.onPointerUp)
		this.element.addEventListener('pointercancel', this.onPointerCancel)
	}

	/** End the gesture: release capture (if still held), unbind, cancel any pending frame, go idle. */
	private teardown(pointerId: number) {
		if (this.element.hasPointerCapture(pointerId)) {
			this.element.releasePointerCapture(pointerId)
		}
		this.element.removeEventListener('pointermove', this.onPointerMove)
		this.element.removeEventListener('pointerup', this.onPointerUp)
		this.element.removeEventListener('pointercancel', this.onPointerCancel)
		if (this.drag?.frame !== undefined) {
			cancelAnimationFrame(this.drag.frame)
		}
		this.drag = undefined
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) {
			return
		}
		const target = e.target as HTMLElement
		if (target.closest('mitra-entry-details') || target.closest('mitra-task-status')) {
			// Interactions inside the editor popover, or on a task's status checkbox/menu, are never grid
			// gestures — otherwise a tap on the checkbox would also register as a tap-to-open on the segment.
			return
		}
		const cells = this.snapshotCells()
		const common = { pointerId: e.pointerId, origin: { x: e.clientX, y: e.clientY }, point: { x: e.clientX, y: e.clientY }, cells, moved: false }

		// Move / resize an existing entry — persisted ones only (a draft is owned by the create flow + editor).
		const segment = target.closest('mitra-entry-segment') as EntrySegmentComponent | null
		const entry = segment?.segment?.entry
		if (segment) {
			if (!entry?.persisted) {
				return
			}
			const mode = this.editMode(entry)
			const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
			if (!anchor) {
				return
			}
			const edge = target.closest('.resize-start') ? 'start' : target.closest('.resize-end') ? 'end' : undefined
			const kind: Kind = edge ? 'resize' : 'move'
			this.begin({ ...common, kind, mode, anchor, entry, edge, grabbedSegment: kind === 'move' ? segment : undefined }, e)
			return
		}

		// Create on empty grid / lane / cell.
		const mode = this.createModeAt(target)
		const source = mode ? this.defaultSource : undefined
		if (!mode || !source) {
			return
		}
		const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.begin({ ...common, kind: 'create', mode, anchor, source }, e)
	}

	// Coalesce: record the latest position and process at most once per frame (pointermove fires far more
	// often than the screen refreshes, and each update is a full re-render).
	private readonly onPointerMove = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		drag.point = { x: e.clientX, y: e.clientY }
		drag.frame ??= requestAnimationFrame(this.processFrame)
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
				DraftController.setDragging(true) // float the entry above its cluster while it's dragged
			}
		}
		const draft = this.buildAt(drag.point)
		if (draft) {
			DraftController.upsertDraft(draft)
		}
	}

	private readonly onPointerUp = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}

		if (drag.kind === 'create') {
			// A real drag creates the spanning entry; a plain click quick-creates a single day in the month
			// (where clicking a cell is the add affordance) and creates nothing in the week. The last
			// coalesced frame may not have run, so resolve the release position here (before teardown).
			const create = drag.moved || this.grid === 'month'
			const draft = !create ? undefined : drag.moved ? this.buildAt(drag.point) : this.buildCreate(drag.anchor, drag.anchor)
			this.teardown(e.pointerId)
			if (draft) {
				DraftController.upsertDraft(draft)
			}
			create ? DraftController.openDraft() : DraftController.discard()
			return
		}

		// Move / resize: persist a real drag; a plain tap on a body opens the editor (handles never open).
		if (drag.moved) {
			const draft = this.buildAt(drag.point)
			this.teardown(e.pointerId)
			DraftController.setDragging(false)
			if (draft) {
				DraftController.upsertDraft(draft) // keep the optimistic position until the server echoes it
				updateEvent(draft).catch(() => DraftController.discard(draft)) // on failure, revert *this* draft
			}
		} else {
			const segment = drag.kind === 'move' ? drag.grabbedSegment : undefined
			this.teardown(e.pointerId)
			DraftController.setDragging(false)
			if (segment) {
				segment.open = true
			}
		}
	}

	/** A browser-interrupted gesture (touch hand-off, OS/context-menu gesture): tear down and drop the
	 * optimistic overlay — nothing is persisted on cancel, so the entry reverts to its server state. */
	private readonly onPointerCancel = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		this.teardown(e.pointerId)
		DraftController.discard()
	}
}
