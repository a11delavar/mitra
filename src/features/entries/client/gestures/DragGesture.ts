import type { DateTime } from '@3mo/date-time'
import { type Entry } from '../../Entry.js'
import { SnapSetting } from '../SnapSetting.js'
import { type DayCells, type DayCell } from '../DayCells.js'

/** Whether a gesture places days or times. */
export type DragMode = 'timed' | 'allday'

/** A day and a minute of it, where a gesture holds or points. */
export interface DragPoint {
	readonly date: DateTime
	readonly minute: number
}

export interface Pointer {
	readonly x: number
	readonly y: number
}

/** What a gesture snapshots as it begins, so every frame stays free of layout reads. */
export interface DragStart {
	readonly pointerId: number
	readonly surface: HTMLElement
	readonly origin: Pointer
	readonly cells: DayCells
	/** Where the all-day lane ends, on a grid that has one. */
	readonly laneBottom?: number
	readonly unscheduledBox?: DOMRect
	readonly gridBox?: DOMRect
	/** On a narrow window the sidebar lies over the grid, so its rect is no proof of a day underneath. */
	readonly sidebarBox?: DOMRect
	/** A touch or a pen holds before it drags, so a scroll stays a scroll. */
	readonly armed: boolean
}

const within = (box: DOMRect | undefined, point: Pointer) =>
	!!box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom

/**
 * One gesture on a calendar grid, from the pointer going down to it going up: where it would land the entry at a point
 * (`build`), what a frame shows of that (`apply`), and what the drop or a cancel leaves. The controller only listens.
 */
export abstract class DragGesture {
	readonly pointerId: number
	readonly surface: HTMLElement
	readonly origin: Pointer
	readonly cells: DayCells
	readonly laneBottom?: number
	private readonly unscheduledBox?: DOMRect
	private readonly gridBox?: DOMRect
	private readonly sidebarBox?: DOMRect
	point: Pointer
	moved = false
	armed: boolean
	holdTimer?: ReturnType<typeof setTimeout>
	frame?: number

	constructor(start: DragStart, readonly mode: DragMode) {
		this.pointerId = start.pointerId
		this.surface = start.surface
		this.origin = start.origin
		this.point = start.origin
		this.cells = start.cells
		this.laneBottom = start.laneBottom
		this.unscheduledBox = start.unscheduledBox
		this.gridBox = start.gridBox
		this.sidebarBox = start.sidebarBox
		this.armed = start.armed
	}

	/** Whether it listens to the window too, for keys and scrolls. */
	get watchesWindow() { return false }

	/** Where it would land the entry with the pointer at `point`, or nowhere. */
	build(_point: Pointer): Entry | undefined {
		return undefined
	}

	/** Shows what a frame built. */
	protected apply(_built: Entry) { }

	/** A touch held long enough to begin. */
	held() { }

	/** The pointer first moved past a tap's slop. */
	started() { }

	/** A frame, the pointer at {@link point}. */
	step() {
		const built = this.build(this.point)
		if (built) {
			this.apply(built)
		} else {
			this.nowhere()
		}
	}

	/** Nothing under the pointer to place it on. */
	protected nowhere() { }

	/** The pointer went up, with the gesture's listeners already gone. */
	abstract drop(e: PointerEvent): void

	/** The gesture was taken away (a pinch, the system), leaving everything as it was. */
	abstract cancel(): void

	/** Escape pressed while it listens to the window; answers whether it took the key. */
	escape() { return false }

	/** Whether a scroll needs a frame. */
	scrolled() { return false }

	/** The day and minute of `cells` at `x`, `y`, snapped to the nearest line where the mode places times. */
	static pointIn(cells: DayCells, x: number, y: number, mode: DragMode): DragPoint | undefined {
		const cell = cells.nearest(x, y)
		return cell ? { date: cell.date, minute: mode === 'timed' ? DragGesture.minuteIn(cell, y) : 0 } : undefined
	}

	private static minuteIn(cell: DayCell, y: number) {
		const raw = (y - cell.gridTop) / (cell.gridHeight / 1440)
		const snapped = Math.round(raw / SnapSetting.current) * SnapSetting.current
		return Math.max(0, Math.min(1440, snapped))
	}

	protected pointAt(x: number, y: number, mode: DragMode) {
		return DragGesture.pointIn(this.cells, x, y, mode)
	}

	protected overUnscheduled(point: Pointer) {
		return within(this.unscheduledBox, point)
	}

	/** Whether a day lies under the point. Cells are picked by nearness, so without this every point would snap into one, including those over a sidebar drawn on top of the grid. */
	protected places(point: Pointer) {
		return within(this.gridBox, point) && !within(this.sidebarBox, point)
	}

	protected static instantOf(point: DragPoint) {
		return point.date.dayStart.add({ minutes: point.minute })
	}
}
