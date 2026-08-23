import { Component, component, html, css, property, state, repeat } from '@a11d/lit'
import { RelationGraph, type Entry } from 'shared'
import { type EntrySegment } from './EntrySegment.js'
import { type EntrySegmentComponent } from './EventSegment.js'
import { getSource } from './Api.js'
import { EntryStore } from './EntryStore.js'

/** One drawable relation edge: the chips it spans and the PIECES that draw it. JS decides topology
 * from data alone; pixels are CSS anchor positioning's job — which is only sound because of the
 * CANVAS pattern (see AGENTS.md, and Days.ts for the wrapper itself). */
interface ConnectorEdge {
	readonly key: string
	readonly kind: 'dependency' | 'subtask'
	readonly fromEntryId: string
	readonly toEntryId: string
	readonly pieces: ReadonlyArray<ConnectorPiece>
	/** The coupling this edge draws is already broken by its endpoints — see {@link Entry.violates}. */
	readonly violated: boolean
	/** The endpoints' presented colors — the hover gradient's stops (dependencies only). */
	readonly fromColor?: string
	readonly toColor?: string
}

/** One anchored box carrying one primitive stroke — a stretched GLYPH where the ink curves, a rounded
 * ELBOW ring where it turns. Consecutive pieces name the SAME anchor() expression for the edge they
 * share, which is what holds a multi-piece route's joints without a single measurement. */
interface ConnectorPiece {
	/** The anchor()-referencing insets that place the box. */
	readonly style: string
	/** GLYPH pieces: the {@link PATHS} key of the stroke stretched across the box. */
	readonly path?: string
	/** ELBOW pieces: the padding + radius longhands that draw the ink instead of a glyph. A stretched
	 * quarter curve is round only in PROPORTION — in a box 14px wide and 300px tall it reads as a right
	 * angle — so a turn draws a ring whose corner radius is a length and holds its shape at any size. */
	readonly ink?: string
	/** The class hanging the arrowhead off this piece's path END; absent = a joint piece. */
	readonly head?: 'head-end-down' | 'head-end-up' | 'head-end-flat' | 'head-down'
	/** The direction the ink travels through this box, for the hover gradient. */
	readonly gradient?: string
	/** This piece's slice of the source→target fade, in percent: consecutive pieces meet at the same
	 * mixed colour, which is what makes one gradient read as continuous across several boxes. */
	readonly fade?: readonly [number, number]
}

/** The normalized ink strokes, stretched to each piece's box and baked into a mask data-uri (see
 * maskFor). Every dependency path ends on an axis-aligned tangent, so the fixed-rotation arrowhead
 * always matches the arrival angle. Authored in physical LTR: RTL places the box at the mirrored
 * position and the `mirror` class reflects the glyph inside it. */
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

/** A one-device-pixel vein for both kinds: a hairline reads as more precise on a grid this dense than
 * a heavier pale stroke does. Constant across rest, hover and violation alike — weight carries no
 * meaning here (see the styles), so a piece needs only ONE mask. */
const STROKE_WIDTH: Record<'dependency' | 'subtask', number> = { dependency: 1, subtask: 1 }

/** The stroke shape as a mask-image `url()`: the path stroked white, stretched with the box at
 * constant device width, masking a CSS background that is solid at rest and a gradient on hover. An
 * SVG paint-server can't be used instead — it fails inside anchor-positioned elements (see PATHS). */
