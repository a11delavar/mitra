import { component, html, property, Component, css, state, bind, queryConnectedInstances, eventListener, unsafeCSS } from '@a11d/lit'
import { TaskStatus } from '../Entry.js'
import { type EntrySegment } from './EntrySegment.js'
import { type RoutineRun } from '../../recurrence/client/Routines.js'
import { contrastColor } from '../../../design/contrastColor.js'
import { getSource, getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'

@component('mitra-entry-segment')
export class EntrySegmentComponent extends Component {
	@queryConnectedInstances() private static readonly instances: Set<EntrySegmentComponent>

	readonly store = new EntryStore(this)

	@property({ type: Object }) segment?: EntrySegment

	private get anchorName() {
		return `--mitra-entry-segment-${this.segment?.id}`
	}

	@state({
		updated(this: EntrySegmentComponent, open: boolean, wasOpen: boolean) {
			// Highlight every day-segment of the same (possibly multi-day) entry while its editor is open.
			EntrySegmentComponent.instances.forEach(i => {
				if (i.segment?.entry.id === this.segment?.entry.id) {
					i.selected = open
				}
			})
			// Closing an untitled, never-saved draft discards it — it was only a local placeholder.
			const entry = this.segment?.entry
			if (wasOpen && !open && entry && !entry.persisted && !entry.heading?.trim()) {
				EntryStore.discardDraft()
			}
		}
	}) open = false

	@property({ type: Boolean, reflect: true }) selected = false

	/** When set, renders as hairline marks across its active days instead of a bar (see AGENTS.md "Routines"). */
	@property({ type: Object }) routine?: RoutineRun

	/** 1-based day columns within this element's span where marks should render. */
	@property({ type: Array }) ticks?: ReadonlyArray<number>

	/** The axis this segment can be resized along — `block` (timed grid, top/bottom handles) or `inline`
	 * (all-day lane / month bar, leading/trailing handles). Unset means not resizable. Set by the view; the
	 * gesture itself is driven by the container's `EntryDragController`, which also owns tap-to-open. */
	@property() resize?: 'block' | 'inline'

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		e.stopPropagation()
		this.open = true
	}

	// The checkbox mutated `entry.status` in place: render it everywhere this frame, then persist.
	private readonly handleStatusChange = () => {
		EntryStore.notify()
		const entry = this.segment?.entry
		if (entry?.persisted) {
			EntryStore.commit(entry).catch(() => void 0)
		}
	}

	// Reflect the entry's draft-ness (no id yet) onto the host for the dashed CSS, and pop the freshly-
	// dropped draft's editor open once — only on its run-start segment, so a multi-day draft (sliced into
	// several day-segments) opens a single editor. Runs every update since the draft store, not a property
	// of this component, drives it. (Closing a draft is handled by the `open` state's callback.)
	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		const entry = this.segment?.entry
		if (!entry) {
			return
		}
		// Track the segment's id on the host (its anchor identity) on every update, not only when
		// `segment` changes — so it re-syncs when a draft is assigned its id in place on save, keeping
		// the open editor's `position-anchor` matched. (No view-transition-name here: a permanent name
		// on every segment made every transition capture the whole rendered range — names are assigned
		// just-in-time, viewport-bounded, by calendarTransition.ts, and only for a transition's lifetime.)
		this.style.anchorName = this.anchorName
		this.toggleAttribute('data-draft', !entry.persisted)
		this.toggleAttribute('data-routine', !!this.routine)
		// Title on host: inner nodes of a 2px element are impractical hover targets.
		this.title = !this.routine ? '' : [entry.heading, entry.recurrence?.describe(entry.seriesStart)].filter(Boolean).join(' · ')
		// A live resize and a move's ghost float above their cluster; a move's origin dims in place.
		this.toggleAttribute('dragging', this.store.isDragging(entry) || this.store.isPreview(entry))
		this.toggleAttribute('drag-source', this.store.isDragSource(entry))
		if (entry.type.isTask) {
			this.setAttribute('data-status', entry.status ?? 'todo')
			const progress = entry.progress
			if (progress !== undefined) {
				this.setAttribute('data-progress', '')
				this.style.setProperty('--mitra-entry-progress', `${Math.round(progress * 100)}%`)
			} else {
				this.removeAttribute('data-progress')
				this.style.removeProperty('--mitra-entry-progress')
			}
		} else {
			this.removeAttribute('data-status')
			this.removeAttribute('data-progress')
			this.style.removeProperty('--mitra-entry-progress')
		}
		// A freshly dropped draft, or an entry the palette navigated to, asked for its editor — open it
		// on the run-start segment only, so a multi-day entry opens one editor, and consume the request.
		if (EntryEditorIntent.shouldOpen(entry) && !this.segment!.hasPrevious) {
			EntryEditorIntent.consume()
			this.open = true
		}
	}

	static override get styles() {
		return css`
			mitra-entry-segment {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				/* Equal on BOTH axes, so whatever leads the first line — a task's mark especially — is inset
				   the same from the top edge as from the inline-start one. Reached by tightening the inline
				   padding rather than growing the block padding: the short blocks a zoomed-out week produces
				   have no vertical room to give, and the 3px accent edge already provides the inline gutter.
				   (It also used to carry no bottom padding at all, which reads as a deliberate top-anchor only
				   while the content fills the box — on a short block it just hung the title off the ceiling.) */
				padding: 0.125rem;
				/* An entry's own colour IS the accent for everything that entry owns: the chosen row and tick
				   of a status menu opened on the chip, and — since the editor renders inside this element
				   and inherits it — its switches, fields and text selection too. It lived on the editor
				   alone, which is why the SAME menu came up in the entry's colour when opened there and in
				   ambient grey when alt-clicked on the chip. One declaration, on the element that owns the
				   entry's identity, so every surface the entry opens is accented the same however it opened. */
				--color-accent: var(--mitra-entry-segment-color);
				/* The tinted glass EVERY surface an entry opens is made of — the editor, its field pickers,
				   the time-zone picker, a status menu — so that nested surfaces read as one plane, which is
				   what those places each said in a comment while re-typing this same formula (eight copies
				   of it). One definition here, where the entry's colour is; a surface just uses it, and a
				   NEW surface gets it right by default instead of having to remember the recipe. */
				--mitra-entry-surface: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
				--segment-bg: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
				background-color: var(--segment-bg);
				border-inline-start: 3px solid var(--mitra-entry-segment-color);
				border-radius: var(--border-radius);
				color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, var(--color-text));
				font-size: 0.7rem;
				margin-top: 1px;
				min-height: 0;

				/* Collision Overlap Logic */
				--overlap-s: var(--overlap-slot, 0);
				--overlap-t: var(--overlap-total, 1);
				--overlap-sp: var(--overlap-span, 1);
				/* A contained, late-enough-starting segment floats above its host (see EntrySegments'
				   overlay pre-pass): indented one step per nesting level within the host's own column,
				   flush with its trailing edge, so the host keeps its full width and readable title. */
				--overlap-i: var(--overlap-inset, 0);
				--overlap-indent: calc(var(--overlap-i) * 0.75rem);

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100% + var(--overlap-indent));
				/* The second term also reserves the day's create-gutter (see .entries in Day.ts) — every
				   box's trailing edge stops short of the column edge, keeping a drag-to-create strip. */
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem - var(--overlap-indent)), calc(100% - (var(--overlap-s) / var(--overlap-t)) * 100% - var(--overlap-indent) - var(--_edge-gutter, 0px)));
				z-index: calc(var(--overlap-s) + 1 + var(--overlap-i));
				box-sizing: border-box;
				container-type: size;
				position: relative;
				/* clip, not hidden: hidden makes the block a scroll container, which would capture the
				   sticky labels inside it (see Day.ts) and turn them into no-ops. clip crops identically
				   without creating one — the same trick the all-day lane's bars use in Days.ts. */
				overflow: clip;
				overflow-clip-margin: border-box;
				transition: background-color 0.15s ease, color 0.15s ease;

				/* Covering must not hide: any box painting over another (a cascade row over its base, a
				   fresh block over a poking tail) becomes translucent glass — the covered surface shows
				   through, blurred and dimmed, so depth is legible from the content itself rather than
				   from a drawn edge. The same frosted language the app's popovers and menus speak. The
				   shadow only grounds it; there is deliberately no ring, hairline, or outline. */
				&[data-covers] {
					--segment-bg: color-mix(in srgb, var(--mitra-entry-segment-color) 38%, color-mix(in srgb, var(--color-background) 55%, transparent));
					background-color: var(--segment-bg);
					backdrop-filter: blur(6px) saturate(130%);
					box-shadow: 0 2px 8px rgb(0 0 0 / 0.18);
				}

				/* While actively manipulated (a live resize, or a move's dashed ghost), float full-width above
				   the cluster instead of re-flowing with it each frame. Overriding the derived vars (not the
				   inline --overlap-slot etc.) wins on specificity, so no !important is needed. */
				&[dragging] {
					z-index: 9999;
					--overlap-s: 0;
					--overlap-t: 1;
					--overlap-sp: 1;
					--overlap-i: 0;
				}

				/* The origin of an in-progress move: stays in place, dimmed, as the reference the user is
				   dragging away from — the dashed ghost is what tracks the pointer. */
				&[drag-source] {
					opacity: 0.4;
				}

				/* Resize handles: 0.25rem strips at the run's real edges, hidden where the edge is clipped or
				   interior to a multi-day run (the has-previous/has-next attributes mean exactly that). */
				> .resize-start, > .resize-end {
					position: absolute;
					z-index: 3;
				}

				&[resize=block] {
					> .resize-start, > .resize-end {
						inset-inline: 0;
						block-size: min(0.25rem, 30%);
						cursor: ns-resize;
					}
					> .resize-start { inset-block-start: 0; }
					> .resize-end { inset-block-end: 0; }
				}

				&[resize=inline] {
					> .resize-start, > .resize-end {
						inset-block: 0;
						inline-size: 0.25rem;
						cursor: ew-resize;
					}
					> .resize-start { inset-inline-start: 0; }
					> .resize-end { inset-inline-end: 0; }
				}

				&[has-previous] > .resize-start { display: none; }
				&[has-next] > .resize-end { display: none; }

				/* Too short for top+bottom handles plus a grab band — resize from the editor instead. */
				@container (max-height: 1.5rem) {
					&[resize=block] > .resize-start, &[resize=block] > .resize-end { display: none; }
				}

				&:not([data-draft]):has([popover]:popover-open),
				&:not([data-draft])[selected],
				&[data-connect=target] {
					--segment-bg: var(--mitra-entry-segment-color);
					background-color: var(--segment-bg);
					color: ${contrastColor('var(--mitra-entry-segment-color)')};
				}

				&[data-connect=reject] {
					cursor: not-allowed;
				}

				@container (max-height: 450px) {
					flex-direction: row;
					align-items: center;
					gap: 0.25rem;
					padding: 0 0.375rem;
				}

				&[data-draft] {
					border: 2px dashed var(--mitra-entry-segment-color);
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 15%, transparent);
					color: var(--mitra-entry-segment-color);
				}

				&[has-next] {
					border-end-start-radius: 0;
					border-end-end-radius: 0;
					padding-bottom: 0;

					@container (max-height: 450px) {
						border-start-end-radius: 0;
						border-end-end-radius: 0;
						border-bottom: none;
						margin-inline-end: -0.25rem;
						padding-inline-end: 0.5rem;
					}
				}

				&[has-previous] {
					border-start-start-radius: 0;
					border-start-end-radius: 0;
					padding-top: 0;

					@container (max-height: 450px) {
						border-start-start-radius: 0;
						border-end-start-radius: 0;
						border-top: none;
						margin-inline-start: -0.25rem;
						padding-inline-start: 0.5rem;
					}
				}

				& > .heading {
					font-weight: 600;
					white-space: normal;
					word-break: break-word;
					line-height: 1.1;

					/* Two plain rows: the header strip (the task mark and the time, ordinary flex items that
					   can neither overlap a sibling nor bend any line's height) and the title at full width
					   beneath it. Nothing here floats: a float's box and the line beside it must agree on
					   their height to the pixel or the float overhangs into the title — that coupling is what
					   this strip replaces. */
					display: flex;
					flex-direction: column;

					/* The mark's box and glyph (IconButton's 2rem floor would burst all but the tallest
					   chips, so this stands in for it). In timed segments with time text, 0.8125rem balances
					   with the time header. In single-line/all-day bars, 0.875rem balances with the title. */
					--header-line: 0.8125rem;
					--header-mark: 0.8125rem;

					@media (pointer: coarse) {
						--header-line: 0.9375rem;
						--header-mark: 0.9375rem;
					}

					> .header {
						display: flex;
						align-items: center;
						min-width: 0;

						> mitra-task-status {
							flex-shrink: 0;
							block-size: var(--header-line);
							inline-size: var(--header-line);
							margin-inline-end: 0.25rem;
							align-items: center;
							justify-content: center;
							/* An inline-flex box holding no text baselines on its BOTTOM edge, so it sat ON
							   the title's baseline and hung the whole line low. Inert while the mark is a
							   flex item. */
							vertical-align: middle;

							> :is(button, mitra-icon-button) {
								font-size: var(--header-mark);
								block-size: 100%;
								inline-size: 100%;
								--icon-button-size: 0;
							}

							/* A single-line bar only a few characters wide — the year grid's day cells, a phone's
							   month bars — has nothing left for the title once the control takes its ~1.2rem. The
							   title wins there: it is what identifies the entry, Done/Cancelled still read from
							   the strike-through, and the control itself is one tap away in the editor. */
							@container (max-width: 3.5rem) and (max-height: 2rem) {
								display: none;
							}
						}

						> .time {
							opacity: 0.75;
							font-size: 0.65rem;
							white-space: nowrap;
							margin-inline-end: 0.25rem;
							/* Longer than the strip is wide: clipped in place like the title beneath it — never
							   wrapped, dropped under the mark, or overflowed across the chip's edge. Applies in
							   the strip only (a flex item is a box; the inline fallback below isn't one). */
							overflow: clip;

							/* THE decision about whether an entry can carry its time at all, made once here from
							   the entry's OWN box — never from which view it is in. Neither the height to stack
							   it nor the width to inline it means it goes: the title identifies the entry, the
							   time does not, and on a phone's month bar there is barely room for the title
							   alone. Both dimensions in one query, so no view has to re-decide this. */
							@container (max-height: 2rem) and (max-width: 7rem) {
								display: none;
							}

							> .separator, > .end {
								@container (max-height: 2rem) {
									display: none;
								}
							}
						}
					}

					> .label {
						min-width: 0;
					}

					/* Out of height for two rows: one plain line of inline content — mark, time, title on a
					   shared baseline. Dissolving the strip (contents) rather than restyling it keeps this
					   mode what it always was, a simple text line: the views' own heading-level nowrap and
					   ellipsis overrides (month bars, the all-day lane's sticky titles) act on it directly. */
					@container (max-height: 2rem) {
						display: block;
						min-width: 0;
						--header-line: 0.875rem;
						--header-mark: 0.875rem;
						/* One line in a box with room to spare: centre it rather than hanging it from the top
						   edge. Resolves to 0 the moment the content is taller than the box. */
						margin-block: auto;

						> .header {
							display: contents;

							> mitra-task-status {
								vertical-align: -0.125em;
							}
						}
					}

					@container (max-height: 1rem) {
						white-space: nowrap;
					}

					@container (max-height: 0.5rem) {
						display: none;
					}
				}

				/* The strip exists to seat the time ABOVE the title; with no time there is no second row
				   to make, so it dissolves into one line. The short-block tier's shape, reached for the
				   other reason — not "no room" but "no second thing". */
				&:not(:has(> .heading > .header > .time)) > .heading {
					display: block;
					min-width: 0;
					--header-line: 0.875rem;
					--header-mark: 0.875rem;

					> .header {
						display: contents;

						> mitra-task-status {
							vertical-align: -0.125em;
						}
					}
				}

				&[data-status=${unsafeCSS(TaskStatus.Done)}], &[data-status=${unsafeCSS(TaskStatus.Cancelled)}] {
					& > .heading > .label {
						opacity: 0.6;
						text-decoration: line-through;
					}
				}

				/* Dropped once the block runs out of height for a third line. An opt-DOWN for the same
				   reason the mark's size above is: where the chip's height is free, every height query
				   reads false and this row should still be there. */
				& > .location {
					display: flex;
					align-items: center;
					gap: 0.2rem;
					opacity: 0.75;
					font-size: 0.65rem;
					line-height: 1.1;
					min-width: 0;

					> mitra-icon {
						font-size: 0.75rem;
						flex-shrink: 0;
					}

					> .label {
						text-overflow: ellipsis;
						overflow: hidden;
					}

					@container (height < 3rem) {
						display: none;
					}

					@container (max-height: 4.5rem) {
						> .label {
							min-width: 0;
							white-space: nowrap;
						}
					}
				}

				/* The recurring badge: entries belonging to a repeating series carry a small repeat glyph — the
				   same one the editor's Repeat field uses — as a muted, non-interactive mark in the entry's own
				   colour. Pinned to the top-right corner so it sits on the first line: aligned with the time (or
				   the title, when there's no time) in a stacked chip, and vertically centred in the short single-
				   line bars of the all-day lane and month grid. */
				& > .recurring {
					position: absolute;
					inset-block-start: 0.25rem;
					inset-inline-end: 0.375rem;
					font-size: 0.85rem;
					opacity: 0.6;
					pointer-events: none;

					@container (max-height: 0.5rem) {
						display: none;
					}
				}

				/* Reserve room at the trailing edge of the badge's line so it never overlaps the text — on
				   the header strip while there is one, on the heading itself once the strip has dissolved
				   into it. The two rules coexist without a toggle: a display: contents box pays no padding,
				   so the strip's reservation simply stops applying in the single-line mode. */
				&:has(> .recurring) > .heading > .header {
					padding-inline-end: 1.35rem;
				}

				@container (max-height: 2rem) {
					&:has(> .recurring) > .heading {
						padding-inline-end: 1.35rem;
					}
				}

				/* Subgrid of the row's day columns so each mark aligns with its day without JS positioning. */
				&[data-routine] {
					display: grid;
					grid-template-columns: subgrid;
					align-items: center;
					background: none;
					border-inline-start: none;
					border-radius: 0;
					block-size: 0.125rem;
					align-self: center;
					inline-size: auto;
					margin-inline: 0;
					padding: 0;
					margin-top: 0;
					/* Avoid clipping the expanded pointer target below. */
					overflow: visible;

					> .heading, > .location, > .recurring, > .resize-start, > .resize-end {
						display: none;
					}

					> .mark {
						block-size: 100%;
						border-radius: 999px;
						background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, transparent);
					}

					/* Tap target expands ±1px to match the 4px track pitch (2px mark + 2px gap) without overlapping adjacent routines. */
					&::after {
						content: '';
						position: absolute;
						inset-block: -1px;
						inset-inline: 0;
					}

					&:is(:hover, [selected]) > .mark {
						background-color: var(--mitra-entry-segment-color);
					}
				}

				/* Too narrow to spare that gutter: at a few characters wide — the year grid's single-day cells,
				   a phone's month bars — 1.35rem of reserved trailing edge IS the title (or the whole start
				   time). The badge is decoration and the text is the entry, so it sheds one tier BEFORE the
				   checkbox above; the wide multi-day bars of those very same views keep it. Width alone, unlike
				   the checkbox: the gutter is charged to the first line however tall the block gets, and in a
				   narrow column that line is the one carrying the time. Comes last, so it out-orders the
				   reservations above at equal specificity — and every declaration is addressed to a CHILD, not
				   to this element: no element is its own query container, so a bare declaration in here would
				   be answering some ANCESTOR's width (the trap the views work around with their row overrides). */
				@container (max-width: 6rem) {
					& > .recurring {
						display: none;
					}

					&:has(> .recurring) > .heading,
					&:has(> .recurring) > .heading > .header {
						padding-inline-end: 0;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		if (!this.segment) return html.nothing

		this.style.setProperty(
			'--mitra-entry-segment-color',
			this.segment.entry.color ?? getSource(this.segment.entry.sourceId)?.color ?? ''
		)

		/* The mark and the time share the header strip, the title follows as the second row — all inside
		the heading, so the compact tier can dissolve the strip into one text line. Rendered only when
		it has content: an all-day event has neither, and neither has an unscheduled task. */
		const showsTime = !this.segment.allDay && this.segment.entry.scheduled
		if (this.routine) {
			return html`
				${this.ticks?.map(column => html`<i class="mark" style="grid-column: ${column};"></i>`)}
				${this.detailsTemplate}
			`
		}
		return html`
			<div class="heading">
				${!this.segment.entry.type.isTask && !showsTime ? html.nothing : html`
					<div class="header">
						${!this.segment.entry.type.isTask ? html.nothing : html`
							<mitra-task-status .entry=${this.segment.entry} @change=${this.handleStatusChange}></mitra-task-status>
						`}
						${!showsTime ? html.nothing : html`
							<span class="time">
								<span class="start">${this.segment.entry.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
								<span class="separator">-</span>
								<span class="end">${this.segment.entry.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
							</span>
						`}
					</div>
				`}
				<span class="label">${this.segment.entry.heading || (this.segment.entry.persisted ? '' : t('Draft'))}</span>
			</div>
			${this.segment.allDay || !this.segment.entry.location ? html.nothing : html`
				<div class="location">
					<span class="label">${this.segment.entry.location}</span>
				</div>
			`}
			${!this.segment.entry.partOfSeries ? html.nothing : html`
				<mitra-icon class="recurring" icon="repeat" title=${t('Repeats')}></mitra-icon>
			`}
			${!this.resize || !this.segment.entry.persisted || !getCapabilities(this.segment.entry.sourceId).editEntries ? html.nothing : html`
				<div class="resize-start"></div>
				<div class="resize-end"></div>
			`}
			${this.detailsTemplate}
		`
	}

	private get detailsTemplate() {
		return !this.open ? html.nothing : html`
			<mitra-entry-details popover data-sheet ?open=${bind(this, 'open')}
				style="position-anchor: ${this.anchorName}"
				.segment=${this.segment}
				@click=${(e: Event) => e.stopPropagation()}
			></mitra-entry-details>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-segment': EntrySegmentComponent
	}
}
