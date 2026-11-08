import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { haptic } from '#design'
import { Calendars } from '#features/sources/client/Calendars.js'
import { type EntryConnections } from '#features/relations/client/EntryConnections.js'
import type { AvailabilitySegment } from '#features/availability/client/AvailabilitySegment.js'
import { type Entry } from '../../Entry.js'
import { EntryType } from '../../EntryType.js'
import { EntryStore } from '../EntryStore.js'
import { type EntrySegment } from '../EntrySegment.js'
import type { EntrySegmentComponent } from '../EventSegment.js'
import { DayCells } from '../DayCells.js'
import { DragGesture, type DragMode, type DragPoint, type DragStart } from './DragGesture.js'
import { CreateGesture } from './CreateGesture.js'
import { MoveGesture } from './MoveGesture.js'
import { ResizeGesture } from './ResizeGesture.js'
import { RelateGesture } from './RelateGesture.js'

const TOUCH_HOLD_MS = 500
const TOUCH_HOLD_TOLERANCE = 10
const TOUCH_HOLD_FEEDBACK_MS = 15

/**
 * Listens for gestures on a calendar grid and hands each to the {@link DragGesture} it begins (create, move, resize,
 * relate): the pointer, a touch's hold, one frame at a time, the drop and a cancel.
 */
export class EntryGestureController extends Controller {
	private static readonly grids = new Set<EntryGestureController>()

	/**
	 * Hand off an external drag gesture (e.g. from the unscheduled drawer) to the active calendar grid.
	 */
	static beginExternal(entry: Entry, segment: EntrySegmentComponent, surface: HTMLElement, e: PointerEvent, options?: { held?: boolean }) {
		const controller = [...this.grids].filter(controller => controller.element.isConnected).at(-1)
		controller?.beginExternal(entry, segment, surface, e, options)
	}

	/** Where a chip listed outside the grid is held: by its own start, so the drop lands it on the pointer. */
	private static grabOf(entry: Entry): DragPoint | undefined {
		return !entry.start ? undefined : { date: entry.start.dayStart, minute: Math.round((entry.start.valueOf() - entry.start.dayStart.valueOf()) / 60_000) }
	}

