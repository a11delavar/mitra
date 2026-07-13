import { Component, component, html, css, property, state, repeat } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { Relation, type Entry } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { type EntrySegment } from './EntrySegment.js'
import { type EntrySegmentComponent } from './EventSegment.js'
import { EntryStore } from './EntryStore.js'

/**
 * One drawable relation edge: which visual it wears and the GRID PLACEMENT that pins it — the same
 * minute-row/day-column tracks the chips themselves are placed on, so it lives in content space and
 * scrolls/zooms/re-lays-out with them natively. JS decides topology (which pairs, which orientation)
 * from data; pixels are entirely the grid's job — no measurement, no per-frame work.
 *
 * Deliberately NOT CSS anchor positioning: anchor() resolves the anchor's scrollport-relative
 * position and compensates for scroll assuming the positioned element does NOT scroll with the
 * content (the popover model, e.g. the entry editor). For an overlay INSIDE the scrolled grid that
 * compensation double-counts and the connector drifts by exactly the scroll delta — and re-parenting
 * outside the scroller fails the anchor-acceptability rule (the anchor must be a descendant of the
 * positioned element's containing block, or the containing block must be the ICB, which would paint
 * above the sticky lanes). Grid placement has none of these failure modes.
 */
interface ConnectorEdge {
	readonly key: string
	readonly kind: 'dependency' | 'subtask'
	readonly orientation: string
	readonly fromEntryId: string
	readonly toEntryId: string
	readonly style: string
}

/** The normalized ink strokes, stretched to each connector's grid box (preserveAspectRatio="none"
 * + non-scaling-stroke keeps the stroke width constant at ANY aspect ratio). Dependencies are S-curves
 * with horizontal end tangents (so the arrowhead's fixed rotation always matches the entry angle);
 * subtasks are sharp elbows. A future Gantt/timeline view or a recurring-series thread is one more
 * row family here plus its orientation classifier — the machinery below doesn't change. */
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

/**
 * The relationship connectors of the week view: thin always-visible arrows between related entry
 * chips — smooth S-curves with an arrowhead for dependencies (predecessor → dependent), sharp hairline
 * elbows for hierarchy (parent → subtask). The host is a grid item over the TIMED region sharing the
 * day tracks via subgrid and the chips' own 1440 fr minute rows; each connector is a grid item placed
 * by (minute, buffer-day-column) — data the renderer already has — with sub-column ports expressed as
 * span-fraction margins. Vertical geometry is thus EXACTLY the chips' (same tracks); horizontal ports
 * are column-derived (center/edges), which matches the chips except when overlap-clustering narrows
 * them — an accepted approximation.
 *
 * Topology comes from data only: visible entries' `relations` (both families, whichever side stored
 * the pointer — see shared/Relation.ts edge helpers), deduplicated per (kind, uid-pair) with the
 * temporally NEAREST visible occurrence pair chosen when a uid resolves to several rows (recurring
 * series materialize the master's relations onto every occurrence). Week-view scope: timed, dated
 * chips only — edges into the sticky all-day lane are skipped (its opaque sticky surface paints
 * above this layer).
 *
 * Hovering an entry chip emphasizes its connectors (stronger ink, lifted above chips); at rest they
 * sit ABOVE the day surface but BELOW every chip. The host must NOT be positioned or z-indexed (it
 * would become a stacking context and trap the connectors' z-index away from the chips' — which is
 * also why `div.entries` must not be a container; see Day.ts): connectors are z 1 vs the chips' z 2,
 * with the host as the LAST child out-painting the z 1 hour lines by tree order.
 */
@component('mitra-entry-connections')
export class EntryConnections extends Component {
	/** Per-view opt-out, persisted; the week view defaults ON — dependencies are meant to be seen. */
	static isEnabledFor(view: 'week') {
		return localStorage.getItem(`Mitra.Connections.${view}`) !== 'false'
	}

	static setEnabledFor(view: 'week', enabled: boolean) {
		localStorage.setItem(`Mitra.Connections.${view}`, String(enabled))
		EntryStore.notify()
	}

	// Re-renders on store notifications, so a relation edit redraws immediately.
	readonly store = new EntryStore(this)

