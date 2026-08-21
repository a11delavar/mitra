import { Component, component, html, css, property, state, repeat } from '@a11d/lit'
import { RelationType, type Entry } from 'shared'
import { type EntrySegment } from './EntrySegment.js'
import { type EntrySegmentComponent } from './EventSegment.js'
import { getSource } from './Api.js'
import { EntryStore } from './EntryStore.js'

/**
 * One drawable relation edge: which chips it spans, and the PIECES that draw it. JS decides topology
 * (which pairs, which route) from data; pixels are entirely CSS anchor positioning's job — no
 * measurement, no per-frame work.
 *
 * The anchor() usage is only sound because of the CANVAS topology (see Days.ts): the pieces'
 * containing block is a POSITIONED wrapper that co-scrolls with — and CONTAINS — the chips, so no
 * scroll container sits between an anchor and the containing block. Anchored against the scroller
 * itself instead, Chromium snapshots the anchor's scrollport-relative position and live-compensates
 * for scroll as if the piece did NOT scroll with the content (the popover model — measured: used
 * inset frozen at −3112.97px while the box drifted by exactly the scroll delta). And hoisting the
 * layer outside fails anchor ACCEPTABILITY (anchors must be descendants of the containing block).
 */
interface ConnectorEdge {
	readonly key: string
	readonly kind: 'dependency' | 'subtask'
	readonly fromEntryId: string
	readonly toEntryId: string
	readonly pieces: ReadonlyArray<ConnectorPiece>
	/** The endpoints' presented colors — the hover gradient's stops (dependencies only). */
	readonly fromColor?: string
	readonly toColor?: string
}

/** One anchored box carrying one primitive stroke — a stretched GLYPH where the ink curves, a rounded
 * ELBOW ring where it turns. A simple edge is a single piece; a loop is three, tiled so
 * consecutive boxes name the same anchor() expression for the edge they share, which is what makes
 * the joints hold under any layout without a single measurement. */
interface ConnectorPiece {
	/** The anchor()-referencing insets that place the box. */
	readonly style: string
	/** GLYPH pieces: the {@link PATHS} key of the stroke stretched across the box. */
	readonly path?: string
	/** ELBOW pieces: the padding + radius longhands that draw the ink instead of a glyph. A stretched
	 * quarter curve is only round in proportion — in a box 14px wide and 300px tall it reads as a right
	 * angle — so a route that TURNS draws its ink as a ring around the box, whose corner radius is a
	 * length and therefore stays itself at every size. Logical longhands, so RTL needs no second set. */
	readonly ink?: string
	/** The class hanging the arrowhead off this piece's path END; absent = a joint piece. */
	readonly head?: 'head-end-down' | 'head-end-up' | 'head-end-flat' | 'head-down'
	/** The direction the ink travels through this box, for the hover gradient. */
	readonly gradient?: string
	/** This piece's slice of the source→target fade, in percent. Consecutive pieces meet at the same
	 * mixed color, which is what makes one gradient read as continuous across several boxes; a single
	 * piece spans the whole 0→100. */
	readonly fade?: readonly [number, number]
}

/** The normalized ink strokes, stretched to each piece's anchored box (preserveAspectRatio="none" +
 * non-scaling-stroke keeps the stroke width constant at ANY aspect ratio). Every dependency path ends
 * on a horizontal or vertical tangent, so the fixed-rotation arrowhead always matches the arrival
 * angle. These are baked into a MASK data-uri (see maskFor): the ink is a masked CSS background, NOT
 * an SVG stroke — SVG paint-servers (a gradient stroke/fill) silently fail to render inside a
 * CSS-anchor-positioned element (a Chromium bug; solid strokes and CSS backgrounds/masks are immune),
 * and the hover ink is a source→target CSS gradient.
 *
 * Authored in physical LTR space; in RTL every box is PLACED at the mirrored position (the router
 * swaps its inline words) and the glyph inside is mirrored by the `mirror` class — one solution,
 * reflected, rather than a second set of paths. */