	private static boxOf(selector: string) {
		const element = document.querySelector(selector)
		const box = element && EntryGestureController.visibleBox(element)
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
	private gesture?: DragGesture

	constructor(host: Component, private readonly grid: 'week' | 'month' | 'year' | 'timeline' = 'week') {
		super(host)
		this.element = host
	}

	override hostConnected() {
		EntryGestureController.grids.add(this)
		this.element.addEventListener('pointerdown', this.onPointerDown)
	}

	override hostDisconnected() {
		EntryGestureController.grids.delete(this)
		this.element.removeEventListener('pointerdown', this.onPointerDown)
	}

	private beginExternal(entry: Entry, segment: EntrySegmentComponent, surface: HTMLElement, e: PointerEvent, options?: { held?: boolean }) {
		if (this.gesture || !entry.persisted || !entry.editable) {
			return
		}
		const cells = this.snapshotCells()
		if (cells.isEmpty) {
			return // nothing on screen to place it on
		}
		const start = this.startAt(e, cells, surface)
		// A gesture handed off mid-drag (the list's reorder leaving the list) has served its touch hold.
		this.begin(new MoveGesture(options?.held ? { ...start, armed: false } : start, this.editMode(entry), entry, EntryGestureController.grabOf(entry), segment))
	}

	/** Snapshotted at pointer-down, so every frame stays free of DOM reads: the two boxes outside the day cells a frame may land in, plus what the drag captures and listens on. */
	private startAt(e: PointerEvent, cells: DayCells, surface: HTMLElement): DragStart {
		return {
			pointerId: e.pointerId,
			surface,
			origin: { x: e.clientX, y: e.clientY },
			cells,
			laneBottom: this.element.querySelector('.all-day')?.getBoundingClientRect().bottom,
			unscheduledBox: EntryGestureController.boxOf('mitra-planning .unscheduled'),
			gridBox: EntryGestureController.visibleBox(this.element),
			sidebarBox: EntryGestureController.boxOf('mitra-sidebar nav'),
			armed: e.pointerType === 'touch' || e.pointerType === 'pen',
		}
	}

	private createModeAt(target: HTMLElement): DragMode | undefined {
		if (this.grid === 'timeline') {
			return target.closest('.create') ? 'allday' : undefined
		}
		if (this.grid !== 'week') {
			return target.closest('mitra-day') ? 'allday' : undefined
		}
		return target.closest('.all-day') ? 'allday' : target.closest('.entries') ? 'timed' : undefined
	}

	private get createType() {
		return this.grid === 'timeline' ? EntryType.Task : undefined
	}

	private editMode(entry: Entry): DragMode {
		return this.grid !== 'week' || entry.allDay ? 'allday' : 'timed'
	}

	private snapshotCells() {
		const cells = this.element.querySelectorAll<HTMLElement>(this.grid === 'timeline' ? '.backdrop .day' : 'mitra-day')
		return new DayCells([...cells].map(element => {
			const rect = element.getBoundingClientRect()
			const grid = this.grid === 'timeline' ? rect : element.querySelector<HTMLElement>('.entries')?.getBoundingClientRect() ?? rect
			return { date: new DateTime(element.dataset.date!), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, gridTop: grid.top, gridHeight: grid.height }
		}))
	}

	private begin(gesture: DragGesture) {
		this.gesture = gesture
		gesture.surface.addEventListener('pointermove', this.onPointerMove)
		gesture.surface.addEventListener('pointerup', this.onPointerUp)
		gesture.surface.addEventListener('pointercancel', this.onPointerCancel)
		gesture.surface.addEventListener('touchmove', this.onTouchMove, { passive: false })
		if (gesture.watchesWindow) {
			window.addEventListener('keydown', this.onKeyDown)
			window.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
		}
		if (gesture.armed) {
			gesture.holdTimer = setTimeout(() => this.activate(true), TOUCH_HOLD_MS)
		} else {
			this.activate(false)
		}
	}

	private activate(fromHold: boolean) {
		const gesture = this.gesture!
		gesture.armed = false
		if (gesture.holdTimer !== undefined) {
			clearTimeout(gesture.holdTimer)
			gesture.holdTimer = undefined
		}
		gesture.surface.setPointerCapture(gesture.pointerId)
		if (fromHold) {
			haptic(TOUCH_HOLD_FEEDBACK_MS)
			gesture.held()
		}
	}

	private teardown() {
		const gesture = this.gesture
		const surface = gesture?.surface ?? this.element
		if (gesture && surface.hasPointerCapture(gesture.pointerId)) {
			surface.releasePointerCapture(gesture.pointerId)
		}
		surface.removeEventListener('pointermove', this.onPointerMove)
		surface.removeEventListener('pointerup', this.onPointerUp)
		surface.removeEventListener('pointercancel', this.onPointerCancel)
		surface.removeEventListener('touchmove', this.onTouchMove)
		window.removeEventListener('keydown', this.onKeyDown)
		window.removeEventListener('scroll', this.onScroll, { capture: true })
		if (gesture?.holdTimer !== undefined) {
			clearTimeout(gesture.holdTimer)
		}
		if (gesture?.frame !== undefined) {
			cancelAnimationFrame(gesture.frame)
		}
		this.gesture = undefined
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) {
			return
		}
		// A second pointer while a gesture is in flight means multi-touch (a pinch-zoom), so abandon the
		// single-pointer drag so it neither fights the zoom nor leaves a stray draft behind.
		if (this.gesture && e.pointerId !== this.gesture.pointerId) {
			this.onPointerCancel(new PointerEvent('pointercancel', { pointerId: this.gesture.pointerId }))
			return
		}
		const target = e.target as HTMLElement
		if (target.closest('mitra-entry-details') || target.closest('mitra-entry-status')) {
			// Interactions inside the editor popover, or on a task's status checkbox/menu, are never grid
			// gestures. Otherwise a tap on the checkbox would also register as a tap-to-open on the segment.
			return
		}
		const cells = this.snapshotCells()
		// Snapshotted up front, like the cells, so every frame stays free of DOM reads (see startAt).
		const start = this.startAt(e, cells, this.element)

		// Connecting handle hit-test takes precedence over entry chip gestures.
		const grip = target.closest('.connect') as (HTMLElement & { segment?: EntrySegment }) | null
		if (grip) {
			const from = grip.segment
			const gripLayer = grip.closest('mitra-entry-connections') as EntryConnections | null
			if (!from || !gripLayer || e.pointerType === 'touch' || !from.entry.relatable) {
				return
			}
			const layers = [...this.element.querySelectorAll<EntryConnections>('mitra-entry-connections')]
			this.begin(new RelateGesture({ ...start, armed: false }, this.editMode(from.entry), { from, source: gripLayer, layers, host: layers.find(layer => layer.draftHost) }))
			return
		}

		// Move / resize an existing entry, persisted ones only (a draft is owned by the create flow + editor).
		// An occurrence of a recurring entry drags as an override of its date: the drop's commit resolves the edit's scope.
		const segment = target.closest('mitra-entry-segment') as EntrySegmentComponent | null
		const occurrence = segment?.segment?.occurrence
		if (segment) {
			// A tap still has to open the editor of an entry whose provider mitra may only read, so the
			// bar is on beginning a drag, not on handling the pointer at all.
			if (!occurrence?.entry.persisted || !occurrence.entry.editable) {
				return
			}
			const entry = EntryStore.editable(occurrence)
			const mode = this.editMode(entry)
			const anchor = DragGesture.pointIn(cells, e.clientX, e.clientY, mode)
			if (!anchor) {
				return
			}
			const edge = target.closest('.resize-start') ? 'start' : target.closest('.resize-end') ? 'end' : undefined
			this.begin(edge ? new ResizeGesture(start, mode, entry, edge) : new MoveGesture(start, mode, entry, anchor, segment))
			return
		}

		// Create on empty grid / lane / cell. A drag over availability still creates; a tap opens the availability.
		const availability = target.closest('mitra-availability-segment') as AvailabilitySegment | null
		const mode = this.createModeAt(target)
		const source = mode ? Calendars.getPrimary(this.createType) : undefined
		if (!mode || !source) {
			// Nothing can be created here, so open the availability right away.
			if (availability) {
				availability.open = true
			}
			return
		}
		const anchor = DragGesture.pointIn(cells, e.clientX, e.clientY, mode)
		if (!anchor) {
			return
		}
		this.begin(new CreateGesture(start, mode, anchor, source, this.createType, availability ?? undefined))
	}

