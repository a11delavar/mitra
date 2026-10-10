import { Component, component, html, css, unsafeCSS, property, state, repeat } from '@a11d/lit'
import { RelationGraph } from '../RelationGraph.js'
import { type Entry } from '../../entries/Entry.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { type EntrySegmentComponent } from '../../entries/client/EventSegment.js'
import { getSource } from '../../../infrastructure/http/Api.js'
import { EntryStore } from '../../entries/client/EntryStore.js'

/** Grid placement in view-specific units (deltas and order only). */
export interface SegmentPlacement {
	/** First column in logical reading order. */
	readonly start: number
	/** Last column in logical reading order. */
	readonly end: number
	/** Vertical order (lane index, month row*100 + slot, or minute midpoint). */
	readonly rank: number
	/** Scroll/paint frame: 'lane' marks chips in the sticky all-day strip for cross-realm routing. */
	readonly frame?: 'lane'
}

/** In-flight dependency draft being drawn by hand. */
export interface ConnectionDraft {
	readonly from: EntrySegment
	readonly to: EntrySegment | ConnectionAim
	readonly violated: boolean
}

/** Where an unsnapped connector draft points relative to its origin port. */
export interface ConnectionAim {
	/** Far enough ahead for a single S-curve; otherwise the draft bends twice. */
	readonly forward: boolean
	readonly down: boolean
}

/** A route endpoint as an inset expression in each physical frame ('left'/'right', 'top'/'bottom'). */
interface Port {
	x(side: string): string
	y(side: string): string
}

interface ConnectorEdge {
	readonly key: string
	readonly kind: 'dependency' | 'subtask'
	readonly fromEntryId: string
	readonly toEntryId: string
	readonly pieces: ReadonlyArray<ConnectorPiece>
	readonly violated: boolean
	/** Spans sticky all-day lane and timed grid (animates lane-shift correction). */
	readonly cross?: boolean
	readonly fromColor?: string
	readonly toColor?: string
}

interface ConnectorPiece {
	readonly style: string
	readonly path?: string
	readonly ink?: string
	readonly head?: 'head-end-down' | 'head-end-up' | 'head-end-flat' | 'head-down' | 'head-up' | 'head-drop-end' | 'head-rise-end'
	/** In-lane duplicate piece painting at z 91 above the sticky lane's background. */
	readonly inLane?: boolean
	/** Toggles the mirror class relative to direction for heads entering the target's end port. */
	readonly flip?: boolean
	readonly gradient?: string
	readonly fade?: readonly [number, number]
	/** Drawn as a bend (see {@link EntryConnections.bend}): which side of the source its target lies on. */
	readonly bend?: 'ahead' | 'behind'
}

/** Normalized ink strokes stretched across mask data-URIs. Masked curves antialias inherently;
 * straight runs use painted geometry to ensure crisp 1px strokes (see AGENTS.md). */
const PATHS: Record<string, string> = {
	// Side-port to side-port horizontal-tangent S-curves.
	'dependency:s-down': 'M 0 0 C 50 0 50 100 100 100',
	'dependency:s-up': 'M 0 100 C 50 100 50 0 100 0',
	// Vertical-tangent twins for tall, adjacent-column boxes between block ports.
	'dependency:s-tall-down': 'M 0 0 C 0 50 100 50 100 100',
	'dependency:s-tall-up': 'M 0 100 C 0 50 100 50 100 0',
}

const GRADIENT_DIRECTIONS: Record<string, string> = {
	'dependency:s-down': 'to bottom right',
	'dependency:s-up': 'to top right',
	'dependency:s-tall-down': 'to bottom right',
	'dependency:s-tall-up': 'to top right',
}

/** Rank delta threshold (~2h apart) above which adjacent columns use vertical S-curves. */
const TALL_RANK_DELTA = 240

/** Least free time between two timed chips for a vertical S-curve: closer, its box inverts and erases it. */
const TALL_GAP_MINUTES = 30

/** Horizontal clearance past a port before turning. */
const STUB_REM = 0.875
const STUB = `${STUB_REM}rem`

const HANDLE_REACH = '0.75rem'

/** Loop clearance around chips. */
const LANE = '0.5rem'

/** Turn radius for elbow joints. */
const CORNER = '0.5rem'

/** Turn radius for bends. */
const BEND_RADIUS = '0.75rem'

/** Integer pixel width to prevent subpixel rasterization snapping discrepancies. */
const STROKE_WIDTH = 1

/** Optical weight multiplier for antialiased mask curves. */
const CURVE_STROKE = 1.1

/** Gap reserved before port for the arrowhead. */
const HEAD_GAP = 'calc(var(--mitra-connection-head) - 1px)'

const LANE_ANCHOR = '--mitra-all-day-lane'

/** Lane stuck displacement mapped from scroll-driven animation. */
const SHIFT = 'var(--_lane-shift)'

