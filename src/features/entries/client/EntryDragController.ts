import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Source } from '../../sources/Source.js'
import { EntryPlan } from '../../relations/EntryPlan.js'
import { EntryChange } from '../EntryChange.js'
import { Entry } from '../Entry.js'
import { DefaultDurationSetting } from './DefaultDurationSetting.js'
import { SnapSetting } from './SnapSetting.js'
import { DefaultReminderSetting } from '../../reminders/client/DefaultReminderSetting.js'
import { EntryType } from '../EntryType.js'
import { getPrimarySource, getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import * as Hierarchy from '../../relations/client/Hierarchy.js'
import { Relations } from '../../relations/client/Relations.js'
import { RelationType } from '../../relations/RelationType.js'
import { type ConnectionAim, type EntryConnections } from '../../relations/client/EntryConnections.js'
import { DialogRelationFailed } from '../../relations/client/DialogRelationFailed.js'
import { type EntrySegment } from './EntrySegment.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import type { EntrySegmentComponent } from './EventSegment.js'
import { placeAllDay, placeTimed, resizePlacement, snapToGrid } from './entryPlacement.js'
import { haptic } from '../../../design/haptics.js'

type Mode = 'timed' | 'allday'

type Kind = 'create' | 'move' | 'resize' | 'relate'

const TOUCH_HOLD_MS = 500
const TOUCH_HOLD_TOLERANCE = 10
const TOUCH_HOLD_FEEDBACK_MS = 15

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

interface Drawing {
	readonly from: EntrySegment
	readonly source: EntryConnections
	readonly host?: EntryConnections
	readonly layers: ReadonlyArray<EntryConnections>
	hovered?: EntrySegmentComponent
	target?: EntrySegmentComponent
	shape?: string
}

interface Drag {
	readonly kind: Kind
	readonly mode: Mode
	readonly anchor?: DragPoint
	readonly source?: Source
	readonly entry?: Entry
	readonly before?: Entry
	readonly edge?: 'start' | 'end'
	readonly grabbedSegment?: EntrySegmentComponent
	readonly pointerId: number
	readonly surface: HTMLElement
	readonly origin: { x: number, y: number }
	readonly cells: ReadonlyArray<Cell>
	readonly laneBottom?: number
	readonly unscheduledBox?: DOMRect
	point: { x: number, y: number }
	moved: boolean
	armed: boolean
	holdTimer?: ReturnType<typeof setTimeout>
	frame?: number
	gestureDraft?: Entry
	preview?: Entry
	drawing?: Drawing
	cancelled?: boolean
}

/**
 * Drag gesture controller for calendar grids (create, move, resize, and relate gestures).
 */
export class EntryDragController extends Controller {
	static get snapMinutes() { return SnapSetting.current }

	private static readonly grids = new Set<EntryDragController>()

	/**
	 * Hand off an external drag gesture (e.g. from the unscheduled drawer) to the active calendar grid.
	 */
	static beginExternal(entry: Entry, segment: EntrySegmentComponent, surface: HTMLElement, e: PointerEvent) {
		const controller = [...this.grids].filter(controller => controller.element.isConnected).at(-1)
		controller?.beginExternal(entry, segment, surface, e)
	}

	private static unscheduledBox() {
		const section = document.querySelector('mitra-unscheduled')
		const box = section && EntryDragController.visibleBox(section)
		return box && box.width > 0 && box.height > 0 ? box : undefined
	}

	private static visibleBox(element: Element) {
		let box = element.getBoundingClientRect()
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

	constructor(host: Component, private readonly grid: 'week' | 'month' | 'year' | 'timeline' = 'week') {
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

	private requiresHold(pointerType: string): boolean {
		return pointerType === 'touch' || pointerType === 'pen'
	}

	private createModeAt(target: HTMLElement): Mode | undefined {
		if (this.grid === 'timeline') {
			return target.closest('.create') ? 'allday' : undefined
		}
		if (this.grid !== 'week') {
			return target.closest('mitra-day') ? 'allday' : undefined
		}
		return target.closest('.all-day') ? 'allday' : target.closest('.entries') ? 'timed' : undefined
	}

	private get createType(): EntryType | undefined {
		return this.grid === 'timeline' ? EntryType.Task : undefined
	}

	private editMode(entry: Entry): Mode {
		return this.grid !== 'week' || entry.allDay ? 'allday' : 'timed'
	}

	private snapshotCells(): Array<Cell> {
		const cells = this.element.querySelectorAll<HTMLElement>(this.grid === 'timeline' ? '.backdrop .day' : 'mitra-day')
		return [...cells].map(element => {
			const rect = element.getBoundingClientRect()
			const grid = this.grid === 'timeline' ? rect : element.querySelector<HTMLElement>('.entries')?.getBoundingClientRect() ?? rect
			return { date: new DateTime(element.dataset.date!), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, gridTop: grid.top, gridHeight: grid.height }
		})
	}

	private cellAt(cells: ReadonlyArray<Cell>, x: number, y: number): Cell | undefined {
		if (!cells.length) {
			return undefined
		}
		if (this.grid === 'week' || this.grid === 'timeline') {
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

	private minuteIn(cell: Cell, y: number): number {
		const raw = (y - cell.gridTop) / (cell.gridHeight / 1440)
		const snapped = Math.round(raw / EntryDragController.snapMinutes) * EntryDragController.snapMinutes
		return Math.max(0, Math.min(1440, snapped))
	}

	private pointAt(cells: ReadonlyArray<Cell>, x: number, y: number, mode: Mode): DragPoint | undefined {
		const cell = this.cellAt(cells, x, y)
		return cell ? { date: cell.date, minute: mode === 'timed' ? this.minuteIn(cell, y) : 0 } : undefined
	}

	private buildCreate(anchor: DragPoint, current: DragPoint): Entry {
		const drag = this.drag!
		const base = { sourceId: drag.source!.id, type: this.createType ?? drag.source!.defaultEntryType, heading: '' }
		if (drag.mode === 'allday') {
			const { start, end } = placeAllDay(anchor.date, current.date)
			return new Entry({ ...base, start, end, allDay: true })
		}
		const { start, end } = placeTimed(anchor.date.dayStart.add({ minutes: anchor.minute }), current.date.dayStart.add({ minutes: current.minute }), EntryDragController.snapMinutes)
		const reminders = getCapabilities(drag.source!.id).reminders ? DefaultReminderSetting.reminders : undefined
		return new Entry({ ...base, start, end, allDay: false, reminders })
	}

	private buildMove(current: DragPoint, mode: Mode): Entry | undefined {
		const drag = this.drag!
		const before = drag.before!
		if (!before.start || !before.end) {
			const placed = before.clone()
			placed.scheduleAt(mode === 'allday' ? current.date : current.date.dayStart.add({ minutes: current.minute }), mode === 'allday', DefaultDurationSetting.current)
			return placed
		}
		if (drag.laneBottom !== undefined && (mode === 'allday') !== before.allDay) {
			const converted = before.clone()
			converted.setAllDay(mode === 'allday', DefaultDurationSetting.current)
			converted.moveStart(mode === 'allday' ? current.date.dayStart : current.date.dayStart.add({ minutes: current.minute }))
			return converted
		}
		if (drag.mode === 'allday') {
			const days = Math.round((current.date.dayStart.valueOf() - drag.anchor!.date.dayStart.valueOf()) / 86_400_000)
			return new Entry({ ...before, start: before.start.add({ days }), end: before.end.add({ days }) })
		}
		const grabMs = drag.anchor!.date.dayStart.add({ minutes: drag.anchor!.minute }).valueOf()
		const currentMs = current.date.dayStart.add({ minutes: current.minute }).valueOf()
		const shift = snapToGrid(before.start.valueOf() + (currentMs - grabMs), EntryDragController.snapMinutes) - before.start.valueOf()
		return new Entry({ ...before, start: before.start.add({ milliseconds: shift }), end: before.end.add({ milliseconds: shift }) })
	}

	private overUnscheduled(point: { x: number, y: number }) {
		const box = this.drag!.unscheduledBox
		return !!box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
	}

	private buildResize(current: DragPoint): Entry | undefined {
		const drag = this.drag!
		const before = drag.before!
		if (!before.start || !before.end) {
			return undefined
		}
		const dragged = before.allDay ? current.date : current.date.dayStart.add({ minutes: current.minute })
		const { start, end } = resizePlacement(before, drag.edge!, dragged, EntryDragController.snapMinutes)
		return new Entry({ ...before, start, end })
	}

	private buildAt(point: { x: number, y: number }): Entry | undefined {
		const drag = this.drag!
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
			case 'create': return this.buildCreate(drag.anchor!, current)
			case 'move': return this.buildMove(current, mode)
			case 'resize': return this.buildResize(current)
			case 'relate': return undefined
		}
	}

	private begin(drag: Drag) {
		this.drag = drag
		drag.surface.addEventListener('pointermove', this.onPointerMove)
		drag.surface.addEventListener('pointerup', this.onPointerUp)
		drag.surface.addEventListener('pointercancel', this.onPointerCancel)
		drag.surface.addEventListener('touchmove', this.onTouchMove, { passive: false })
		if (drag.kind === 'relate') {
			window.addEventListener('keydown', this.onKeyDown)
			window.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
		}
		if (drag.armed) {
			drag.holdTimer = setTimeout(() => this.activate(true), TOUCH_HOLD_MS)
		} else {
			this.activate(false)
		}
	}

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
		haptic(TOUCH_HOLD_FEEDBACK_MS)
		if (drag.kind === 'create') {
			drag.moved = true
			const built = this.buildAt(drag.point)
			if (built) {
				this.apply(built)
			}
		} else {
			EntryStore.setDragging(drag.entry)
		}
	}

	private abort() {
		if (this.drag) {
			this.teardown(this.drag.pointerId)
		}
	}

	private teardown(pointerId: number) {
		const surface = this.drag?.surface ?? this.element
		if (surface.hasPointerCapture(pointerId)) {
			surface.releasePointerCapture(pointerId)
		}
		surface.removeEventListener('pointermove', this.onPointerMove)
		surface.removeEventListener('pointerup', this.onPointerUp)
		surface.removeEventListener('pointercancel', this.onPointerCancel)
		surface.removeEventListener('touchmove', this.onTouchMove)
		window.removeEventListener('keydown', this.onKeyDown)
		window.removeEventListener('scroll', this.onScroll, { capture: true })
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

		// Connecting handle hit-test takes precedence over entry chip gestures.
		const grip = target.closest('.connect') as (HTMLElement & { segment?: EntrySegment }) | null
		if (grip) {
			const from = grip.segment
			const gripLayer = grip.closest('mitra-entry-connections') as EntryConnections | null
			if (!from || !gripLayer || e.pointerType === 'touch' || !from.entry.relatable) {
				return
			}
			const layers = [...this.element.querySelectorAll<EntryConnections>('mitra-entry-connections')]
			this.begin({
				...common, armed: false, kind: 'relate', mode: this.editMode(from.entry),
				drawing: { from, source: gripLayer, layers, host: layers.find(layer => layer.draftHost) },
			})
			return
		}

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
		const source = mode ? getPrimarySource(this.createType) : undefined
		if (!mode || !source || !getCapabilities(source.id).createEntries) {
			return
		}
		const anchor = this.pointAt(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.begin({ ...common, kind: 'create', mode, anchor, source })
	}

	private readonly onPointerMove = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		if (drag.armed) {
			if (Math.hypot(e.clientX - drag.origin.x, e.clientY - drag.origin.y) > TOUCH_HOLD_TOLERANCE) {
				this.abort()
			}
			return
		}
		drag.point = { x: e.clientX, y: e.clientY }
		drag.frame ??= requestAnimationFrame(this.processFrame)
	}

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
		if (drag.cancelled) {
			return
		}
		if (!drag.moved) {
			if (Math.hypot(drag.point.x - drag.origin.x, drag.point.y - drag.origin.y) <= 4) {
				return
			}
			drag.moved = true
			if (drag.kind === 'move' || drag.kind === 'resize') {
				EntryStore.setDragging(drag.entry)
			}
		}
		if (drag.kind === 'relate') {
			this.updateDraft()
			return
		}
		const built = this.buildAt(drag.point)
		if (built) {
			this.apply(built)
		}
	}

	private updateDraft() {
		const drag = this.drag!
		const drawing = drag.drawing!
		const { x, y } = drag.point
		const source = drawing.from.entry
		const chip = (document.elementFromPoint(x, y)?.closest('mitra-entry-segment') ?? undefined) as EntrySegmentComponent | undefined
		const candidate = chip?.segment?.entry
		const valid = !!candidate && Relations.canBlock(source, candidate)
		if (chip !== drawing.hovered) {
			drawing.hovered?.removeAttribute('data-connect')
			drawing.hovered = chip
		}
		chip?.setAttribute('data-connect', valid ? 'target' : 'reject')
		drawing.target = valid ? chip : undefined

		const port = drawing.source.portBox
		const rtl = getComputedStyle(this.element).direction === 'rtl'
		const portX = port ? (rtl ? port.right : port.left) : x
		const portY = port ? port.top + port.height / 2 : y
		const to: EntrySegment | ConnectionAim = drawing.target?.segment ?? { forward: x >= portX, down: y >= portY }
		const target = drawing.target?.segment?.entry
		const violated = target
			? target.violates({ type: RelationType.FinishToStart, targetUid: source.uid }, source)
			: this.aimsBehind(x, y, source)
		const origin = drawing.host?.originBox
		if (origin) {
			drawing.host!.style.setProperty('--_pointer-x', `${x - origin.left}px`)
			drawing.host!.style.setProperty('--_pointer-y', `${y - origin.top}px`)
		}
		const shape = `${drawing.target?.segment?.id ?? ''} ${'entry' in to ? '' : `${to.forward}${to.down}`} ${violated}`
		if (shape !== drawing.shape) {
			for (const layer of drawing.layers) {
				layer.draft = { from: drawing.from, to, violated }
			}
		}
		drawing.shape = shape
	}

	private aimsBehind(x: number, y: number, source: Entry) {
		const drag = this.drag!
		const required = source.end ?? source.start
		if (!required) {
			return false
		}
		const mode: Mode = drag.laneBottom !== undefined && y > drag.laneBottom ? 'timed' : 'allday'
		const point = this.pointAt(drag.cells, x, y, mode)
		return !!point && point.date.dayStart.add({ minutes: point.minute }).valueOf() < required.valueOf()
	}

	private clearDraft(drawing: Drawing) {
		drawing.hovered?.removeAttribute('data-connect')
		drawing.hovered = undefined
		drawing.target = undefined
		for (const layer of drawing.layers) {
			layer.draft = undefined
			layer.style.removeProperty('--_pointer-x')
			layer.style.removeProperty('--_pointer-y')
		}
		drawing.shape = undefined
	}

	private readonly onScroll = () => {
		const drag = this.drag
		if (drag?.kind === 'relate' && drag.moved && !drag.cancelled) {
			drag.frame ??= requestAnimationFrame(this.processFrame)
		}
	}

	private readonly onKeyDown = (e: KeyboardEvent) => {
		const drag = this.drag
		if (e.key !== 'Escape' || drag?.kind !== 'relate' || drag.cancelled) {
			return
		}
		e.preventDefault()
		drag.cancelled = true
		this.clearDraft(drag.drawing!)
	}

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
				preview.adoptSpan(built)
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
			drag.armed = false
			if (drag.holdTimer !== undefined) {
				clearTimeout(drag.holdTimer)
				drag.holdTimer = undefined
			}
		}

		if (drag.kind === 'relate') {
			const drawing = drag.drawing!
			const source = drawing.from.entry
			const target = drag.moved && !drag.cancelled ? drawing.target?.segment?.entry : undefined
			this.teardown(e.pointerId)
			this.clearDraft(drawing)
			if (target) {
				EntryStore.commitRelations(target, () => target.relateTo(RelationType.FinishToStart, source.uid!))
					.catch((error: unknown) => new DialogRelationFailed({
						message: error instanceof Error ? error.message : t('This relationship is not possible'),
					}).confirm().catch(() => void 0))
			}
			return
		}

		if (drag.kind === 'create') {
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

		if (drag.moved) {
			const built = this.buildAt(drag.point)
			const entry = drag.entry!
			if (drag.kind === 'move' && e.altKey && getCapabilities(entry.sourceId).createEntries) {
				this.teardown(e.pointerId)
				EntryStore.setPreview(undefined)
				EntryStore.setDragging(undefined)
				if (built) {
					EntryStore.duplicate(entry, built).catch(() => void 0)
				}
				return
			}
			const bypass = e.ctrlKey || e.metaKey
			const delta = built?.start && entry.start ? built.start.valueOf() - entry.start.valueOf() : 0
			const isMove = drag.kind === 'move'
			this.teardown(e.pointerId)
			EntryStore.setPreview(undefined)
			EntryStore.setDragging(undefined)
			if (built) {
				entry.adoptSpan(built)
				EntryStore.notify()
			}
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

	private readonly onPointerCancel = (e: PointerEvent) => {
		const drag = this.drag
		if (!drag || e.pointerId !== drag.pointerId) {
			return
		}
		if (drag.armed) {
			this.teardown(e.pointerId)
			return
		}
		this.teardown(e.pointerId)
		switch (drag.kind) {
			case 'relate':
				this.clearDraft(drag.drawing!)
				break
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
