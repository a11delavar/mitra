import type { Source } from '#features/sources'
import type { AvailabilitySegment } from '#features/availability/client/AvailabilitySegment.js'
import { type Entry } from '../../Entry.js'
import { EntrySpan } from '../../EntrySpan.js'
import { type EntryType } from '../../EntryType.js'
import { SnapSetting } from '../SnapSetting.js'
import { EntryStore } from '../EntryStore.js'
import { EntryEditorIntent } from '../EntryEditorIntent.js'
import { DragGesture, type DragMode, type DragPoint, type DragStart, type Pointer } from './DragGesture.js'

/** Draws a new entry across the days or hours it covers, in the calendar new entries go to. */
export class CreateGesture extends DragGesture {
	private draft?: Entry

	constructor(start: DragStart, mode: DragMode, private readonly anchor: DragPoint, private readonly source: Source,
		private readonly type: EntryType | undefined,
		/** The availability it started on, opened if the tap never became a drag. */
		private readonly availability?: AvailabilitySegment) {
		super(start, mode)
	}

	override build(point: Pointer) {
		const current = this.places(point) ? this.pointAt(point.x, point.y, this.mode) : undefined
		if (!current) {
			return undefined
		}
		const { start, end, allDay } = this.mode === 'allday'
			? EntrySpan.allDay(this.anchor.date, current.date)
			: EntrySpan.timed(DragGesture.instantOf(this.anchor), DragGesture.instantOf(current), SnapSetting.current)
		return this.source.draft({ type: this.type ?? this.source.defaultEntryType, start, end, allDay })
	}

	protected override apply(built: Entry) {
		const draft = this.draft ??= built
		draft.adopt(built.span)
		EntryStore.pending.upsertDraft(draft)
	}

	override held() {
		this.moved = true
		this.step()
	}

	override drop() {
		const built = this.moved ? this.build(this.point) : undefined
		if (built) {
			this.apply(built)
			EntryEditorIntent.openDraft(this.draft!)
			return
		}
		EntryStore.pending.discardDraft()
		// Pointer capture swallows the click, so the tap is handled here.
		if (this.availability) {
			this.availability.open = true
		}
	}

	override cancel() {
		EntryStore.pending.discardDraft()
	}
}