function maskFor(path: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${PATHS[path] ?? ''}" fill="none" stroke="white" stroke-width="${CURVE_STROKE}" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`
	return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`
}

/**
 * Calendar relationship connector layer placed by CSS anchor positioning (see AGENTS.md).
 */
@component('mitra-entry-connections')
export class EntryConnections extends Component {
	static isEnabledFor(view: 'week' | 'month' | 'timeline') {
		return localStorage.getItem(`Mitra.Connections.${view}`) !== 'false'
	}

	/** `undefined` FORGETS the choice rather than writing the current default: an explicit `true` would
	 * pin the lines on for good, and the day this default changes it would have to change for the people
	 * who never chose (see Setting.set: only deviations are stored). */
	static setEnabledFor(view: 'week' | 'month' | 'timeline', enabled: boolean | undefined) {
		const key = `Mitra.Connections.${view}`
		if (enabled === undefined) {
			localStorage.removeItem(key)
		} else {
			localStorage.setItem(key, String(enabled))
		}
		EntryStore.notify()
	}

	/** True if the platform supports scroll-driven animation timelines for cross-realm shifts. */
	private static readonly canShift = typeof CSS !== 'undefined' && CSS.supports('animation-timeline', '--probe')

	// Re-renders on store notifications, so a relation edit redraws immediately.
	readonly store = new EntryStore(this)

	/** The chips rendered inside this layer's canvas: the anchor-bearing source of truth for which
	 * entries participate and which slices carry the ports. */
	@property({ type: Array }) segments: ReadonlyArray<EntrySegment> = []

	/** Per-segment grid placement (see {@link SegmentPlacement}); a missing entry reads as the week's
	 * timed grid: day columns, minute rank, the canvas frame. */
	@property({ type: Object }) placement?: ReadonlyMap<EntrySegment, SegmentPlacement>

	/** Whether this layer hosts unsnapped freeform curve rendering. */
	@property({ type: Boolean, attribute: 'draft-host' }) draftHost = false

	@property({ type: Object }) draft?: ConnectionDraft

	@state() private hovered?: EntrySegment

	private get hoveredEntryId() { return this.hovered?.entry.id }

	protected override createRenderRoot() { return this }

	private readonly handlePointerOver = (e: Event) => {
		const target = e.target as Element | null
		// Ignore pointer movements over connection layer elements.
		if (target?.closest?.('mitra-entry-connections')) {
			return
		}
		const chip = target?.closest?.('mitra-entry-segment') as EntrySegmentComponent | null
		const segment = chip?.segment
		if (segment !== this.hovered) {
			this.hovered = segment
		}
	}

	override connected() {
		// The layer itself is pointer-events: none. Hover intent is read off the surrounding view;
		// the scroller is the natural delegate (covers every canvas within it).
		this.scrollHost = (this.parentElement?.closest('mitra-days, mitra-weeks, mitra-timeline') ?? this.parentElement) as HTMLElement | null
		this.scrollHost?.addEventListener('pointerover', this.handlePointerOver)
	}

	private scrollHost?: HTMLElement | null

	override disconnected() {
		this.scrollHost?.removeEventListener('pointerover', this.handlePointerOver)
	}

	private placementOf(segment: EntrySegment): SegmentPlacement {
		return this.placement?.get(segment) ?? {
			start: Math.round(segment.dayValue! / 86_400_000),
			end: Math.round((segment.runEnd.dayValue ?? segment.dayValue!) / 86_400_000),
			rank: segment.startMinute + segment.endMinute,
		}
	}

	private get connectorEdges(): Array<ConnectorEdge> {
		const segments = this.segments.filter(segment =>
			segment.entry.persisted && !!segment.entry.uid && segment.dayValue !== undefined && !EntryStore.isPreview(segment.entry))
		const byEntry = new Map<Entry, Array<EntrySegment>>()
		const byUid = new Map<string, Array<Entry>>()
		for (const segment of segments) {
			const slices = byEntry.get(segment.entry) ?? []
			slices.push(segment)
			byEntry.set(segment.entry, slices)
			if (slices.length === 1) {
				const list = byUid.get(segment.entry.uid!) ?? []
				list.push(segment.entry)
				byUid.set(segment.entry.uid!, list)
			}
		}
		for (const slices of byEntry.values()) {
			slices.sort((a, b) => a.dayValue! - b.dayValue!)
		}

		const edges = new Array<ConnectorEdge>()
		for (const edge of RelationGraph.of([...byEntry.keys()]).edges) {
			const pair = edge.bestPair(byUid.get(edge.from) ?? [], byUid.get(edge.to) ?? [])
			if (!pair) {
				continue
			}
			const { from, to } = pair
			const kind: ConnectorEdge['kind'] = edge.family === 'dependency' ? 'dependency' : 'subtask'
			const fromSeg = byEntry.get(from)?.at(-1)
			const toSeg = byEntry.get(to)?.[0]
			if (!fromSeg || !toSeg || fromSeg === toSeg) {
				continue
			}
			const laneEnds = Number(this.placementOf(fromSeg).frame === 'lane') + Number(this.placementOf(toSeg).frame === 'lane')
			if (laneEnds === 2 || (laneEnds === 1 && !EntryConnections.canShift)) {
				continue
			}
			edges.push(this.edge(kind, from, to, fromSeg, toSeg, edge.violatedBy(from, to)))
		}
		return edges
	}

	/** Routes one edge into anchor-positioned piece boxes based on grid placement. */
	private edge(kind: ConnectorEdge['kind'], from: Entry, to: Entry, fromSeg: EntrySegment, toSeg: EntrySegment, violated: boolean): ConnectorEdge {
		const A = `--mitra-entry-segment-${fromSeg.id}`
		const B = `--mitra-entry-segment-${toSeg.id}`
		const rtl = this.matches(':dir(rtl)')
		const [start, end] = rtl ? ['right', 'left'] : ['left', 'right']
		const a = this.placementOf(fromSeg)
		const b = this.placementOf(toSeg)
		const columnDelta = b.start - a.start
		const down = b.rank >= a.rank
		const cross = (a.frame === 'lane') !== (b.frame === 'lane')
		const overlapping = columnDelta > 0
			? b.start <= a.end
			: columnDelta < 0 ? b.end >= a.start : true

		let pieces: Array<ConnectorPiece>
		if (cross) {
			pieces = kind === 'dependency'
				? this.crossDependency(A, B, a, b, start, end, rtl)
				: this.crossSubtask(A, B, a, b, start, end)
		} else if (kind === 'dependency') {
			const w = STROKE_WIDTH
			const flat = b.rank === a.rank
			if (columnDelta > 0 && !overlapping) {
				const ports = [EntryConnections.anchorPort(A, end), EntryConnections.anchorPort(B, start)] as const
				if (flat) {
					pieces = [{
						style: `top: calc(anchor(${A} 50%) - ${w / 2}px); block-size: ${w}px; ${start}: anchor(${A} ${end}); ${end}: calc(anchor(${B} ${start}) + ${HEAD_GAP});`,
						ink: `padding-block-start: ${w}px;`,
						head: 'head-end-flat',
						gradient: rtl ? 'to left' : 'to right',
					}]
				} else if (columnDelta === 1 && Math.abs(b.rank - a.rank) >= TALL_RANK_DELTA && this.stacked(fromSeg, toSeg, down)) {
					const path = down ? 'dependency:s-tall-down' : 'dependency:s-tall-up'
					pieces = [{
						path,
						style: `${down
							? `top: anchor(${A} bottom); bottom: calc(anchor(${B} top) + ${HEAD_GAP});`
							: `top: calc(anchor(${B} bottom) + ${HEAD_GAP}); bottom: anchor(${A} top);`} ${start}: anchor(${A} 50%); ${end}: anchor(${B} 50%);`,
						head: down ? 'head-drop-end' : 'head-rise-end',
						gradient: GRADIENT_DIRECTIONS[path],
					}]
				} else if (columnDelta === 1) {
					// Neighbouring days leave only the day gutter between the ports, narrower than the arrowhead.
					pieces = EntryConnections.bend(...ports, down, start, end, rtl)
				} else {
					pieces = EntryConnections.sCurve(...ports, down, start, end)
				}
			} else if (columnDelta === 0 && !flat && down) {
				pieces = [{
					style: `top: anchor(${A} bottom); bottom: calc(anchor(${B} top) + ${HEAD_GAP}); ${start}: calc(anchor(${A} 50%) - ${w / 2}px); inline-size: ${w}px;`,
					ink: `padding-inline-start: ${w}px;`,
					head: 'head-down',
					gradient: 'to bottom',
				}]
			} else {
				pieces = down ? EntryConnections.loopBelow(A, B, start, end, rtl) : EntryConnections.loopAbove(A, B, start, end, rtl)
			}
		} else {
			const w = STROKE_WIDTH
			const drop = `calc(anchor(${A} ${start}) + 0.5rem)`
			// The plain vertical drop hangs off the PARENT's leading edge, so it only reaches the child
			// when the child's own columns contain that edge. Merely overlapping spans is not enough: a
			// child starting inside its parent's run left the drop ending in empty space, a hairline stub
			// connecting nothing (visible in the month view too, where the rows are close enough to read
			// it as a speck).
			const dropsOnChild = b.start <= a.start && b.end >= a.start
			if (dropsOnChild) {
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} top);`
					: `top: anchor(${B} bottom); bottom: anchor(${A} top);`
				pieces = [{
					style: `${vertical} ${start}: calc(${drop} - ${w / 2}px); inline-size: ${w}px;`,
					ink: `padding-inline-start: ${w}px;`,
				}]
			} else {
				const later = columnDelta > 0
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} 50%);`
					: `top: anchor(${B} 50%); bottom: anchor(${A} top);`
				const inline = later
					? `${start}: calc(${drop} - ${w / 2}px); ${end}: calc(anchor(${B} ${start}) + 2px);`
					: `${end}: calc(anchor(${A} ${start}) - 0.5rem - ${w / 2}px); ${start}: calc(anchor(${B} ${end}) + 2px);`
				pieces = [{
					style: `${vertical} ${inline}`,
					ink: `padding-inline-${later ? 'start' : 'end'}: ${w}px; padding-block-${down ? 'end' : 'start'}: ${w}px;`,
				}]
			}
		}
		return {
			key: `${kind}:${fromSeg.id}:${toSeg.id}`, kind, fromEntryId: from.id!, toEntryId: to.id!, pieces, violated, cross,
			...(kind !== 'dependency' ? {} : { fromColor: EntryConnections.colorOf(from), toColor: EntryConnections.colorOf(to) }),
		}
	}

	/** Whether the target sits clear below (or above) the source, leaving a vertical S-curve room between them.
	 * Only the timed grid can overlap in time; other views' ranks are rows. */
	private stacked(from: EntrySegment, to: EntrySegment, down: boolean) {
		if (this.placement?.has(from) || this.placement?.has(to)) {
			return true
		}
		const gap = down ? to.startMinute - from.endMinute : from.startMinute - to.endMinute
		return gap >= TALL_GAP_MINUTES
	}

	private static anchorPort(name: string, side: string): Port {
		return { x: () => `anchor(${name} ${side})`, y: () => `anchor(${name} 50%)` }
	}

	private static readonly pointerPort: Port = {
		x: side => side === 'left' ? 'var(--_pointer-x)' : 'calc(100% - var(--_pointer-x))',
		y: side => side === 'top' ? 'var(--_pointer-y)' : 'calc(100% - var(--_pointer-y))',
	}

	/** One S-curve from an end port to a start port at least a stub or two ahead of it. */
	private static sCurve(a: Port, b: Port, down: boolean, start: string, end: string): Array<ConnectorPiece> {
		const path = down ? 'dependency:s-down' : 'dependency:s-up'
		const [near, far] = down ? ['top', 'bottom'] : ['bottom', 'top']
		return [{
			path,
			style: `${near}: ${a.y(near)}; ${far}: ${b.y(far)}; ${start}: ${a.x(start)}; ${end}: calc(${b.x(end)} + ${HEAD_GAP});`,
			head: down ? 'head-end-down' : 'head-end-up',
			gradient: GRADIENT_DIRECTIONS[path],
		}]
	}

	/**
	 * Leaves the source and enters the target along arcs of one radius joined by their shared tangent, so
	 * every turn reads alike at any distance, even with the target behind the source. Drawn once per side:
	 * the box of the wrong one inverts to nothing. The geometry is the stylesheet's (`.bend`).
	 */
	private static bend(a: Port, b: Port, down: boolean, start: string, end: string, rtl: boolean): Array<ConnectorPiece> {
		const [near, far] = down ? ['top', 'bottom'] : ['bottom', 'top']
		const block = `${near}: ${a.y(near)}; ${far}: ${b.y(far)}; scale: ${rtl ? -1 : 1} ${down ? 1 : -1};`
		return [
			{ bend: 'ahead', head: 'head-end-down', style: `${block} ${start}: ${a.x(start)}; ${end}: calc(${b.x(end)} + ${HEAD_GAP});` },
			{ bend: 'behind', head: 'head-end-down', style: `${block} ${start}: calc(${b.x(start)} - ${HEAD_GAP}); ${end}: ${a.x(end)};` },
		]
	}

	private static loopBelow(A: string, B: string, start: string, end: string, rtl: boolean): Array<ConnectorPiece> {
		const w = STROKE_WIDTH
		const seam = `anchor(${B} 50%)`
		return [
			{
				style: `top: anchor(${A} 50%); bottom: calc(${seam} - ${CORNER}); ${start}: anchor(${A} ${end}); inline-size: ${STUB};`,
				ink: `padding-block-start: ${w}px; padding-inline-end: ${w}px; border-start-end-radius: ${CORNER};`,
				gradient: rtl ? 'to bottom left' : 'to bottom right',
				fade: [0, 25],
			},
			{
				style: `top: calc(${seam} + ${CORNER}); bottom: calc(min(anchor(${A} bottom), anchor(${B} bottom)) - ${LANE}); ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${A} ${end}) - ${STUB});`,
				ink: `padding-inline-start: ${w}px; padding-inline-end: ${w}px; padding-block-end: ${w}px; border-end-start-radius: ${CORNER}; border-end-end-radius: ${CORNER};`,
				gradient: rtl ? 'to right' : 'to left',
				fade: [25, 75],
			},
			{
				style: `top: ${seam}; block-size: ${CORNER}; ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${B} ${start}) + ${HEAD_GAP});`,
				ink: `padding-block-start: ${w}px; padding-inline-start: ${w}px; border-start-start-radius: ${CORNER};`,
				head: 'head-end-up',
				gradient: rtl ? 'to top left' : 'to top right',
				fade: [75, 100],
			},
		]
	}

	private static loopAbove(A: string, B: string, start: string, end: string, rtl: boolean): Array<ConnectorPiece> {
		const w = STROKE_WIDTH
		const seam = `anchor(${B} 50%)`
		return [
			{
				style: `bottom: anchor(${A} 50%); top: calc(${seam} - ${CORNER}); ${start}: anchor(${A} ${end}); inline-size: ${STUB};`,
				ink: `padding-block-end: ${w}px; padding-inline-end: ${w}px; border-end-end-radius: ${CORNER};`,
				gradient: rtl ? 'to top left' : 'to top right',
				fade: [0, 25],
			},
			{
				style: `top: calc(min(anchor(${A} top), anchor(${B} top)) - ${LANE}); bottom: calc(${seam} + ${CORNER}); ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${A} ${end}) - ${STUB});`,
				ink: `padding-inline-start: ${w}px; padding-inline-end: ${w}px; padding-block-start: ${w}px; border-start-start-radius: ${CORNER}; border-start-end-radius: ${CORNER};`,
				gradient: rtl ? 'to right' : 'to left',
				fade: [25, 75],
			},
			{
				style: `bottom: ${seam}; block-size: ${CORNER}; ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${B} ${start}) + ${HEAD_GAP});`,
				ink: `padding-block-end: ${w}px; padding-inline-start: ${w}px; border-end-start-radius: ${CORNER};`,
				head: 'head-end-down',
				gradient: rtl ? 'to bottom left' : 'to bottom right',
				fade: [75, 100],
			},
		]
	}

	/** Cross-realm dependency between sticky all-day lane and timed grid (see AGENTS.md). */
	private crossDependency(A: string, B: string, a: SegmentPlacement, b: SegmentPlacement, start: string, end: string, rtl: boolean): Array<ConnectorPiece> {
		const w = STROKE_WIDTH
		const downward = a.frame === 'lane'
		const [L, T] = downward ? [A, B] : [B, A]
		const [l, t] = downward ? [a, b] : [b, a]
		const laneBottom = `calc(anchor(${LANE_ANCHOR} bottom) - ${SHIFT})`
		const strip = `padding-inline-start: ${w}px;`
		const barBottom = `calc(anchor(${L} bottom) + ${SHIFT}${downward ? '' : ` + ${HEAD_GAP}`})`

		if (t.start >= l.start && t.start <= l.end) {
			const x = `${start}: calc(anchor(${T} 50%) - ${w / 2}px); inline-size: ${w}px;`
			return [
				downward
					? { style: `top: ${barBottom}; bottom: ${laneBottom}; ${x}`, ink: strip, inLane: true, gradient: 'to bottom', fade: [0, 0] }
					: { style: `top: ${barBottom}; bottom: ${laneBottom}; ${x}`, ink: strip, inLane: true, head: 'head-up', gradient: 'to top', fade: [100, 100] },
				downward
					? { style: `top: ${barBottom}; bottom: calc(anchor(${T} top) + ${HEAD_GAP}); ${x}`, ink: strip, head: 'head-down', gradient: 'to bottom' }
					: { style: `top: ${barBottom}; bottom: anchor(${T} top); ${x}`, ink: strip, gradient: 'to top' },
			]
		}

		const chipAfter = t.start > l.end
		const legX = chipAfter
			? `${start}: calc(anchor(${L} ${end}) - ${STUB}); inline-size: ${w}px;`
			: `${end}: calc(anchor(${L} ${start}) - ${STUB}); inline-size: ${w}px;`
		const port = (edge: string) => downward ? `calc(${edge} + ${HEAD_GAP})` : edge
		const turn = chipAfter
			? `${start}: calc(anchor(${L} ${end}) - ${STUB}); ${end}: ${port(`anchor(${T} ${start})`)};`
			: `${end}: calc(anchor(${L} ${start}) - ${STUB}); ${start}: ${port(`anchor(${T} ${end})`)};`
		return [
			{
				style: `top: ${barBottom}; bottom: ${laneBottom}; ${legX}`,
				ink: strip, inLane: true,
				...(downward ? { gradient: 'to bottom', fade: [0, 0] as const } : { head: 'head-up' as const, gradient: 'to top', fade: [100, 100] as const }),
			},
			{
				style: `top: ${barBottom}; bottom: calc(anchor(${T} 50%) + ${CORNER}); ${legX}`,
				ink: strip,
				gradient: downward ? 'to bottom' : 'to top', fade: downward ? [0, 60] : [40, 100],
			},
			{
				style: `top: calc(anchor(${T} 50%) - ${CORNER}); block-size: ${CORNER}; ${turn}`,
				ink: `padding-inline-${chipAfter ? 'start' : 'end'}: ${w}px; padding-block-end: ${w}px; border-end-${chipAfter ? 'start' : 'end'}-radius: ${CORNER};`,
				...(downward ? { head: 'head-end-down' as const, flip: !chipAfter } : {}),
				gradient: (chipAfter === downward) !== rtl ? 'to right' : 'to left', fade: downward ? [60, 100] : [0, 40],
			},
		]
	}

	/** Cross-realm subtask elbow between sticky all-day lane and timed grid. */
	private crossSubtask(A: string, B: string, a: SegmentPlacement, b: SegmentPlacement, start: string, end: string): Array<ConnectorPiece> {
		const w = STROKE_WIDTH
		const downward = a.frame === 'lane'
		const [L, T] = downward ? [A, B] : [B, A]
		const [l, t] = downward ? [a, b] : [b, a]
		const laneBottom = `calc(anchor(${LANE_ANCHOR} bottom) - ${SHIFT})`
		const barBottom = `calc(anchor(${L} bottom) + ${SHIFT})`
		const strip = `padding-inline-start: ${w}px;`

		if (t.start >= l.start && t.start <= l.end) {
			const x = `${start}: calc(anchor(${T} 50%) - ${w / 2}px); inline-size: ${w}px;`
			return [
				{ style: `top: ${barBottom}; bottom: ${laneBottom}; ${x}`, ink: strip, inLane: true },
				{ style: `top: ${barBottom}; bottom: anchor(${T} top); ${x}`, ink: strip },
			]
		}

		if (downward) {
			const later = t.start > l.start
			const legX = later
				? `${start}: calc(anchor(${L} ${start}) + 0.5rem);`
				: `${end}: calc(anchor(${L} ${start}) - 0.5rem - ${w}px);`
			return [
				{ style: `top: ${barBottom}; bottom: ${laneBottom}; ${legX} inline-size: ${w}px;`, ink: strip, inLane: true },
				{
					style: `top: ${barBottom}; bottom: anchor(${T} 50%); ${legX} ${later
						? `${end}: calc(anchor(${T} ${start}) + 2px);`
						: `${start}: calc(anchor(${T} ${end}) + 2px);`}`,
					ink: `padding-inline-${later ? 'start' : 'end'}: ${w}px; padding-block-end: ${w}px;`,
				},
			]
		}
		const later = l.start > t.end
		const jogTop = `calc(anchor(${LANE_ANCHOR} bottom) + ${SHIFT} + ${LANE})`
		const jogBottom = `calc(anchor(${LANE_ANCHOR} bottom) - ${SHIFT} - ${LANE} - ${w}px)`
		const legX = later
			? `${start}: calc(anchor(${L} ${start}) + 0.5rem); inline-size: ${w}px;`
			: `${start}: calc(anchor(${L} ${end}) - 0.5rem); inline-size: ${w}px;`
		return [
			{
				style: `top: ${jogTop}; bottom: anchor(${T} top); ${later
					? `${start}: calc(anchor(${T} ${start}) + 0.5rem); ${end}: calc(anchor(${L} ${start}) - 0.5rem - ${w}px);`
					: `${end}: calc(anchor(${T} ${start}) - 0.5rem - ${w}px); ${start}: calc(anchor(${L} ${end}) - 0.5rem);`}`,
				ink: `padding-inline-${later ? 'start' : 'end'}: ${w}px; padding-block-start: ${w}px;`,
			},
			{ style: `top: ${barBottom}; bottom: ${jogBottom}; ${legX}`, ink: strip },
			{ style: `top: ${barBottom}; bottom: ${laneBottom}; ${legX}`, ink: strip, inLane: true },
		]
	}

	/** Bounding rect of the active connection handle. */
	get portBox(): DOMRect | undefined {
		return this.querySelector('.connection.handle > .piece')?.getBoundingClientRect()
	}

	/** Bounding rect of the parent container canvas. */
	get originBox(): DOMRect | undefined {
		return this.parentElement?.getBoundingClientRect()
	}

	private slicesOf(entry: Entry): Array<EntrySegment> {
		return this.segments
			.filter(segment => segment.entry === entry && segment.dayValue !== undefined)
			.sort((a, b) => a.dayValue! - b.dayValue!)
	}

	private endSliceOf(entry: Entry): EntrySegment | undefined {
		return this.slicesOf(entry).at(-1)
	}

	private paintsPortsOf(segment: EntrySegment) {
		return this.placementOf(segment).frame !== 'lane'
	}

	private get handleSegment(): EntrySegment | undefined {
		const entry = this.draft?.from.entry ?? this.hovered?.entry
		if (!entry?.relatable || EntryStore.isDragging(entry)) {
			return undefined
		}
		const end = this.endSliceOf(entry)
		return end && this.paintsPortsOf(end) ? end : undefined
	}

	private handleTemplate(rtl: boolean) {
		const segment = this.handleSegment
		if (!segment) {
			return html.nothing
		}
		const A = `--mitra-entry-segment-${segment.id}`
		const [start, end] = rtl ? ['right', 'left'] : ['left', 'right']
		const color = EntryConnections.colorOf(segment.entry)
		return html`
			<div class="connection dependency handle ${this.draft ? 'drawing' : ''}" data-emphasized style="--_from: ${color}; --_to: ${color};">
				<div class="piece dot"
					style="top: calc(anchor(${A} 50%) - ${STROKE_WIDTH / 2}px); block-size: ${STROKE_WIDTH}px; ${start}: anchor(${A} ${end}); inline-size: ${HANDLE_REACH};"
				>
					<div class="ink"></div>
					<div class="connect" title=${t('Drag onto another entry to make it wait for this one')} .segment=${segment}></div>
				</div>
			</div>
		`
	}

	private draftTemplate(rtl: boolean) {
		const draft = this.draft
		const from = draft && this.endSliceOf(draft.from.entry)
		if (!draft || !from) {
			return html.nothing
		}
		if (!('entry' in draft.to)) {
			return this.paintsPortsOf(from) && this.draftHost ? this.freeformTemplate(from, draft.to, draft.violated, rtl) : html.nothing
		}
		const to = this.slicesOf(draft.to.entry)[0]
		if (!to || to === from) {
			return html.nothing
		}
		const laneEnds = Number(this.placementOf(from).frame === 'lane') + Number(this.placementOf(to).frame === 'lane')
		if (laneEnds === 2 || (laneEnds === 1 && !EntryConnections.canShift)) {
			return html.nothing
		}
		return this.edgeTemplate(this.edge('dependency', from.entry, to.entry, from, to, draft.violated), rtl, true, true)
	}

	/** Where a pointer at these viewport coordinates aims a draft from this layer's handle. */
	aimAt(x: number, y: number): ConnectionAim {
		const port = this.portBox
		if (!port) {
			return { forward: true, down: true }
		}
		const rtl = this.matches(':dir(rtl)')
		const ahead = rtl ? port.right - x : x - port.left
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
		const head = parseFloat(getComputedStyle(this).getPropertyValue('--mitra-connection-head'))
		// Two stubs and the arrowhead: any closer and an S-curve kinks, so the draft bends instead.
		return { forward: ahead >= 2 * STUB_REM * rem + head, down: y >= port.top + port.height / 2 }
	}

	/** Renders an unsnapped freeform route from the source segment to the pointer position. */
	private freeformTemplate(from: EntrySegment, aim: ConnectionAim, violated: boolean, rtl: boolean) {
		const [start, end] = rtl ? ['right', 'left'] : ['left', 'right']
		const port = EntryConnections.anchorPort(`--mitra-entry-segment-${from.id}`, end)
		const color = EntryConnections.colorOf(from.entry)
		return this.edgeTemplate({
			key: 'draft', kind: 'dependency', fromEntryId: from.entry.id!, toEntryId: '', violated, fromColor: color, toColor: color,
			pieces: aim.forward
				? EntryConnections.sCurve(port, EntryConnections.pointerPort, aim.down, start, end)
				: EntryConnections.bend(port, EntryConnections.pointerPort, aim.down, start, end, rtl),
		}, rtl, true, true)
	}

	/** The chip's presented color: its own, else its calendar's (the same resolution EventSegment uses). */
	private static colorOf(entry: Entry): string {
		return entry.color || getSource(entry.sourceId)?.color || 'var(--color-text)'
	}

	static override get styles() {
		return css`
			/* The scroller's block scroll offset as a LENGTH, for the cross-realm pieces: a scroll-driven
			   animation (see .lane-shifted) sweeps this from -1px to (scroll range - 1px). The -1px is the
			   grid gap the lane travels before it sticks, so max(0px, …) is exactly its stuck displacement.
			   Registered (top-level, since a nested @property is silently dropped) so keyframes can interpolate
			   it; non-inheriting, since every piece animates its own. */
			@property --_scroll-shift {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			@property --_pointer-x {
				syntax: '<length>';
				inherits: true;
				initial-value: 0px;
			}

			@property --_pointer-y {
				syntax: '<length>';
				inherits: true;
				initial-value: 0px;
			}

			@keyframes mitra-lane-shift {
				from {
					--_scroll-shift: -1px;
				}

				to {
					--_scroll-shift: calc(var(--mitra-days-scroll-range, 1px) - 1px);
				}
			}

			mitra-entry-connections {
				display: contents;

				/* One rest ink for both families (AGENTS.md). Legible by shape: dependencies curve and have arrowheads. */
				--mitra-connection-ink: color-mix(in srgb, var(--color-text) 45%, transparent);
				--mitra-connection-ink-emphasis: color-mix(in srgb, var(--color-text) 85%, transparent);
				--mitra-connection-ink-violation: color-mix(in srgb, var(--color-error) 65%, transparent);

				/* Opaque inks for filled arrowhead triangles to avoid transparent bleed. */
				--mitra-connection-head-ink: color-mix(in srgb, var(--color-text) 45%, var(--color-surface));
				--mitra-connection-head-ink-violation: color-mix(in srgb, var(--color-error) 65%, var(--color-surface));
				--mitra-connection-head: 10px;
				--_head-span: calc(var(--mitra-connection-head) + 1px);
				--_head-gap: calc(var(--mitra-connection-head) - 1px);

				> .connection {
					display: contents;

					> .piece {
						position: absolute;
						pointer-events: none;
						z-index: var(--mitra-connection-z, 1);

						/* Keeps degenerate spans visible for stretched ink glyphs. */
						&.glyph {
							min-block-size: 3px;
						}

						&.glyph.mirror {
							scale: -1 1;
						}

						/* Lane-shift displacement via scroll-driven animation. */
						&.lane-shifted {
							--_lane-shift: max(0px, var(--_scroll-shift));
							animation-name: mitra-lane-shift;
							animation-duration: auto;
							animation-timing-function: linear;
							animation-timeline: --mitra-days-scroll;
						}

						/* In-lane twin painting above sticky lane background. */
						&.in-lane {
							z-index: var(--mitra-connection-z-lane, 91);
						}

						> .ink {
							position: absolute;
							inset: 0;
							background: var(--mitra-connection-ink);
							transition: background 0.15s ease;
						}

						&.glyph > .ink {
							-webkit-mask: var(--_mask) no-repeat center / 100% 100%;
							mask: var(--_mask) no-repeat center / 100% 100%;
						}

						/* Elbow ring using padding box masked with content box exclusion. */
						&.elbow > .ink {
							padding: 0;
							-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
							mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
							-webkit-mask-composite: xor;
							mask-composite: exclude;
						}

						/* Two arcs of one radius and their shared tangent, from the source port (the box's top start
						   corner, its top end when behind) to the target port at the opposite corner, inline at both.
						   Container units read the box: the turn t is where the tangent through the route's midpoint
						   touches the first arc, and lengths divide as tan(atan2(a, b)). The radius shrinks where the
						   two arcs would overlap. */
						&.bend {
							container-type: size;

							> .ink {
								--_dir: 1;
								--_x: calc(var(--_dir) * 100cqi);
								--_y: 100cqb;
								--_h: hypot(var(--_x), var(--_y));
								--_r: min(${unsafeCSS(BEND_RADIUS)}, calc(var(--_h) * tan(atan2(var(--_h), calc(4 * var(--_y))))));
								--_mx: calc(var(--_x) / 2);
								--_my: calc(var(--_y) / 2 - var(--_r));
								--_d: hypot(var(--_mx), var(--_my));
								--_a: acos(tan(atan2(var(--_r), var(--_d))));
								--_t: calc(mod(atan2(var(--_my), var(--_mx)) - var(--_a) + 180deg, 360deg) - 90deg);
								--_px: calc((1 - var(--_dir)) / 2 * 100cqi);
								inset: auto;
								box-sizing: border-box;
							}

							&.behind > .ink {
								--_dir: -1;
							}

							/* A ring drawn by the gradient, not a padding ring excluded from its box: Chrome leaves a
							   faint full circle where an excluded ring meets the intersected sector. */
							> :is(.leave, .enter) {
								inline-size: calc(2 * var(--_r) + 2px);
								block-size: calc(2 * var(--_r) + 2px);
								-webkit-mask: var(--_sector), var(--_ring);
								mask: var(--_sector), var(--_ring);
								-webkit-mask-composite: source-in;
								mask-composite: intersect;
								--_ring: radial-gradient(closest-side, #0000 calc(100% - 1.75px), #000 calc(100% - 1.25px) calc(100% - 0.75px), #0000 calc(100% - 0.25px));
							}

							> .leave {
								--_f0: 0%;
								--_f1: 0%;
								--_sector: conic-gradient(#000 var(--_t), #0000 0);
								left: calc(var(--_px) - var(--_r) - 1px);
								top: -1px;
							}

							> .tangent {
								--_grad-dir: to right;
								--_f0: 0%;
								--_f1: 100%;
								left: calc(var(--_px) + var(--_r) * sin(var(--_t)));
								top: calc(var(--_r) - var(--_r) * cos(var(--_t)) - ${STROKE_WIDTH / 2}px);
								inline-size: calc(2 * var(--_d) * sin(var(--_a)));
								block-size: ${STROKE_WIDTH}px;
								transform-origin: 0 50%;
								rotate: var(--_t);
							}

							> .enter {
								--_f0: 100%;
								--_f1: 100%;
								--_sector: conic-gradient(from 180deg, #000 var(--_t), #0000 0);
								left: calc(var(--_px) + var(--_x) - var(--_r) - 1px);
								top: calc(var(--_y) - 2 * var(--_r) - 1px);
							}

							/* The twin for the other side, whose box inverted. A container's own pseudo-elements query it. */
							@container (inline-size <= 0px) {
								> .ink, &::after {
									display: none;
								}
							}
						}
					}

					&[data-emphasized] > .piece {
						z-index: var(--mitra-connection-z-emphasis, 3);

						> .ink {
							background: var(--mitra-connection-ink-emphasis);
						}
					}

					&[data-emphasized] > .piece.in-lane {
						z-index: var(--mitra-connection-z-lane-emphasis, 92);
					}

					/* Continuous gradient across piece slices. */
					&.dependency[data-emphasized]:not([data-violated]) > .piece > .ink {
						background: linear-gradient(var(--_grad-dir, to right),
							color-mix(in srgb, var(--_to) var(--_f0, 0%), var(--_from)),
							color-mix(in srgb, var(--_to) var(--_f1, 100%), var(--_from)));
					}

					/* Arrowhead triangle hung off final piece end. */
					> .piece:is(.head-end-down, .head-end-up, .head-end-flat, .head-down, .head-up, .head-drop-end, .head-rise-end)::after {
						content: '';
						position: absolute;
						background: var(--mitra-connection-head-ink);
						transition: background 0.15s ease;
					}

					&[data-emphasized]:not([data-violated]) > .piece::after {
						background: var(--_to, color-mix(in srgb, var(--color-text) 85%, var(--color-surface)));
					}

					&[data-violated] > .piece > .ink {
						background: var(--mitra-connection-ink-violation);
					}

					&[data-violated] > .piece::after {
						background: var(--mitra-connection-head-ink-violation);
					}

					&[data-violated][data-emphasized] > .piece > .ink,
					&[data-violated][data-emphasized] > .piece::after {
						background: var(--color-error);
					}

					/* Inline-axis arrowheads */
					> .piece:is(.head-end-down, .head-end-up, .head-end-flat)::after {
						inline-size: var(--mitra-connection-head);
						block-size: var(--_head-span);
						clip-path: polygon(0 0, 100% 50%, 0 100%);
						right: calc(-1 * var(--_head-gap));
					}

					> .piece.bend.behind::after {
						right: auto;
						left: 0;
					}

					> .piece.elbow.mirror::after {
						right: auto;
						left: calc(-1 * var(--_head-gap));
						clip-path: polygon(100% 0, 0 50%, 100% 100%);
					}

					> .piece.head-end-down::after {
						bottom: calc(-0.5 * var(--_head-span));
					}

					> .piece.head-end-up::after {
						top: calc(-0.5 * var(--_head-span));
					}

					> .piece.head-end-flat::after {
						top: 50%;
						translate: 0 -50%;
					}

					/* Block-axis arrowheads */
					> .piece:is(.head-down, .head-drop-end)::after {
						inline-size: var(--_head-span);
						block-size: var(--mitra-connection-head);
						clip-path: polygon(0 0, 50% 100%, 100% 0);
						bottom: calc(-1 * var(--_head-gap));
					}

					> .piece:is(.head-up, .head-rise-end)::after {
						inline-size: var(--_head-span);
						block-size: var(--mitra-connection-head);
						clip-path: polygon(0 100%, 50% 0, 100% 100%);
						top: calc(-1 * var(--_head-gap));
					}

					> .piece:is(.head-down, .head-up)::after {
						left: 50%;
						translate: -50% 0;
					}

					> .piece:is(.head-drop-end, .head-rise-end)::after {
						right: calc(-0.5 * var(--_head-span));
					}

				}

				> .connection.handle.drawing > .piece {
					visibility: hidden;
				}

				> .connection.handle > .piece {
					z-index: var(--mitra-connection-z-emphasis, 3);

					> .ink {
						inset: 50% auto auto 50%;
						inline-size: 0.5rem;
						block-size: 0.5rem;
						translate: -50% -50%;
						border-radius: 50%;
					}

					/* Starts at the chip's edge, never inside it: a horizontal chip's end is its resize strip. */
					> .connect {
						position: absolute;
						inset-block: -0.625rem;
						inset-inline: 0 -0.5rem;
						pointer-events: auto;
						cursor: crosshair;
					}
				}

				@media not ((hover: hover) and (pointer: fine)) {
					> .connection.handle {
						display: none;
					}
				}
			}
		`
	}

	protected override get template() {
		const rtl = this.matches(':dir(rtl)')
		const hovered = this.hoveredEntryId
		return html`
			${repeat(this.connectorEdges, edge => edge.key, edge =>
				this.edgeTemplate(edge, rtl, !!hovered && (edge.fromEntryId === hovered || edge.toEntryId === hovered)))}
			${this.handleTemplate(rtl)}
			${this.draftTemplate(rtl)}
		`
	}

	private edgeTemplate(edge: ConnectorEdge, rtl: boolean, emphasized: boolean, draft = false) {
		const colors = edge.kind !== 'dependency' ? '' : ` --_from: ${edge.fromColor}; --_to: ${edge.toColor};`
		return html`
			<div class="connection ${edge.kind} ${draft ? 'draft' : ''}" ?data-emphasized=${emphasized} ?data-violated=${edge.violated}>
				${edge.pieces.map(piece => html`
					<div class="piece ${piece.bend ? `bend ${piece.bend}` : piece.path ? 'glyph' : 'elbow'} ${piece.head ?? ''} ${rtl !== !!piece.flip ? 'mirror' : ''} ${piece.inLane ? 'in-lane' : ''} ${edge.cross ? 'lane-shifted' : ''}"
						style="${piece.style}${piece.gradient ? ` --_grad-dir: ${piece.gradient};` : ''}${piece.fade ? ` --_f0: ${piece.fade[0]}%; --_f1: ${piece.fade[1]}%;` : ''}${colors}"
					>
						${piece.bend ? html`
							<div class="ink leave"></div>
							<div class="ink tangent"></div>
							<div class="ink enter"></div>
						` : html`<div class="ink" style="${piece.path ? `--_mask: ${maskFor(piece.path)};` : piece.ink ?? ''}"></div>`}
					</div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-connections': EntryConnections
	}
}