	private readonly onPointerMove = (e: PointerEvent) => {
		const gesture = this.gesture
		if (!gesture || e.pointerId !== gesture.pointerId) {
			return
		}
		if (gesture.armed) {
			if (Math.hypot(e.clientX - gesture.origin.x, e.clientY - gesture.origin.y) > TOUCH_HOLD_TOLERANCE) {
				this.teardown()
			}
			return
		}
		gesture.point = { x: e.clientX, y: e.clientY }
		gesture.frame ??= requestAnimationFrame(this.processFrame)
	}

	private readonly onTouchMove = (e: TouchEvent) => {
		if (this.gesture && !this.gesture.armed) {
			e.preventDefault()
		}
	}

	private readonly processFrame = () => {
		const gesture = this.gesture
		if (!gesture) {
			return
		}
		gesture.frame = undefined
		if (!gesture.moved) {
			if (Math.hypot(gesture.point.x - gesture.origin.x, gesture.point.y - gesture.origin.y) <= 4) {
				return
			}
			gesture.moved = true
			gesture.started()
		}
		gesture.step()
	}

	private readonly onScroll = () => {
		const gesture = this.gesture
		if (gesture?.scrolled()) {
			gesture.frame ??= requestAnimationFrame(this.processFrame)
		}
	}

	private readonly onKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && this.gesture?.escape()) {
			e.preventDefault()
		}
	}

	private readonly onPointerUp = (e: PointerEvent) => {
		const gesture = this.gesture
		if (!gesture || e.pointerId !== gesture.pointerId) {
			return
		}
		this.teardown()
		gesture.drop(e)
	}

	private readonly onPointerCancel = (e: PointerEvent) => {
		const gesture = this.gesture
		if (!gesture || e.pointerId !== gesture.pointerId) {
			return
		}
		this.teardown()
		if (!gesture.armed) {
			gesture.cancel()
		}
	}
}
