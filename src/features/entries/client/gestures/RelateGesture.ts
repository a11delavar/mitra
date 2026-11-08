import { RelationType } from '#features/relations'
import { type ConnectionAim, type EntryConnections } from '#features/relations/client/EntryConnections.js'
import { DialogRelationFailed } from '#features/relations/client/DialogRelationFailed.js'
import { type Entry } from '../../Entry.js'
import { EntryStore } from '../EntryStore.js'
import { type EntrySegment } from '../EntrySegment.js'
import type { EntrySegmentComponent } from '../EventSegment.js'
import { DragGesture, type DragMode, type DragStart } from './DragGesture.js'

/** What a relating gesture draws: from the chip whose handle it took, toward a chip or an aim. */
export interface Drawing {
	readonly from: EntrySegment
	readonly source: EntryConnections
	readonly host?: EntryConnections
	readonly layers: ReadonlyArray<EntryConnections>
}

/** Draws a link from one entry to another that cannot start before it finishes. */
export class RelateGesture extends DragGesture {
	private hovered?: EntrySegmentComponent
	private target?: EntrySegmentComponent
	private shape?: string
	private cancelled = false

	constructor(start: DragStart, mode: DragMode, private readonly drawing: Drawing) {
		super(start, mode)
	}

	override get watchesWindow() { return true }

	override step() {
		if (this.cancelled) {
			return
		}
		const { drawing } = this
		const { x, y } = this.point
		const source = drawing.from.entry
		const chip = (document.elementFromPoint(x, y)?.closest('mitra-entry-segment') ?? undefined) as EntrySegmentComponent | undefined
		const candidate = chip?.segment?.entry
		const valid = !!candidate && source.hierarchy.canBlock(candidate)
		if (chip !== this.hovered) {
			this.hovered?.removeAttribute('data-connect')
			this.hovered = chip
		}
		chip?.setAttribute('data-connect', valid ? 'target' : 'reject')
		this.target = valid ? chip : undefined

		const to: EntrySegment | ConnectionAim = this.target?.segment ?? drawing.source.aimAt(x, y)
		const target = this.target?.segment?.entry
		const violated = target
			? target.violates({ type: RelationType.FinishToStart, targetUid: source.uid }, source)
			: this.aimsBehind(x, y, source)
		const origin = drawing.host?.originBox
		if (origin) {
			drawing.host!.style.setProperty('--_pointer-x', `${x - origin.left}px`)
			drawing.host!.style.setProperty('--_pointer-y', `${y - origin.top}px`)
		}
		const shape = `${this.target?.segment?.id ?? ''} ${'entry' in to ? '' : `${to.forward}${to.down}`} ${violated}`
		if (shape !== this.shape) {
			for (const layer of drawing.layers) {
				layer.draft = { from: drawing.from, to, violated }
			}
		}
		this.shape = shape
	}

	private aimsBehind(x: number, y: number, source: Entry) {
		const required = source.end ?? source.start
		if (!required) {
			return false
		}
		const point = this.pointAt(x, y, this.laneBottom !== undefined && y > this.laneBottom ? 'timed' : 'allday')
		return !!point && DragGesture.instantOf(point).valueOf() < required.valueOf()
	}

	private clear() {
		this.hovered?.removeAttribute('data-connect')
		this.hovered = undefined
		this.target = undefined
		for (const layer of this.drawing.layers) {
			layer.draft = undefined
			layer.style.removeProperty('--_pointer-x')
			layer.style.removeProperty('--_pointer-y')
		}
		this.shape = undefined
	}

	override drop() {
		const source = this.drawing.from.entry
		const target = this.moved && !this.cancelled ? this.target?.segment?.entry : undefined
		this.clear()
		if (target) {
			EntryStore.commitRelations(target, () => target.relateTo(RelationType.FinishToStart, source.uid!))
				.catch((error: unknown) => new DialogRelationFailed({
					message: error instanceof Error ? error.message : t('This relationship is not possible'),
				}).confirm())
		}
	}

	override cancel() {
		this.clear()
	}

	override escape() {
		if (this.cancelled) {
			return false
		}
		this.cancelled = true
		this.clear()
		return true
	}

	override scrolled() {
		return this.moved && !this.cancelled
	}
}