const PATHS: Record<string, string> = {
	// Forward single pieces: S-curves corner to corner, a straight line for level ports.
	'dependency:s-down': 'M 0 0 C 50 0 50 100 100 100',
	'dependency:s-up': 'M 0 100 C 50 100 50 0 100 0',
	'dependency:flat': 'M 0 50 H 100',
	// The same-column forward drop: source block-end straight into the target block-start.
	'dependency:drop': 'M 50 0 V 100',
	'subtask:right-down': 'M 0 0 V 100 H 100',
	'subtask:right-up': 'M 0 100 V 0 H 100',
	'subtask:left-down': 'M 100 0 V 100 H 0',
	'subtask:left-up': 'M 100 100 V 0 H 0',
	'subtask:down': 'M 50 0 V 100',
	'subtask:up': 'M 50 100 V 0',
}

/** The hover gradient's CSS direction per single-piece path — from the SOURCE end to the TARGET end,
 * so the ink fades source-color → target-color (physical LTR; the `mirror` class reflects it). */
const GRADIENT_DIRECTIONS: Record<string, string> = {
	'dependency:s-down': 'to bottom right',
	'dependency:s-up': 'to top right',
	'dependency:flat': 'to right',
	'dependency:drop': 'to bottom',
}

/** The block size a straight run's box is given, centred on its line — a line along a box EDGE would
 * live in a 0px box and the stretched ink would have no area to paint into. */
const FLAT_BLOCK_SIZE = 8

/** How far a loop reaches past a port before turning (its horizontal clearance). Must exceed CORNER —
 * it has to hold a rounded corner and still leave straight run on both sides of it. */
const STUB = '0.875rem'

/** How far a loop's lane clears the chips it wraps around. */
const LANE = '0.5rem'

/** The radius every turn is rounded by. A length, not a proportion, so a corner looks the same whether
 * the leg it ends is 6px or 600px long. */
const CORNER = '0.375rem'

/** Constant device stroke width per kind (dependencies read a touch heavier than the subtask
 * hairline). Fixed across rest/hover — emphasis is carried by color and z-lift, not thickness — so a
 * piece needs only ONE mask. */
const STROKE_WIDTH: Record<'dependency' | 'subtask', number> = { dependency: 1.75, subtask: 1.25 }

/** The stroke shape as a mask-image `url()`: a white stroke of the normalized path, stretched with the
 * box (`preserveAspectRatio="none"`) at constant device width (`non-scaling-stroke`). The masked
 * element's CSS background (solid at rest, a gradient on hover) shows through only along the stroke —
 * an SVG paint-server can't be used here (it fails inside anchor-positioned elements; see PATHS). */
