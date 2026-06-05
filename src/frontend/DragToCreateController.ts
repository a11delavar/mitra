import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, SourceType, type Source } from 'shared'
import { getIntegrations } from './Api.js'
import { DraftController } from './DraftController.js'

type Mode = 'timed' | 'allday'

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
	readonly mode: Mode
	readonly source: Source
	readonly pointerId: number
	readonly origin: { x: number, y: number }
	readonly cells: ReadonlyArray<Cell>
	readonly anchor: DragPoint
	point: { x: number, y: number }
	moved: boolean
	frame?: number
}

/**
 * Drag-to-create, attached to a view's grid container so a gesture can span day cells. The same controller
 * serves both views via its `grid` mode:
 *
 * - **week** (`Days`): drag the timed grid → a multi-day **timed** entry (time read off the existing
 *   1440-row grid, snapped to {@link snapMinutes}); drag the all-day lane → an all-day / multi-day all-day
 *   entry. A plain click creates nothing.
 * - **month** (`Month`): every gesture is all-day; drag across day cells (in 2-D, across week rows) → a
 *   multi-day all-day entry; a plain click on a day quick-creates a single-day all-day entry.
 *
 * The in-progress entry is pushed to {@link DraftController} so it renders through the normal segment
 * pipeline; on release the draft's editor is opened. Moves are coalesced to one update per animation frame
 * and resolved against a geometry snapshot taken at drag start, so a fast drag doesn't thrash layout.
 */
export class DragToCreateController extends Controller {
	/** The granularity timed drags snap to. A single knob today; a user setting (e.g. 30) later. */
	static readonly snapMinutes = 15

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

	/** The source new entries land in. In development we prefer the dev sample calendar, so dragging
	 * doesn't accidentally create on a real (and slow-to-write) CalDAV account. */
	private get defaultSource(): Source | undefined {
		const integrations = getIntegrations()
		const visibleEvent = (source: Source) => source.enabled && !source.hidden && source.type === SourceType.Event
		const devSources = [...(integrations.find(integration => integration.type === 'dev')?.sources ?? [])]
		return devSources.find(visibleEvent)
			?? integrations.flatMap(integration => [...integration.sources]).find(visibleEvent)
	}

	/** The drag mode a pointerdown starts, or `undefined` if it shouldn't start one. Month is all-day only
	 * (its day cells render an empty `.entries` grid, so the week's zone detection can't be used). */
	private modeAt(target: HTMLElement): Mode | undefined {
		if (this.grid === 'month') {
			return target.closest('mitra-day') ? 'allday' : undefined
		}
		return target.closest('.all-day') ? 'allday' : target.closest('.entries') ? 'timed' : undefined
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
		const snapped = Math.round(raw / DragToCreateController.snapMinutes) * DragToCreateController.snapMinutes
		return Math.max(0, Math.min(1440, snapped))
	}

	/** Resolve a pointer position to a day (and, for a timed drag, a minute) against the cached geometry. */
	private pointAt(cells: ReadonlyArray<Cell>, x: number, y: number, mode: Mode): DragPoint | undefined {
		const cell = this.cellAt(cells, x, y)
		return cell ? { date: cell.date, minute: mode === 'timed' ? this.minuteIn(cell, y) : 0 } : undefined
	}

	private buildDraft(anchor: DragPoint, current: DragPoint): Entry {
		const drag = this.drag!
		// No id: it's a draft until the backend assigns one on create (see Entry.persisted / DraftController).
		const base = { sourceId: drag.source.id, type: EntryType.Event, heading: '' }
		if (drag.mode === 'allday') {
			const [from, to] = anchor.date.dayStart.isAfter(current.date.dayStart) ? [current.date, anchor.date] : [anchor.date, current.date]
			// All-day = a real flag; `start`/`end` still carry the day bounds (exclusive next midnight).
			return new Entry({ ...base, start: from.dayStart, end: to.dayStart.add({ days: 1 }), allDay: true })
		}
		const a = anchor.date.dayStart.add({ minutes: anchor.minute })
		const b = current.date.dayStart.add({ minutes: current.minute })
		let [start, end] = a.valueOf() <= b.valueOf() ? [a, b] : [b, a]
		if (end.valueOf() <= start.valueOf()) {
			end = start.add({ minutes: DragToCreateController.snapMinutes })
		}
		return new Entry({ ...base, start, end, allDay: false })
	}

	/** The draft for the current pointer position, resolved against the drag's cached geometry. */
	private draftAt(x: number, y: number): Entry | undefined {
		const drag = this.drag
		if (!drag) {
			return undefined
		}
		const current = this.pointAt(drag.cells, x, y, drag.mode)
		return current ? this.buildDraft(drag.anchor, current) : undefined
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) {
			return
		}
		const target = e.target as HTMLElement
		// Existing entries handle their own click (to open); drags start on empty grid / lane / cell only.
		if (target.closest('mitra-entry-segment')) {
			return
		}
		const mode = this.modeAt(target)
		const source = mode ? this.defaultSource : undefined
		if (!mode || !source) {
			return
		}
		const cells = this.snapshotCells()
		const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.drag = {
			mode,
			source,
			pointerId: e.pointerId,
			origin: { x: e.clientX, y: e.clientY },
			point: { x: e.clientX, y: e.clientY },
			cells,
			anchor,
			moved: false,
		}
		this.element.setPointerCapture(e.pointerId)
		this.element.addEventListener('pointermove', this.onPointerMove)
		this.element.addEventListener('pointerup', this.onPointerUp)
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
		}
		const draft = this.draftAt(drag.point.x, drag.point.y)
		if (draft) {
			DraftController.upsertDraft(draft)
		}
	}

	private readonly onPointerUp = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		this.element.releasePointerCapture(e.pointerId)
		this.element.removeEventListener('pointermove', this.onPointerMove)
		this.element.removeEventListener('pointerup', this.onPointerUp)
		if (drag.frame !== undefined) {
			cancelAnimationFrame(drag.frame)
		}

		// A real drag creates the spanning entry; a plain click quick-creates a single day in the month
		// view (where clicking a cell is the add affordance) and creates nothing in the week.
		const create = drag.moved || this.grid === 'month'
		if (create) {
			// On a click `anchor === current`, so this builds a single-day entry; on a drag the last
			// coalesced frame may not have run, so resolve the release position here.
			const draft = drag.moved ? this.draftAt(drag.point.x, drag.point.y) : this.buildDraft(drag.anchor, drag.anchor)
			if (draft) {
				DraftController.upsertDraft(draft)
			}
		}

		this.drag = undefined
		create ? DraftController.openDraft() : DraftController.discard()
	}
}
