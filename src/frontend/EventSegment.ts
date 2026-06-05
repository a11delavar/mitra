import { component, html, property, Component, css, eventListener, state, bind, queryConnectedInstances } from '@a11d/lit'
import { type EntrySegment } from './EntrySegment.js'
import { colorContrast } from './components/colorContrast.js'
import { getSource } from './Api.js'
import { DraftController } from './DraftController.js'

@component('mitra-entry-segment')
export class EntrySegmentComponent extends Component {
	@queryConnectedInstances() private static readonly instances: Set<EntrySegmentComponent>

	readonly draft = new DraftController(this)

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
				this.draft.discard()
			}
		}
	}) open = false

	@property({ type: Boolean, reflect: true }) selected = false

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		e.stopPropagation()
		this.open = true
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
		if (this.draft.shouldAutoOpen(entry) && !this.segment!.hasPrevious) {
			this.draft.consumeAutoOpen()
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
				cursor: pointer;

				/* Collision Overlap Logic */
				--overlap-s: var(--overlap-slot, 0);
				--overlap-t: var(--overlap-total, 1);
				--overlap-sp: var(--overlap-span, 1);

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100%);
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem), calc(100% - (var(--overlap-s) / var(--overlap-t)) * 100%));
				z-index: calc(var(--overlap-s) + 1);
				box-sizing: border-box;
				container-type: size;
				overflow: hidden;
				transition: background-color 0.15s ease, color 0.15s ease;

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
					font-weight: 600;
					white-space: normal;
					word-break: break-word;
					line-height: 1.1;

					@container (max-height: 45px) {
						flex: initial;
						white-space: normal;
						overflow: visible;
						text-overflow: clip;
						min-width: 0;
					}

					@container (max-height: 20px) {
						white-space: nowrap;
					}

					@container (max-height: 12px) {
						display: none;
					}
				}

				& > .time {
					opacity: 0.75;
					font-size: 0.65rem;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;

					@container (max-height: 45px) {
						display: none;
						flex-shrink: 0;
					}

					& > .separator, & > .end {
						@container (max-height: 45px) {
							display: none;
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
			<div class="heading">${this.segment.entry.heading || (this.segment.entry.persisted ? '' : 'Draft')}</div>
			${!this.open ? html.nothing : html`
				<mitra-entry-details popover ?open=${bind(this, 'open')}
					style="position-anchor: ${this.anchorName}"
					.segment=${this.segment}
					@click=${(e: Event) => e.stopPropagation()}
					@change=${() => this.requestUpdate()}
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