function maskFor(path: string): string {
	const kind = path.startsWith('subtask') ? 'subtask' : 'dependency'
	const caps = kind === 'dependency' ? 'stroke-linecap="round"' : 'stroke-linecap="butt" stroke-linejoin="miter"'
	// Double quotes inside the SVG so encodeURIComponent escapes them (%22) — the returned url() is
	// wrapped in SINGLE quotes and lands in an HTML style="…" attribute, which mustn't see raw quotes.
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${PATHS[path] ?? ''}" fill="none" stroke="white" stroke-width="${STROKE_WIDTH[kind]}" vector-effect="non-scaling-stroke" ${caps}/></svg>`
	return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`
}

/**
 * The relationship connectors of a calendar view: thin always-visible arrows between related entry
 * chips — smooth S-curves with an arrowhead for dependencies, sharp hairline elbows (no arrowhead)
 * for hierarchy. Each connector is one or more absolutely-positioned PIECES whose insets reference
 * the two chips' existing `anchor-name`s (published by EventSegment for its editor popover), so the
 * geometry — including overlap-narrowed chip widths and CSS-auto-packed lanes JS never sees — tracks
 * the REAL chip boxes with zero measurement.
 *
 * PORTS follow the boundary the relation couples: a dependency leaves the source's END edge and
 * arrives at the target's START edge — the inline pair (end-center → start-center) across columns,
 * the block pair (bottom-center → top-center) within one. ROUTING is pure geometry, never validity:
 * an edge that happens to run backward in time (the target's start behind the source's end) draws
 * exactly as faithfully as a valid one, as a three-piece LOOP — out of the end port, around the pair
 * on a clearance lane (below when the target sits below or level, above when it sits above), back
 * into the start port. A subtask elbow drops from the parent's bottom inline-start (indented) into
 * the child's inline-start center.
 *
 * VIEW-AGNOSTIC by design: a view passes exactly the SEGMENTS it rendered inside one CANVAS (a
 * positioned wrapper that co-scrolls with and contains those chips — the week grid's `div.canvas`,
 * the sticky all-day lane, the month grid's `div.canvas`) and mounts this layer as the canvas's LAST
 * child (anchors must precede the positioned elements in tree order). Bar-shaped views additionally
 * pass `verticalRank` (their JS-known lane/slot order); the timed grid defaults to minute math.
 *
 * Topology comes from data only: the segments' entries' `relations` (both families, whichever side
 * stored the pointer — see RelationType's edge readings), deduplicated per (kind, uid-pair) with the
 * temporally NEAREST pair chosen when a uid resolves to several rows. Edges leave each canvas's
 * realm implicitly: only chips rendered IN this canvas participate.
 *
 * RTL: the router thinks in logical inline terms and swaps its physical words per the layer's
 * resolved direction (read once per render — data, not layout), while the `mirror` class reflects
 * the LTR-authored glyphs, gradients and arrowheads inside each box.
 *
 * Hovering an entry chip emphasizes its connectors — stronger ink, lifted above chips, and a
 * dependency's stroke becomes a source-color → target-color gradient carried across all of its
 * pieces (each paints its own slice of the fade, so the boxes meet at one colour). Neither this
 * host, the canvas, nor `div.entries` (Day.ts) may be a stacking context: the pieces' z-index
 * (--mitra-connection-z, default 1) must interleave with the chips' in the view's own context.
 */
@component('mitra-entry-connections')
export class EntryConnections extends Component {
	/** Per-view opt-out, persisted; every wired view defaults ON — relationships are meant to be seen. */
	static isEnabledFor(view: 'week' | 'month') {
		return localStorage.getItem(`Mitra.Connections.${view}`) !== 'false'
	}

	static setEnabledFor(view: 'week' | 'month', enabled: boolean) {
		localStorage.setItem(`Mitra.Connections.${view}`, String(enabled))
		EntryStore.notify()
	}

	/** First-fit lane simulation mirroring CSS `grid-auto-flow: row dense` for the given bars in
	 * their RENDER ORDER (each an inclusive [start, end] column span) — for views whose lanes pack
	 * purely in CSS, so their lane order is re-derived for the vertical classifier. */
	static laneRanks(bars: ReadonlyArray<{ segment: EntrySegment, start: number, end: number }>): ReadonlyMap<EntrySegment, number> {
		const lanes = new Array<Array<{ start: number, end: number }>>()
		const ranks = new Map<EntrySegment, number>()
		for (const bar of bars) {
			let lane = lanes.findIndex(occupied => occupied.every(other => bar.end < other.start || bar.start > other.end))
			if (lane === -1) {
				lane = lanes.length
				lanes.push([])
			}
			lanes[lane]!.push(bar)
			ranks.set(bar.segment, lane)
		}
		return ranks
	}

	// Re-renders on store notifications, so a relation edit redraws immediately.
	readonly store = new EntryStore(this)

	/** The chips rendered inside this layer's canvas — the anchor-bearing source of truth for which
	 * entries participate and which slices carry the ports. */
	@property({ type: Array }) segments: ReadonlyArray<EntrySegment> = []

	/** Bar views' vertical order (month week×slot, simulated all-day lanes); absent = timed minutes. */
	@property({ type: Object }) verticalRank?: ReadonlyMap<EntrySegment, number>

	/** The entry whose chips the pointer is over — its connectors emphasize. Event-driven, not per-frame. */
	@state() private hoveredEntryId?: string

	protected override createRenderRoot() { return this }

	private readonly handlePointerOver = (e: Event) => {
		const chip = (e.target as Element | null)?.closest?.('mitra-entry-segment') as EntrySegmentComponent | null
		const id = chip?.segment?.entry.id
		if (id !== this.hoveredEntryId) {
			this.hoveredEntryId = id
		}
	}

	override connected() {
		// The layer itself is pointer-events: none — hover intent is read off the surrounding view;
		// the scroller is the natural delegate (covers every canvas within it).
		this.scrollHost = (this.parentElement?.closest('mitra-days, mitra-weeks') ?? this.parentElement) as HTMLElement | null
		this.scrollHost?.addEventListener('pointerover', this.handlePointerOver)
	}

	private scrollHost?: HTMLElement | null

	override disconnected() {
		this.scrollHost?.removeEventListener('pointerover', this.handlePointerOver)
	}

	/** A bar's/chip's vertical center order — lane rank where provided, minute midpoint otherwise. */
	private rankOf(segment: EntrySegment): number {
		return this.verticalRank?.get(segment) ?? segment.startMinute + segment.endMinute
	}

	private get connectorEdges(): Array<ConnectorEdge> {
		// Anchor-bearing chips only: persisted (the anchor-name embeds the id), uid-addressable, real.
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
		const seen = new Set<string>()
		for (const owner of byEntry.keys()) {
			for (const relation of owner.relations ?? []) {
				const family = RelationType.of(relation.type).family
				if (!family) {
					continue
				}
				// One edge per (family, uid-pair): every occurrence of a recurring owner materializes
				// the master's relations, and both hierarchy directions can be foreign-authored.
				const pairKey = `${family}:${owner.uid}:${relation.targetUid}`
				if (seen.has(pairKey)) {
					continue
				}
				const targets = byUid.get(relation.targetUid)
				if (!targets?.length) {
					continue
				}
				seen.add(pairKey)
				// A uid can resolve to several rows (a recurring series) — connect the temporally
				// nearest owner/target pair, not every combination.
				const owners = byUid.get(owner.uid!) ?? [owner]
				let bestOwner: Entry | undefined
				let bestTarget: Entry | undefined
				let bestDelta = Infinity
				for (const o of owners) {
					for (const t of targets) {
						if (o === t) {
							continue
						}
						const delta = Math.abs((o.start?.valueOf() ?? 0) - (t.start?.valueOf() ?? 0))
						if (delta < bestDelta) {
							bestDelta = delta
							bestOwner = o
							bestTarget = t
						}
					}
				}
				if (!bestOwner || !bestTarget) {
					continue
				}
				// The edge's visual direction: dependencies flow predecessor → dependent, hierarchy
				// parent → subtask — whichever side stored the pointer.
				let from: Entry
				let to: Entry
				let kind: ConnectorEdge['kind']
				if (family === 'dependency') {
					kind = 'dependency'
					from = bestTarget
					to = bestOwner
				} else {
					kind = 'subtask'
					const edge = RelationType.of(relation.type).hierarchyEdge(bestOwner.uid!, relation.targetUid)
					if (!edge) {
						continue
					}
					from = edge.parent === bestOwner.uid ? bestOwner : bestTarget
					to = from === bestOwner ? bestTarget : bestOwner
				}
				// The arrow leaves the run's LAST chip in this canvas and arrives at the FIRST.
				const fromSeg = byEntry.get(from)?.at(-1)
				const toSeg = byEntry.get(to)?.[0]
				if (!fromSeg || !toSeg || fromSeg === toSeg) {
					continue
				}
				edges.push(this.edge(kind, from, to, fromSeg, toSeg))
			}
		}
		return edges
	}

	/**
	 * ROUTES one edge into its pieces, from data alone — day column for the inline axis, `rankOf`
	 * for the block axis, never pixels. The routing is purely geometric and validity-agnostic:
	 *
	 * - Target column strictly after the source's run: a single forward piece (S-curve, or a
	 *   straight line when the ports are level).
	 * - Same column with the target's rank below: the block-port drop — source bottom-center
	 *   straight into target top-center.
	 * - Everything else — target behind, level-behind, above in the same column, or bar runs
	 *   overlapping so the side ports have no clear water: a three-piece LOOP around the pair.
	 */
	private edge(kind: ConnectorEdge['kind'], from: Entry, to: Entry, fromSeg: EntrySegment, toSeg: EntrySegment): ConnectorEdge {
		const A = `--mitra-entry-segment-${fromSeg.id}`
		const B = `--mitra-entry-segment-${toSeg.id}`
		// The physical words for the logical inline sides, per the layer's resolved direction — read
		// from computed style (data, not geometry), so the router thinks in reading order and RTL is
		// the same solution mirrored (the `mirror` class reflects the glyphs to match).
		const rtl = getComputedStyle(this).direction === 'rtl'
		const [start, end] = rtl ? ['right', 'left'] : ['left', 'right']
		const dayDelta = toSeg.dayValue! - fromSeg.dayValue!
		const head = 'var(--mitra-connection-head)'
		const down = this.rankOf(toSeg) >= this.rankOf(fromSeg)
		// Side ports need clear water between the columns: a multi-day BAR whose span reaches the
		// other endpoint's column has none, whatever the day delta says.
		const overlapping = dayDelta > 0
			? toSeg.dayValue! <= (fromSeg.runEnd.dayValue ?? fromSeg.dayValue!)
			: dayDelta < 0 ? (toSeg.runEnd.dayValue ?? toSeg.dayValue!) >= fromSeg.dayValue! : true

		let pieces: Array<ConnectorPiece>
		if (kind === 'dependency') {
			const flat = this.rankOf(toSeg) === this.rankOf(fromSeg)
			if (dayDelta > 0 && !overlapping) {
				// Forward: one piece, end-center → start-center. A level pair rides a fixed-height box
				// (edge-to-edge insets would resolve to a 0px box and the ink would have no area).
				const vertical = flat
					? `top: calc(anchor(${A} 50%) - ${FLAT_BLOCK_SIZE / 2}px); block-size: ${FLAT_BLOCK_SIZE}px;`
					: down
						? `top: anchor(${A} 50%); bottom: anchor(${B} 50%);`
						: `top: anchor(${B} 50%); bottom: anchor(${A} 50%);`
				const path = flat ? 'dependency:flat' : down ? 'dependency:s-down' : 'dependency:s-up'
				pieces = [{
					path,
					style: `${vertical} ${start}: anchor(${A} ${end}); ${end}: calc(anchor(${B} ${start}) + ${head});`,
					head: flat ? 'head-end-flat' : down ? 'head-end-down' : 'head-end-up',
					gradient: GRADIENT_DIRECTIONS[path],
				}]
			} else if (dayDelta === 0 && !flat && down) {
				// Same column, target below: the block ports — end edge is the BOTTOM here, so the
				// arrow drops from the source's bottom-center straight into the target's top-center.
				pieces = [{
					path: 'dependency:drop',
					style: `top: anchor(${A} bottom); bottom: calc(anchor(${B} top) + ${head}); ${start}: calc(anchor(${A} 50%) - ${FLAT_BLOCK_SIZE / 2}px); inline-size: ${FLAT_BLOCK_SIZE}px;`,
					head: 'head-down',
					gradient: GRADIENT_DIRECTIONS['dependency:drop'],
				}]
			} else {
				// The loop: out of the end port, around the pair on a clearance lane, back into the
				// start port. Below when the target sits below or LEVEL (the tie, so the same edge
				// always routes the same way), above when it sits above.
				pieces = down ? EntryConnections.loopBelow(A, B, start, end, head, rtl) : EntryConnections.loopAbove(A, B, start, end, head, rtl)
			}
		} else {
			// The elbow: drop from the parent's bottom inline-start (indented) into the child's
			// inline-start center — the Notion tree line, unrolled.
			const drop = `calc(anchor(${A} ${start}) + 0.5rem)`
			let path: string
			let style: string
			if (overlapping) {
				// Same column: a bare tick through the gap between the two chips.
				path = `subtask:${down ? 'down' : 'up'}`
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} top);`
					: `top: anchor(${B} bottom); bottom: anchor(${A} top);`
				style = `${vertical} ${start}: calc(${drop} - 1px); inline-size: 2px;`
			} else {
				path = `subtask:${dayDelta > 0 ? 'right' : 'left'}-${down ? 'down' : 'up'}`
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} 50%);`
					: `top: anchor(${B} 50%); bottom: anchor(${A} top);`
				style = dayDelta > 0
					? `${vertical} ${start}: ${drop}; ${end}: calc(anchor(${B} ${start}) + 2px);`
					: `${vertical} ${end}: calc(anchor(${A} ${start}) - 0.5rem); ${start}: calc(anchor(${B} ${end}) + 2px);`
			}
			pieces = [{ path, style }]
		}
		return {
			key: `${kind}:${fromSeg.id}:${toSeg.id}`, kind, fromEntryId: from.id!, toEntryId: to.id!, pieces,
			...(kind !== 'dependency' ? {} : { fromColor: EntryConnections.colorOf(from), toColor: EntryConnections.colorOf(to) }),
		}
	}

	/** The backward loop, lane BELOW the pair: out of the source's end port, down, back under both
	 * chips, up into the target's start port — four turns in three bordered boxes.
	 *
	 * The boxes tile at coordinates, not at pixels: consecutive pieces name the SAME anchor()
	 * expression for the edge they share, so a joint is exact under any layout and never measured. The
	 * seam sits one corner-radius past the target's centre line, where the ink is running straight, so
	 * the joins land between turns rather than inside one. The lane's ordinate is a min()/max() over
	 * both chips' anchors — one lane clears both whatever their heights. */
	private static loopBelow(A: string, B: string, start: string, end: string, head: string, rtl: boolean): Array<ConnectorPiece> {
		const w = STROKE_WIDTH.dependency
		// Where the out-leg hands over to the U — a corner's worth below the target's centre, so the
		// U's own corner has straight run to start from.
		const seam = `anchor(${B} 50%)`
		return [
			{
				// Out of the end port, round, and down. The turn is the box's start-end corner.
				style: `top: anchor(${A} 50%); bottom: calc(${seam} - ${CORNER}); ${start}: anchor(${A} ${end}); inline-size: ${STUB};`,
				ink: `padding-block-start: ${w}px; padding-inline-end: ${w}px; border-start-end-radius: ${CORNER};`,
				gradient: rtl ? 'to bottom left' : 'to bottom right',
				fade: [0, 25],
			},
			{
				// The U under the pair: down the end side, round, back along the lane, round, up the
				// start side. Three borders and the two bottom radii ARE the shape.
				style: `top: calc(${seam} + ${CORNER}); bottom: calc(min(anchor(${A} bottom), anchor(${B} bottom)) - ${LANE}); ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${A} ${end}) - ${STUB});`,
				ink: `padding-inline-start: ${w}px; padding-inline-end: ${w}px; padding-block-end: ${w}px; border-end-start-radius: ${CORNER}; border-end-end-radius: ${CORNER};`,
				gradient: rtl ? 'to right' : 'to left',
				fade: [25, 75],
			},
			{
				// The last turn, straight into the start port. Exactly one corner tall, so the radius
				// consumes the box and the ink leaves it running level with the target's centre.
				style: `top: ${seam}; block-size: ${CORNER}; ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${B} ${start}) + ${head});`,
				ink: `padding-block-start: ${w}px; padding-inline-start: ${w}px; border-start-start-radius: ${CORNER};`,
				head: 'head-end-up',
				gradient: rtl ? 'to top left' : 'to top right',
				fade: [75, 100],
			},
		]
	}

	/** {@link loopBelow}, reflected over the pair: the same three boxes with their block edges swapped. */
	private static loopAbove(A: string, B: string, start: string, end: string, head: string, rtl: boolean): Array<ConnectorPiece> {
		const w = STROKE_WIDTH.dependency
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
				style: `bottom: ${seam}; block-size: ${CORNER}; ${start}: calc(anchor(${B} ${start}) - ${STUB}); ${end}: calc(anchor(${B} ${start}) + ${head});`,
				ink: `padding-block-end: ${w}px; padding-inline-start: ${w}px; border-end-start-radius: ${CORNER};`,
				head: 'head-end-down',
				gradient: rtl ? 'to bottom left' : 'to bottom right',
				fade: [75, 100],
			},
		]
	}

	/** The chip's presented color — its own, else its calendar's (the same resolution EventSegment uses). */
	private static colorOf(entry: Entry): string {
		return entry.color || getSource(entry.sourceId)?.color || 'var(--color-text)'
	}

	static override get styles() {
		return css`
			mitra-entry-connections {
				/* Boxless, and so is each connection wrapper: the PIECES are the absolutely positioned
				   boxes, and their containing block is the view's CANVAS (the positioned, co-scrolling
				   wrapper around the chips — Days.ts), which is what makes their anchor() references
				   track the real chip boxes with no scroll compensation in play. */
				display: contents;

				/* The connector ink: neutral on purpose — endpoints can wear different colors, and the
				   lines must whisper ("noticed only if you look; once seen, cannot unsee"). Hover
				   emphasis is where color enters: a single-piece dependency's ink becomes a
				   source→target gradient (the per-piece --_grad-dir with the edge's --_from/--_to).
				   The ink is a MASKED CSS background, not an SVG stroke — an SVG paint-server gradient
				   won't render inside an anchor-positioned element (a Chromium bug). */
				--mitra-connection-ink: color-mix(in srgb, var(--color-text) 34%, transparent);
				--mitra-connection-ink-faint: color-mix(in srgb, var(--color-text) 26%, transparent);
				--mitra-connection-ink-emphasis: color-mix(in srgb, var(--color-text) 85%, transparent);
				--mitra-connection-head: 5px;

				> .connection {
					display: contents;

					> .piece {
						position: absolute;
						pointer-events: none;
						/* Interleaves with the view's chips in ITS stacking context: default above the
						   surface/hour lines (z 1, canvas painted last) and below chips (z 2); a bar
						   view whose bars sit at z 1 lowers this to 0. Emphasis lifts above. */
						z-index: var(--mitra-connection-z, 1);

						/* The floor that keeps a degenerate span visible at all: whenever two anchored
						   edges resolve to the same ordinate the box is 0px tall and the stretched ink
						   has no area to paint into. Dependencies route those cases exactly (the flat
						   box, the loop's fixed-height lane); this catches every other shape, e.g. a
						   subtask elbow whose parent's bottom lands on its child's centre, where the
						   chip heights the span depends on aren't knowable from data. */
						min-block-size: 3px;

						/* In RTL the router places every box at the mirrored position; a glyph's
						   LTR-authored path, gradient and arrowhead are reflected to match. Elbows need
						   no reflection — they are drawn in logical properties — only their head does. */
						&.glyph.mirror {
							scale: -1 1;
						}

						> .ink {
							position: absolute;
							inset: 0;
							background: var(--mitra-connection-ink);
							transition: background 0.15s ease;
						}

						/* A glyph's line: the background clipped to the stroke shape by --_mask (a
						   per-piece data-uri; see maskFor). */
						&.glyph > .ink {
							-webkit-mask: var(--_mask) no-repeat center / 100% 100%;
							mask: var(--_mask) no-repeat center / 100% 100%;
						}

						/* An elbow's line is a PADDING ring: the background covers the padding box and the
						   content box is masked back out, so paint survives only on the sides the piece
						   gave padding to — rounded by border-radius, which is a length and therefore
						   holds its shape however far the box is stretched. Padding, not border, because
						   Blink floors border-width to whole pixels (1.75px would render at 1px) while
						   padding keeps the fraction; the unpadded sides stay at 0 and draw nothing. */
						&.elbow > .ink {
							padding: 0;
							-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
							mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
							-webkit-mask-composite: xor;
							mask-composite: exclude;
						}
					}

					&.subtask > .piece > .ink {
						background: var(--mitra-connection-ink-faint);
					}

					&[data-emphasized] > .piece {
						z-index: var(--mitra-connection-z-emphasis, 3);

						> .ink {
							background: var(--mitra-connection-ink-emphasis);
						}
					}

					/* An emphasized dependency fades source-color → target-color along the ROUTE, not
					   along each box: a piece paints only its own slice of the fade (--_f0..--_f1), so
					   the colour a box ends on is the colour its successor starts from and the seams
					   disappear. A single-piece route spans the whole 0→100 and this reduces to the
					   plain two-stop gradient it always was. */
					&.dependency[data-emphasized] > .piece > .ink {
						background: linear-gradient(var(--_grad-dir, to right),
							color-mix(in srgb, var(--_to) var(--_f0, 0%), var(--_from)),
							color-mix(in srgb, var(--_to) var(--_f1, 100%), var(--_from)));
					}

					/* The dependency arrowhead: a CSS triangle hung in the head-sized gap the route
					   left before the target's port, on the FINAL piece only, at that piece's path end.
					   Fixed rotation is safe: every path ends on an axis-aligned tangent. On emphasis
					   it adopts the arrival color — the target's. */
					> .piece:is(.head-end-down, .head-end-up, .head-end-flat, .head-down)::after {
						content: '';
						position: absolute;
						background: var(--mitra-connection-ink);
						transition: background 0.15s ease;
					}

					&[data-emphasized] > .piece::after {
						background: var(--_to, var(--mitra-connection-ink-emphasis));
					}

					> .piece:is(.head-end-down, .head-end-up, .head-end-flat)::after {
						inline-size: var(--mitra-connection-head);
						block-size: calc(var(--mitra-connection-head) + 2px);
						clip-path: polygon(0 0, 100% 50%, 0 100%);
						right: calc(-1 * var(--mitra-connection-head));
					}

					/* An elbow isn't reflected as a whole, so in RTL its head moves and turns on its own. */
					> .piece.elbow.mirror::after {
						right: auto;
						left: calc(-1 * var(--mitra-connection-head));
						clip-path: polygon(100% 0, 0 50%, 100% 100%);
					}

					> .piece.head-end-down::after {
						bottom: calc((var(--mitra-connection-head) + 2px) / -2);
					}

					> .piece.head-end-up::after {
						top: calc((var(--mitra-connection-head) + 2px) / -2);
					}

					/* A flat path ends at the box's MIDDLE, not a corner, so its head centres on it. */
					> .piece.head-end-flat::after {
						top: 50%;
						translate: 0 -50%;
					}

					/* The drop's head points down, centred under the vertical line. */
					> .piece.head-down::after {
						inline-size: calc(var(--mitra-connection-head) + 2px);
						block-size: var(--mitra-connection-head);
						clip-path: polygon(0 0, 100% 0, 50% 100%);
						bottom: calc(-1 * var(--mitra-connection-head));
						left: 50%;
						translate: -50% 0;
					}
				}
			}
		`
	}

	protected override get template() {
		const rtl = getComputedStyle(this).direction === 'rtl'
		return html`
			${repeat(this.connectorEdges, edge => edge.key, edge => {
				const emphasized = !!this.hoveredEntryId && (edge.fromEntryId === this.hoveredEntryId || edge.toEntryId === this.hoveredEntryId)
				const colors = edge.kind !== 'dependency' ? '' : ` --_from: ${edge.fromColor}; --_to: ${edge.toColor};`
				return html`
					<div class="connection ${edge.kind}" ?data-emphasized=${emphasized}>
						${edge.pieces.map(piece => html`
							<div class="piece ${piece.path ? 'glyph' : 'elbow'} ${piece.head ?? ''} ${rtl ? 'mirror' : ''}"
								style="${piece.style}${piece.gradient ? ` --_grad-dir: ${piece.gradient};` : ''}${piece.fade ? ` --_f0: ${piece.fade[0]}%; --_f1: ${piece.fade[1]}%;` : ''}${colors}"
							>
								<div class="ink" style="${piece.path ? `--_mask: ${maskFor(piece.path)};` : piece.ink ?? ''}"></div>
							</div>
						`)}
					</div>
				`
			})}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-connections': EntryConnections
	}
}