function maskFor(path: string): string {
	const kind = path.startsWith('subtask') ? 'subtask' : 'dependency'
	const caps = kind === 'dependency' ? 'stroke-linecap="round"' : 'stroke-linecap="butt" stroke-linejoin="miter"'
	// Double quotes inside the SVG so encodeURIComponent escapes them (%22) — the returned url() is
	// wrapped in SINGLE quotes and lands in an HTML style="…" attribute, which mustn't see raw quotes.
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${PATHS[path] ?? ''}" fill="none" stroke="white" stroke-width="${STROKE_WIDTH[kind]}" vector-effect="non-scaling-stroke" ${caps}/></svg>`
	return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`
}

/**
 * The relationship connectors of a calendar view: always-visible arrows between related entry chips,
 * routed from data and placed entirely by anchor() against the chips' own `anchor-name`s — no
 * measurement, no per-frame work. Architecture, platform rules and the ink's channels: AGENTS.md.
 *
 * A view passes the SEGMENTS it rendered inside one CANVAS (plus `verticalRank` where its lanes are
 * JS-known) and mounts this layer as that canvas's LAST child, since anchors must precede the
 * positioned elements in tree order; only chips rendered IN that canvas can take part. Neither this
 * host, the canvas, nor `div.entries` (Day.ts) may be a stacking context, or `--mitra-connection-z`
 * can no longer interleave the pieces with the chips.
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

	/** First-fit lane simulation mirroring CSS `grid-auto-flow: row dense` over the bars in their RENDER
	 * order — for views that pack lanes purely in CSS, so the vertical classifier can still rank them. */
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
		// Edges are gathered from RelationGraph, deduplicated and matched to the appropriate occurrence pair.
		for (const edge of RelationGraph.of([...byEntry.keys()]).edges) {
			const pair = edge.bestPair(byUid.get(edge.from) ?? [], byUid.get(edge.to) ?? [])
			if (!pair) {
				continue
			}
			const { from, to } = pair
			const kind: ConnectorEdge['kind'] = edge.family === 'dependency' ? 'dependency' : 'subtask'
			// Arrows leave the run's last chip in this canvas and arrive at the first.
			const fromSeg = byEntry.get(from)?.at(-1)
			const toSeg = byEntry.get(to)?.[0]
			if (!fromSeg || !toSeg || fromSeg === toSeg) {
				continue
			}
			// Routing remains purely geometric; broken couplings change only ink styling.
			edges.push(this.edge(kind, from, to, fromSeg, toSeg, edge.violatedBy(from, to)))
		}
		return edges
	}

	/**
	 * ROUTES one edge into its pieces from data alone — day column for the inline axis, `rankOf` for the
	 * block axis, never pixels — and purely geometrically: an edge running backward in time draws as
	 * faithfully as a valid one. Forward across columns is one piece, the same column with the target
	 * below is the block-port drop, and everything else is a three-piece LOOP around the pair.
	 */
	private edge(kind: ConnectorEdge['kind'], from: Entry, to: Entry, fromSeg: EntrySegment, toSeg: EntrySegment, violated: boolean): ConnectorEdge {
		const A = `--mitra-entry-segment-${fromSeg.id}`
		const B = `--mitra-entry-segment-${toSeg.id}`
		// The physical words for the logical inline sides, read from computed style (data, not geometry):
		// the router thinks in reading order, and RTL is the same solution mirrored.
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
			key: `${kind}:${fromSeg.id}:${toSeg.id}`, kind, fromEntryId: from.id!, toEntryId: to.id!, pieces, violated,
			...(kind !== 'dependency' ? {} : { fromColor: EntryConnections.colorOf(from), toColor: EntryConnections.colorOf(to) }),
		}
	}

	/** The backward loop, lane BELOW the pair: out of the source's end port, down, back under both chips,
	 * up into the target's start port — four turns in three boxes. The seam sits one corner-radius past
	 * the target's centre line, where the ink runs straight, so a joint never lands inside a turn; the
	 * lane's ordinate is a min()/max() over both anchors, so one lane clears both whatever their heights. */
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
				/* Boxless, and so is each connection: the PIECES are the positioned boxes, and their containing
				   block is the view's canvas — see the class comment. */
				display: contents;

				/* One channel per question — shape says the family, hue the state, alpha and the z-lift the
				   attention, the gradient nothing but the hover payload, and width nothing at all (AGENTS.md).
				   The ink is a MASKED CSS background, not an SVG stroke: a paint-server gradient will not render
				   inside an anchor-positioned element (a Chromium bug). */
				--mitra-connection-ink: color-mix(in srgb, var(--color-text) 45%, transparent);
				--mitra-connection-ink-faint: color-mix(in srgb, var(--color-text) 34%, transparent);
				--mitra-connection-ink-emphasis: color-mix(in srgb, var(--color-text) 85%, transparent);
				--mitra-connection-ink-violation: color-mix(in srgb, var(--color-error) 65%, transparent);
				--mitra-connection-head: 5px;

				> .connection {
					display: contents;

					> .piece {
						position: absolute;
						pointer-events: none;
						/* Interleaves with the chips in the VIEW's stacking context: above the surface (z 1), below
						   the chips (z 2), lowered to 0 by a bar view whose bars sit at z 1. Emphasis lifts above. */
						z-index: var(--mitra-connection-z, 1);

						/* The floor that keeps a degenerate span visible: two anchored edges resolving to the same
						   ordinate leave a 0px box with no area for the stretched ink. Dependencies route those
						   cases exactly; this catches the shapes whose chip heights data cannot know. */
						min-block-size: 3px;

						/* The router places the box at the mirrored position; the LTR-authored glyph inside is
						   reflected to match. Elbows are drawn in logical properties, so only their head turns. */
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

						/* An elbow's line is a PADDING ring: the background covers the padding box, the content box
						   is masked back out, and border-radius (a length) keeps the corner's shape however far the
						   box stretches. Padding, not border: Blink floors border-width to whole pixels. */
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

					/* The fade spans the ROUTE, not each box: a piece paints only its own slice (--_f0..--_f1), so
					   the colour a box ends on is the colour its successor starts from and the seams disappear. */
					&.dependency[data-emphasized]:not([data-violated]) > .piece > .ink {
						background: linear-gradient(var(--_grad-dir, to right),
							color-mix(in srgb, var(--_to) var(--_f0, 0%), var(--_from)),
							color-mix(in srgb, var(--_to) var(--_f1, 100%), var(--_from)));
					}

					/* The arrowhead hangs in the head-sized gap the route left before the target's port, on the
					   FINAL piece only. Fixed rotation is safe: every path ends on an axis-aligned tangent. */
					> .piece:is(.head-end-down, .head-end-up, .head-end-flat, .head-down)::after {
						content: '';
						position: absolute;
						background: var(--mitra-connection-ink);
						transition: background 0.15s ease;
					}

					&[data-emphasized]:not([data-violated]) > .piece::after {
						background: var(--_to, var(--mitra-connection-ink-emphasis));
					}

					/* A broken coupling keeps the neutral ink's whisper and changes only its hue, so a wholly
					   violated chain colours the canvas without alarming it. Declared after the emphasis rules it
					   overrides — it ties with them on specificity. */
					&[data-violated] > .piece > .ink,
					&[data-violated] > .piece::after {
						background: var(--mitra-connection-ink-violation);
					}

					&[data-violated][data-emphasized] > .piece > .ink,
					&[data-violated][data-emphasized] > .piece::after {
						background: var(--color-error);
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
					<div class="connection ${edge.kind}" ?data-emphasized=${emphasized} ?data-violated=${edge.violated}>
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