	@property({ type: Array }) entries = new Array<Entry>()
	/** The view's render window — the days that HAVE chips, and their offset into the buffer (the
	 * buffer day at index i occupies the host's subgrid column line i+1). */
	@property({ type: Object }) range?: { days: ReadonlyArray<DateTime>, offset: number }

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
		// The layer itself is pointer-events: none — hover intent is read off the surrounding view.
		this.parentElement?.addEventListener('pointerover', this.handlePointerOver)
	}

	override disconnected() {
		this.parentElement?.removeEventListener('pointerover', this.handlePointerOver)
	}

	/** Chip-bearing entries only: persisted, uid-addressable, timed and dated (all-day lives in the
	 * sticky lane — out of week-view scope), and not a drag ghost. */
	private get eligible(): Array<Entry> {
		return this.entries.filter(entry =>
			entry.persisted && !!entry.uid && !!entry.start && !!entry.end && !entry.allDay && !EntryStore.isPreview(entry))
	}

	private get connectorEdges(): Array<ConnectorEdge> {
		const range = this.range
		if (!range?.days.length) {
			return []
		}
		// Buffer column per rendered day — the same numbering the day columns are placed with.
		const columnByDay = new Map(range.days.map((day, index) => [day.dayStart.valueOf(), range.offset + index]))
		const eligible = this.eligible
		const byUid = new Map<string, Array<Entry>>()
		for (const entry of eligible) {
			const list = byUid.get(entry.uid!) ?? []
			list.push(entry)
			byUid.set(entry.uid!, list)
		}
		/** An entry's slices that actually have a chip in the render window. */
		const visibleSlices = (entry: Entry) =>
			EntrySegments.for(entry).filter(segment => segment.dayValue !== undefined && columnByDay.has(segment.dayValue))

		const edges = new Array<ConnectorEdge>()
		const seen = new Set<string>()
		for (const owner of eligible) {
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
				// A uid can resolve to several visible rows (a recurring series) — connect the
				// temporally nearest owner/target pair, not every combination.
				const owners = byUid.get(owner.uid!) ?? [owner]
				let bestOwner: Entry | undefined
				let bestTarget: Entry | undefined
				let bestDelta = Infinity
				for (const o of owners) {
					for (const t of targets) {
						if (o === t) {
							continue
						}
						const delta = Math.abs(o.start!.valueOf() - t.start!.valueOf())
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
				// The arrow leaves the run's LAST visible chip and arrives at the FIRST.
				const fromSeg = visibleSlices(from).at(-1)
				const toSeg = visibleSlices(to)[0]
				if (!fromSeg || !toSeg || fromSeg === toSeg) {
					continue
				}
				edges.push(EntryConnections.edge(kind, from, to, fromSeg, toSeg, columnByDay))
			}
		}
		return edges
	}

	/** Composes the orientation class + the grid placement for one edge. Rows are the chips' own
	 * minute lines (all days share one 1440-minute scale, so minutes compare across columns and the
	 * vertical ports are EXACT); columns are buffer day tracks, with sub-column ports as fractions of
	 * the spanned width (`--_span` columns — the day tracks are equal-width, so 100%/span is a column).
	 * Reversed minute pairs are fine: grid swaps inverted lines, and the orientation class already
	 * carries the direction for the ink. */
	private static edge(kind: ConnectorEdge['kind'], from: Entry, to: Entry, fromSeg: EntrySegment, toSeg: EntrySegment, columnByDay: ReadonlyMap<number, number>): ConnectorEdge {
		const fromColumn = columnByDay.get(fromSeg.dayValue!)!
		const toColumn = columnByDay.get(toSeg.dayValue!)!
		const head = 'var(--mitra-connection-head)'
		// Below when the target starts after the source ends; on vertical overlap, by midpoints.
		const down = toSeg.startMinute >= fromSeg.endMinute
			|| (toSeg.endMinute > fromSeg.startMinute && toSeg.startMinute + toSeg.endMinute >= fromSeg.startMinute + fromSeg.endMinute)
		let orientation: string
		let style: string
		if (fromColumn === toColumn) {
			orientation = down ? 'down' : 'up'
			const rows = down ? `${fromSeg.endMinute} / ${toSeg.startMinute}` : `${toSeg.endMinute} / ${fromSeg.startMinute}`
			style = kind === 'dependency'
				// A fixed-width bow just left of the chips, the arrowhead hanging in its trailing gap.
				? `grid-row: ${rows}; grid-column: ${fromColumn + 1}; justify-self: start; inline-size: 0.75rem; margin-inline-start: calc(-0.75rem - ${head});`
				// The tree tick: a hairline dropping through the gap between parent and subtask.
				: `grid-row: ${rows}; grid-column: ${fromColumn + 1}; justify-self: start; inline-size: 2px; margin-inline-start: 0.5rem;`
		} else {
			const rightward = toColumn > fromColumn
			orientation = `${rightward ? 'right' : 'left'}-${down ? 'down' : 'up'}`
			const columns = rightward ? `${fromColumn + 1} / ${toColumn + 2}` : `${toColumn + 1} / ${fromColumn + 2}`
			const span = Math.abs(toColumn - fromColumn) + 1
			if (kind === 'dependency') {
				const rows = down ? `${fromSeg.endMinute} / ${toSeg.startMinute}` : `${toSeg.endMinute} / ${fromSeg.startMinute}`
				// From the source column's CENTER to the target chip's near edge, one head short.
				const margins = rightward
					? `margin-inline-start: calc(100% / (2 * var(--_span))); margin-inline-end: calc(100% / var(--_span) + ${head});`
					: `margin-inline-end: calc(100% / (2 * var(--_span))); margin-inline-start: calc(100% / var(--_span) + ${head});`
				style = `grid-row: ${rows}; grid-column: ${columns}; --_span: ${span}; ${margins}`
			} else {
				// The elbow: drop from just inside the parent's leading edge to the subtask's mid-height,
				// then across into its near edge.
				const toMid = Math.round((toSeg.startMinute + toSeg.endMinute) / 2)
				const rows = down ? `${fromSeg.endMinute} / ${toMid}` : `${toMid} / ${fromSeg.startMinute}`
				const margins = rightward
					? 'margin-inline-start: 0.5rem; margin-inline-end: calc(100% / var(--_span) + 2px);'
					: 'margin-inline-end: calc(100% / var(--_span) - 0.5rem); margin-inline-start: calc(100% / var(--_span) + 2px);'
				style = `grid-row: ${rows}; grid-column: ${columns}; --_span: ${span}; ${margins}`
			}
		}
		return { key: `${kind}:${fromSeg.id}:${toSeg.id}`, kind, orientation, fromEntryId: from.id!, toEntryId: to.id!, style }
	}

	static override get styles() {
		return css`
			mitra-entry-connections {
				/* The timed region, on the SAME tracks as the chips: the day columns via subgrid, the
				   1440 fr minute rows (see the .axis rule in Days.ts for why fr). Content space — it
				   scrolls, zooms and re-lays-out with the chips by construction. Deliberately NOT
				   positioned/z-indexed: a stacking context here would trap the connectors' z-index
				   away from the chips' (z 2). */
				grid-row: 3;
				grid-column: calc(-1 * var(--_days-length) - 1) / -1;
				display: grid;
				grid-template-rows: repeat(1440, minmax(0, 1fr));
				grid-template-columns: subgrid;
				pointer-events: none;

				/* The connector ink: neutral on purpose — endpoints can wear different colors, and the
				   lines must whisper ("noticed only if you look; once seen, cannot unsee"). A future
				   series-thread variant may override --_ink per connector with an entry color. */
				--mitra-connection-ink: color-mix(in srgb, var(--color-text) 34%, transparent);
				--mitra-connection-ink-faint: color-mix(in srgb, var(--color-text) 26%, transparent);
				--mitra-connection-ink-emphasis: color-mix(in srgb, var(--color-text) 85%, transparent);
				--mitra-connection-head: 5px;

				> .connection {
					position: relative;
					pointer-events: none;
					min-block-size: 0;
					min-inline-size: 0;
					/* Above the day surface and hour lines (z 1 too, but this layer is the LAST child),
					   below every chip (z 2) — the "threads behind the fabric" reading. Emphasis lifts
					   above the chips. */
					z-index: 1;
					--_ink: var(--mitra-connection-ink);
					--_stroke: 1.5;

					> svg {
						display: block;
						inline-size: 100%;
						block-size: 100%;
						overflow: visible;

						> path {
							fill: none;
							stroke: var(--_ink);
							stroke-width: calc(var(--_stroke) * 1px);
							stroke-linecap: round;
							transition: stroke 0.15s ease;
						}
					}

					&.subtask {
						--_ink: var(--mitra-connection-ink-faint);
						--_stroke: 1;

						> svg > path {
							stroke-linejoin: miter; /* the elbows stay SHARP — that's their signature */
							stroke-linecap: butt;
						}
					}

					&[data-emphasized] {
						z-index: 3;
						--_ink: var(--mitra-connection-ink-emphasis);
						--_stroke: 2;

						&.subtask {
							--_stroke: 1.5;
						}
					}

					/* The dependency arrowhead: a CSS triangle hung in the head-sized gap the margins
					   left before the target chip, vertically centered on the path's end. Fixed
					   rotation is safe: every dependency path ends with a horizontal tangent. */
					&.dependency::after {
						content: '';
						position: absolute;
						inline-size: var(--mitra-connection-head);
						block-size: calc(var(--mitra-connection-head) + 2px);
						background: var(--_ink);
						transition: background 0.15s ease;
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
			${repeat(this.connectorEdges, edge => edge.key, edge => html`
				<div class="connection ${edge.kind} ${edge.orientation}" style=${edge.style}
					?data-emphasized=${!!this.hoveredEntryId && (edge.fromEntryId === this.hoveredEntryId || edge.toEntryId === this.hoveredEntryId)}>
					<svg viewBox="0 0 100 100" preserveAspectRatio="none">
						<path d=${PATHS[`${edge.kind}:${edge.orientation}`] ?? ''} vector-effect="non-scaling-stroke"></path>
					</svg>
				</div>
			`)}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-connections': EntryConnections
	}
}
