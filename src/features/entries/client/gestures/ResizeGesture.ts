import { type Entry } from '../../Entry.js'
import { SnapSetting } from '../SnapSetting.js'
import { EntryStore } from '../EntryStore.js'
import { DragGesture, type DragMode, type DragStart, type Pointer } from './DragGesture.js'
import { EditGesture } from './EditGesture.js'

/** Drags one edge of an entry, which may cross the other. */
export class ResizeGesture extends EditGesture {
	constructor(start: DragStart, mode: DragMode, entry: Entry, private readonly edge: 'start' | 'end') {
		super(start, mode, entry)
	}

	protected get intent() { return 'edit' as const }

	override build(point: Pointer) {
		const { before } = this
		const current = before.start && before.end && this.places(point) ? this.pointAt(point.x, point.y, this.mode) : undefined
		if (!current) {
			return undefined
		}
		const resized = before.clone()
		resized.adopt(before.span.resized(this.edge, before.allDay ? current.date : DragGesture.instantOf(current), SnapSetting.current))
		return resized
	}

	protected override apply(built: Entry) {
		this.entry.adopt(built.span)
		EntryStore.notifyMoved(this.entry)
	}

	override cancel() {
		super.cancel()
		this.entry.adopt(this.before.span)
		EntryStore.notify()
	}
}
