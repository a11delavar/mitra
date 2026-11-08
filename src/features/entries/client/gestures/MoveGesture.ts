import { type Entry } from '../../Entry.js'
import { SnapSetting } from '../SnapSetting.js'
import { EntryStore } from '../EntryStore.js'
import type { EntrySegmentComponent } from '../EventSegment.js'
import { DragGesture, type DragMode, type DragPoint, type DragStart, type Pointer } from './DragGesture.js'
import { EditGesture } from './EditGesture.js'

/** Carries an entry to where the pointer goes, as a preview until the drop; into the unscheduled list, it takes the dates off. */
export class MoveGesture extends EditGesture {
	private preview?: Entry

	constructor(start: DragStart, mode: DragMode, entry: Entry,
		/** The point of the entry the gesture has hold of; the drop carries the same offset to the pointer. */
		private readonly anchor: DragPoint | undefined,
		private readonly grabbedSegment: EntrySegmentComponent) {
		super(start, mode, entry)
	}

	protected get intent() { return 'move' as const }

	override build(point: Pointer) {
		if (this.overUnscheduled(point)) {
			if (!this.entry.unschedulable) {
				return undefined
			}
			const cleared = this.before.clone()
			cleared.unschedule()
			return cleared
		}
		if (!this.places(point)) {
			return undefined
		}
		const mode: DragMode = this.laneBottom === undefined ? this.mode : point.y <= this.laneBottom ? 'allday' : 'timed'
		const current = this.pointAt(point.x, point.y, mode)
		return current && this.placed(current, mode)
	}

	private placed(current: DragPoint, mode: DragMode) {
		const placed = this.before.clone()
		if (!placed.start || (!placed.end && !placed.point)) {
			placed.scheduleAt(mode === 'allday' ? current.date : DragGesture.instantOf(current), mode === 'allday')
			return placed.fit()
		}
		if (this.laneBottom !== undefined && (mode === 'allday') !== placed.allDay) {
			placed.setAllDay(mode === 'allday')
			placed.moveStart(mode === 'allday' ? current.date.dayStart : DragGesture.instantOf(current))
			return placed.fit()
		}
		const anchor = this.anchor!
		placed.adopt(this.mode === 'allday'
			? placed.span.movedByDays(anchor.date.dayStart.zonedDateTime.toPlainDate().until(current.date.dayStart.zonedDateTime.toPlainDate()).days)
			: placed.span.movedBy(DragGesture.instantOf(current).valueOf() - DragGesture.instantOf(anchor).valueOf(), SnapSetting.current))
		return placed
	}

	protected override apply(built: Entry) {
		const preview = this.preview ??= Object.assign(built.clone(), { id: undefined })
		// Frames keep landing on the same snapped spot while the pointer stays in it, and
		// repainting every chip to redraw an identical ghost is what made dragging drag.
		if (EntryStore.pending.previewing(preview) && preview.span.equals(built.span)) {
			return
		}
		preview.adopt(built.span)
		EntryStore.pending.setPreview(preview)
	}

	/** Takes the ghost away rather than leave it at the last spot that had one, and stops repainting the grid behind it. */
	protected override nowhere() {
		if (this.preview) {
			EntryStore.pending.setPreview(undefined)
		}
	}

	protected override tapped() {
		this.grabbedSegment.open = true
	}

	/** With Alt, a copy lands where the entry would have gone, and the entry stays. */
	protected override dropOn(built: Entry, e: PointerEvent) {
		if (e.altKey && this.entry.copyable) {
			EntryStore.duplicate(this.entry, built.span).catch(() => void 0)
			return undefined
		}
		return super.dropOn(built, e)
	}
}
