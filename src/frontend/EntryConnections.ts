import { Component, component, html, css, property, state, repeat } from '@a11d/lit'
import { Relation, type Entry } from 'shared'
import { type EntrySegment } from './EntrySegment.js'
import { type EntrySegmentComponent } from './EventSegment.js'
import { getSource } from './Api.js'
import { EntryStore } from './EntryStore.js'

/**
 * One drawable relation edge: which chips it spans (as anchor() references), which visual it wears,
 * and the composed inset styles. JS decides topology (which pairs, which orientation) from data;
 * pixels are entirely CSS anchor positioning's job — no measurement, no per-frame work.
 *
 * The anchor() usage is only sound because of the CANVAS topology (see Days.ts): the connectors'
 * containing block is a POSITIONED wrapper that co-scrolls with — and CONTAINS — the chips, so no
 * scroll container sits between an anchor and the containing block. Anchored against the scroller
 * itself instead, Chromium snapshots the anchor's scrollport-relative position and live-compensates
 * for scroll as if the connector did NOT scroll with the content (the popover model — measured: used
 * inset frozen at −3112.97px while the box drifted by exactly the scroll delta). And hoisting the
 * layer outside fails anchor ACCEPTABILITY (anchors must be descendants of the containing block).
 */
interface ConnectorEdge {
	readonly key: string
	readonly kind: 'dependency' | 'subtask'
	readonly orientation: string
	readonly fromEntryId: string
	readonly toEntryId: string
	readonly style: string
	/** The endpoints' presented colors — the hover gradient's stops (dependencies only). */
	readonly fromColor?: string
	readonly toColor?: string
}

/** The normalized ink strokes, stretched to each connector's anchored box (preserveAspectRatio="none"
 * + non-scaling-stroke keeps the stroke width constant at ANY aspect ratio). Dependencies are S-curves
 * with horizontal end tangents (so the arrowhead's fixed rotation always matches the entry angle);
 * subtasks are sharp elbows. These are baked into a MASK data-uri (see maskFor): the ink is a masked
 * CSS background, NOT an SVG stroke — SVG paint-servers (a gradient stroke/fill) silently fail to
 * render inside a CSS-anchor-positioned element (a Chromium bug; solid strokes and CSS backgrounds/
 * masks are immune), and the hover ink is a source→target CSS gradient. A future Gantt/timeline
 * variant is one more row family here plus its orientation strategy — the machinery doesn't change. */
const PATHS: Record<string, string> = {
	'dependency:right-down': 'M 0 0 C 50 0 50 100 100 100',
	'dependency:right-up': 'M 0 100 C 50 100 50 0 100 0',
	'dependency:left-down': 'M 100 0 C 50 0 50 100 0 100',
	'dependency:left-up': 'M 100 100 C 50 100 50 0 0 0',
	'dependency:down': 'M 100 0 C 0 0 0 100 100 100',
	'dependency:up': 'M 100 100 C 0 100 0 0 100 0',
	'subtask:right-down': 'M 0 0 V 100 H 100',
	'subtask:right-up': 'M 0 100 V 0 H 100',
	'subtask:left-down': 'M 100 0 V 100 H 0',
	'subtask:left-up': 'M 100 100 V 0 H 0',
	'subtask:down': 'M 50 0 V 100',
	'subtask:up': 'M 50 100 V 0',
}

/** The hover gradient's CSS direction per orientation: from the SOURCE end of the path to the TARGET
 * end, so the ink fades source-color → target-color. */
const GRADIENT_DIRECTIONS: Record<string, string> = {
	'right-down': 'to bottom right',
	'right-up': 'to top right',
	'left-down': 'to bottom left',
	'left-up': 'to top left',
	'down': 'to bottom',
	'up': 'to top',
}

/** Constant device stroke width per kind (dependencies read a touch heavier than the subtask
 * hairline). Fixed across rest/hover — emphasis is carried by color and z-lift, not thickness — so a
 * connector needs only ONE mask. */
const STROKE_WIDTH: Record<'dependency' | 'subtask', number> = { dependency: 1.75, subtask: 1.25 }

