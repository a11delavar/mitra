import { component, html, property, Component, css, state, bind, queryConnectedInstances, eventListener, unsafeCSS } from '@a11d/lit'
import { EntryType, TaskStatus } from 'shared'
import { type EntrySegment } from './EntrySegment.js'
import { colorContrast } from './components/colorContrast.js'
import { getSource } from './Api.js'
import { EntryStore } from './EntryStore.js'

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
		// Track the segment's id on the host (its anchor + view-transition identity) on every update, not
		// only when `segment` changes — so they re-sync when a draft is assigned its id in place on save,
		// keeping the open editor's `position-anchor` matched.
		this.style.viewTransitionName = `entry-${this.segment!.id}`
		this.style.anchorName = this.anchorName
		this.toggleAttribute('data-draft', !entry.persisted)
		// A live resize and a move's ghost float above their cluster; a move's origin dims in place.
		this.toggleAttribute('dragging', this.store.isDragging(entry) || this.store.isPreview(entry))
		this.toggleAttribute('drag-source', this.store.isDragSource(entry))
		if (entry.type === EntryType.Task) {
			this.setAttribute('data-status', entry.status ?? 'todo')
		} else {
			this.removeAttribute('data-status')
		}
		if (this.store.shouldAutoOpen(entry) && !this.segment!.hasPrevious) {
			this.store.consumeAutoOpen()
			this.open = true
		}
		// The command palette navigated to a picked entry and asked for its editor — open it on the
		// run-start segment only (so a multi-day entry opens one editor), consuming the request.
		if (this.store.shouldOpen(entry) && !this.segment!.hasPrevious) {
			this.store.consumeOpen()
			this.open = true
		}
	}

	static override get styles() {
		return css`
			mitra-entry-segment {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.125rem 0.25rem 0;
				background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
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

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100%);
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem), calc(100% - (var(--overlap-s) / var(--overlap-t)) * 100%));
				z-index: calc(var(--overlap-s) + 1);
				box-sizing: border-box;
				container-type: size;
				position: relative;
				overflow: hidden;
				transition: background-color 0.15s ease, color 0.15s ease;

				/* While actively manipulated (a live resize, or a move's dashed ghost), float full-width above
				   the cluster instead of re-flowing with it each frame. Overriding the derived vars (not the
				   inline --overlap-slot etc.) wins on specificity, so no !important is needed. */
				&[dragging] {
					z-index: 9999;
					--overlap-s: 0;
					--overlap-t: 1;
					--overlap-sp: 1;
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
				&:not([data-draft])[selected] {
					background-color: var(--mitra-entry-segment-color);
					color: ${colorContrast('var(--mitra-entry-segment-color)')};
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
					display: flex;
					align-items: center;
					gap: 0.25rem;
					font-weight: 600;
					white-space: normal;
					word-break: break-word;
					line-height: 1.1;

					/* The title text shrinks/wraps within the row; the checkbox keeps its size. */
					> .label { min-width: 0; }
					> mitra-task-status { font-size: 0.95rem; }

					@container (max-height: 2rem) {
						flex: initial;
						white-space: normal;
						overflow: visible;
						text-overflow: clip;
						min-width: 0;
					}

					@container (max-height: 1rem) {
						white-space: nowrap;
					}

					@container (max-height: 0.5rem) {
						display: none;
					}
				}

				&[data-status=${unsafeCSS(TaskStatus.Done)}], &[data-status=${unsafeCSS(TaskStatus.Cancelled)}] {
					& > .heading > .label {
						opacity: 0.6;
						text-decoration: line-through;
					}
				}

				& > .time {
					opacity: 0.75;
					font-size: 0.65rem;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					flex-shrink: 0;

					@container (max-height: 2rem) {
						display: none;
					}

					& > .separator, & > .end {
						@container (max-height: 2rem) {
							display: none;
						}
					}
				}

				/* The location is the optional third row: shown only once the block is tall enough to seat a
				   third line beneath the time + heading (which themselves appear from 45px). Below that the
				   query hides it, so short blocks — and the compact month cells — keep just time + heading. */
				& > .location {
					display: none;
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

					@container (min-height: 3rem) {
						display: flex;
						> .label {
							text-overflow: ellipsis;
							overflow: hidden;
						}
					}

					@container (max-height: 4.5rem) {
						> .label {
							min-width: 0;
							white-space: nowrap;
						}
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

		return html`
			${this.segment.allDay ? html.nothing : html`
				<div class="time">
					<span class="start">${this.segment.entry.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
					<span class="separator">-</span>
					<span class="end">${this.segment.entry.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
				</div>
			`}
			<div class="heading">
				${this.segment.entry.type !== EntryType.Task ? html.nothing : html`
					<mitra-task-status .entry=${this.segment.entry} @change=${this.handleStatusChange}></mitra-task-status>
				`}
				<span class="label">${this.segment.entry.heading || (this.segment.entry.persisted ? '' : t('Draft'))}</span>
			</div>
			${this.segment.allDay || !this.segment.entry.location ? html.nothing : html`
				<div class="location">
					<span class="label">${this.segment.entry.location}</span>
				</div>
			`}
			${!this.resize || !this.segment.entry.persisted ? html.nothing : html`
				<div class="resize-start"></div>
				<div class="resize-end"></div>
			`}
			${!this.open ? html.nothing : html`
				<mitra-entry-details popover ?open=${bind(this, 'open')}
					style="position-anchor: ${this.anchorName}"
					.segment=${this.segment}
					@click=${(e: Event) => e.stopPropagation()}
				></mitra-entry-details>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-segment': EntrySegmentComponent
	}
}