/** The stroke shape as a mask-image `url()`: a white stroke of the normalized path, stretched with the
 * box (`preserveAspectRatio="none"`) at constant device width (`non-scaling-stroke`). The masked
 * element's CSS background (solid at rest, a gradient on hover) shows through only along the stroke —
 * an SVG paint-server can't be used here (it fails inside anchor-positioned elements; see PATHS). */
function maskFor(kind: 'dependency' | 'subtask', orientation: string): string {
	const d = PATHS[`${kind}:${orientation}`] ?? ''
	const caps = kind === 'dependency' ? 'stroke-linecap="round"' : 'stroke-linecap="butt" stroke-linejoin="miter"'
	// Double quotes inside the SVG so encodeURIComponent escapes them (%22) — the returned url() is
	// wrapped in SINGLE quotes and lands in an HTML style="…" attribute, which mustn't see raw quotes.
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="white" stroke-width="${STROKE_WIDTH[kind]}" vector-effect="non-scaling-stroke" ${caps}/></svg>`
	return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`
}

/**
 * The relationship connectors of a calendar view: thin always-visible arrows between related entry
 * chips — smooth S-curves with an arrowhead for dependencies, sharp hairline elbows (no arrowhead)
 * for hierarchy. Each connector is an absolutely-positioned box whose insets reference the two chips'
 * existing `anchor-name`s (published by EventSegment for its editor popover), so its geometry —
 * including overlap-narrowed chip widths and CSS-auto-packed lanes JS never sees — tracks the REAL
 * chip boxes with zero measurement.
 *
 * VIEW-AGNOSTIC by design: a view passes exactly the SEGMENTS it rendered inside one CANVAS (a
 * positioned wrapper that co-scrolls with and contains those chips — the week grid's `div.canvas`,
 * the sticky all-day lane, the month grid's `div.canvas`) and mounts this layer as the canvas's LAST
 * child (anchors must precede the positioned elements in tree order). Bar-shaped views additionally
 * pass `verticalRank` (their JS-known lane/slot order — month slots, simulated all-day lanes) since
 * a bar's vertical position isn't derivable from its times; the timed grid defaults to minute math.
 *
 * PORTS are unified: a dependency always leaves the source's inline-end CENTER and arrives at the
 * target's inline-start CENTER (mirrored for backward edges — leaving inline-start, arriving
 * inline-end — so the arrow always exits the side facing its target); same-column pairs bow out on
 * the inline-start side, center to center. A subtask elbow drops from the parent's bottom
 * inline-start (indented 0.5rem) into the child's inline-start center.
 *
 * Topology comes from data only: the segments' entries' `relations` (both families, whichever side
 * stored the pointer — see shared/Relation.ts edge helpers), deduplicated per (kind, uid-pair) with
 * the temporally NEAREST pair chosen when a uid resolves to several rows (recurring series
 * materialize the master's relations onto every occurrence). Edges leave each canvas's realm
 * implicitly: only chips rendered IN this canvas participate, so timed↔all-day cross-realm edges
 * are skipped (the lane's sticky surface also paints above the timed layer).
 *
 * Hovering an entry chip emphasizes its connectors — stronger ink, lifted above chips, and a
 * dependency's stroke becomes a source-color → target-color gradient. Neither this host, the canvas,
 * nor `div.entries` (Day.ts) may be a stacking context: the connectors' z-index (--mitra-connection-z,
 * default 1) must interleave with the chips' in the view's own context.
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
	 * their RENDER ORDER (each an inclusive [start, end] column span) — the week's all-day lane packs
	 * purely in CSS, so its lane order is re-derived here for the vertical-orientation classifier. */
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
				const family = Relation.familyOf(relation.type)
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
					const edge = Relation.hierarchyEdge(bestOwner.uid!, relation)
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

	/** Composes the orientation class + the anchor()-referencing insets for one edge, under the
	 * unified port rules (see the class doc). The spanned box loses which corner is which endpoint,
	 * so the classifier — day column for the inline axis, `rankOf` for the block axis, data never
	 * pixels — decides which anchor edge feeds which inset. */
	private edge(kind: ConnectorEdge['kind'], from: Entry, to: Entry, fromSeg: EntrySegment, toSeg: EntrySegment): ConnectorEdge {
		const A = `--mitra-entry-segment-${fromSeg.id}`
		const B = `--mitra-entry-segment-${toSeg.id}`
		const dayDelta = toSeg.dayValue! - fromSeg.dayValue!
		const head = 'var(--mitra-connection-head)'
		const down = this.rankOf(toSeg) >= this.rankOf(fromSeg)
		// Side ports need clear water between the columns: a multi-day BAR whose span reaches the
		// other endpoint's column would invert the spanned box (and clamp it away) — those pairs
		// take the same-column treatment instead.
		const overlapping = dayDelta > 0
			? toSeg.dayValue! <= (fromSeg.runEnd.dayValue ?? fromSeg.dayValue!)
			: dayDelta < 0 ? (toSeg.runEnd.dayValue ?? toSeg.dayValue!) >= fromSeg.dayValue! : true
		let orientation: string
		let style: string
		if (kind === 'dependency') {
			// Center-to-center on the block axis, side-to-side on the inline axis.
			const vertical = down
				? `top: anchor(${A} 50%); bottom: anchor(${B} 50%);`
				: `top: anchor(${B} 50%); bottom: anchor(${A} 50%);`
			if (overlapping) {
				// Same column: a fixed-width bow out the inline-start side, center to center.
				orientation = down ? 'down' : 'up'
				style = `${vertical} left: calc(anchor(${B} left) - 0.75rem - ${head}); inline-size: 0.75rem;`
			} else {
				orientation = `${dayDelta > 0 ? 'right' : 'left'}-${down ? 'down' : 'up'}`
				style = dayDelta > 0
					? `${vertical} left: anchor(${A} right); right: calc(anchor(${B} left) + ${head});`
					: `${vertical} right: anchor(${A} left); left: calc(anchor(${B} right) + ${head});`
			}
		} else {
			// The elbow: drop from the parent's bottom inline-start (indented) into the child's
			// inline-start center — the Notion tree line, unrolled.
			const drop = `calc(anchor(${A} left) + 0.5rem)`
			if (overlapping) {
				// Same column: a bare tick through the gap between the two chips.
				orientation = down ? 'down' : 'up'
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} top);`
					: `top: anchor(${B} bottom); bottom: anchor(${A} top);`
				style = `${vertical} left: calc(${drop} - 1px); inline-size: 2px;`
			} else {
				orientation = `${dayDelta > 0 ? 'right' : 'left'}-${down ? 'down' : 'up'}`
				const vertical = down
					? `top: anchor(${A} bottom); bottom: anchor(${B} 50%);`
					: `top: anchor(${B} 50%); bottom: anchor(${A} top);`
				style = dayDelta > 0
					? `${vertical} left: ${drop}; right: calc(anchor(${B} left) + 2px);`
					: `${vertical} right: calc(anchor(${A} left) - 0.5rem); left: calc(anchor(${B} right) + 2px);`
			}
		}
		return {
			key: `${kind}:${fromSeg.id}:${toSeg.id}`, kind, orientation, fromEntryId: from.id!, toEntryId: to.id!, style,
			...(kind !== 'dependency' ? {} : { fromColor: EntryConnections.colorOf(from), toColor: EntryConnections.colorOf(to) }),
		}
	}

	/** The chip's presented color — its own, else its calendar's (the same resolution EventSegment uses). */
	private static colorOf(entry: Entry): string {
		return entry.color || getSource(entry.sourceId)?.color || 'var(--color-text)'
	}

	static override get styles() {
		return css`
			mitra-entry-connections {
				/* Boxless: the connectors are absolutely positioned children whose containing block is
				   the view's CANVAS (the positioned, co-scrolling wrapper around the chips — Days.ts),
				   which is what makes their anchor() references track the real chip boxes with no
				   scroll compensation in play. */
				display: contents;

				/* The connector ink: neutral on purpose — endpoints can wear different colors, and the
				   lines must whisper ("noticed only if you look; once seen, cannot unsee"). Hover
				   emphasis is where color enters: a dependency's ink becomes a source→target gradient
				   (the per-connector --_from/--_to/--_grad-dir below). The ink is a MASKED CSS
				   background, not an SVG stroke — an SVG paint-server gradient won't render inside an
				   anchor-positioned element (a Chromium bug), whereas CSS backgrounds/masks do. */
				--mitra-connection-ink: color-mix(in srgb, var(--color-text) 34%, transparent);
				--mitra-connection-ink-faint: color-mix(in srgb, var(--color-text) 26%, transparent);
				--mitra-connection-ink-emphasis: color-mix(in srgb, var(--color-text) 85%, transparent);
				--mitra-connection-head: 5px;

				> .connection {
					position: absolute;
					pointer-events: none;
					/* Interleaves with the view's chips in ITS stacking context: default above the
					   surface/hour lines (z 1, canvas painted last) and below chips (z 2); the all-day
					   lane's bars sit at z 1, so the lane lowers this to 0. Emphasis lifts above. */
					z-index: var(--mitra-connection-z, 1);

					/* The line: a solid neutral background clipped to the stroke shape by --_mask (a
					   per-orientation data-uri set inline; see maskFor). */
					> .ink {
						position: absolute;
						inset: 0;
						background: var(--mitra-connection-ink);
						-webkit-mask: var(--_mask) no-repeat center / 100% 100%;
						mask: var(--_mask) no-repeat center / 100% 100%;
						transition: background 0.15s ease;
					}

					&.subtask > .ink {
						background: var(--mitra-connection-ink-faint);
					}

					&[data-emphasized] {
						z-index: var(--mitra-connection-z-emphasis, 3);

						> .ink {
							background: var(--mitra-connection-ink-emphasis);
						}

						/* A dependency emphasizes into the source→target color gradient. */
						&.dependency > .ink {
							background: linear-gradient(var(--_grad-dir, to right), var(--_from), var(--_to));
						}
					}

					/* The dependency arrowhead: a CSS triangle hung in the head-sized gap the insets
					   left before the target chip, vertically centered on the path's end. Fixed
					   rotation is safe: every dependency path ends with a horizontal tangent. On
					   emphasis it adopts the gradient's arrival color — the target's. */
					&.dependency::after {
						content: '';
						position: absolute;
						inline-size: var(--mitra-connection-head);
						block-size: calc(var(--mitra-connection-head) + 2px);
						background: var(--mitra-connection-ink);
						transition: background 0.15s ease;
					}

					&[data-emphasized].dependency::after {
						background: var(--_to, var(--mitra-connection-ink-emphasis));
					}

					&.right-down::after, &.right-up::after, &.down::after, &.up::after {
						clip-path: polygon(0 0, 100% 50%, 0 100%);
						right: calc(-1 * var(--mitra-connection-head));
					}

					&.left-down::after, &.left-up::after {
						clip-path: polygon(100% 0, 0 50%, 100% 100%);
						left: calc(-1 * var(--mitra-connection-head));
					}

					&.right-down::after, &.left-down::after, &.down::after {
						bottom: calc((var(--mitra-connection-head) + 2px) / -2);
					}

					&.right-up::after, &.left-up::after, &.up::after {
						top: calc((var(--mitra-connection-head) + 2px) / -2);
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			${repeat(this.connectorEdges, edge => edge.key, edge => {
				const emphasized = !!this.hoveredEntryId && (edge.fromEntryId === this.hoveredEntryId || edge.toEntryId === this.hoveredEntryId)
				const mask = `--_mask: ${maskFor(edge.kind, edge.orientation)};`
				// Dependencies carry the hover gradient's direction + endpoint colors.
				const gradient = edge.kind !== 'dependency' ? '' : ` --_grad-dir: ${GRADIENT_DIRECTIONS[edge.orientation] ?? 'to right'}; --_from: ${edge.fromColor}; --_to: ${edge.toColor};`
				return html`
					<div class="connection ${edge.kind} ${edge.orientation}" style="${edge.style} ${mask}${gradient}"
						?data-emphasized=${emphasized}>
						<div class="ink"></div>
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
