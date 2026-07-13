import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { Relation, RelationType, AUTHORABLE_RELATION_TYPES, EntryType, type Entry } from 'shared'
import { getEntryRelations, searchEntries, updateRelations, type EntryRelationsView } from '../Api.js'
import { EntryStore } from '../EntryStore.js'

// The outgoing label per type — static t() per case so the scanner sees each key. `undefined` for
// types Mitra doesn't interpret (X-…): the raw value renders muted instead.
function relationLabel(type: string): string | undefined {
	switch (type) {
		case RelationType.Parent: return t('Subtask of')
		case RelationType.Child: return t('Parent of')
		case RelationType.Sibling: return t('Related to')
		case RelationType.FinishToStart: return t('After')
		case RelationType.FinishToFinish: return t('Finishes after')
		case RelationType.StartToStart: return t('Starts after')
		case RelationType.StartToFinish: return t('Finishes after start of')
		default: return undefined
	}
}

// The INVERSE reading for incoming lines — what this entry is to the one that stored the pointer.
// All four temporal types read as "blocks": whichever boundaries they couple, this entry gates the
// other one (see shared/Relation.ts).
function inverseRelationLabel(type: string): string | undefined {
	switch (type) {
		case RelationType.Parent: return t('Has subtask')
		case RelationType.Child: return t('Subtask of')
		case RelationType.Sibling: return t('Related to')
		case RelationType.FinishToStart:
		case RelationType.FinishToFinish:
		case RelationType.StartToStart:
		case RelationType.StartToFinish: return t('Blocks')
		default: return undefined
	}
}

/**
 * The "Relationships" control for the entry editor: the entry's outgoing links ("Subtask of X",
 * "After Y" — each removable), the DERIVED incoming ones ("Has subtask", "Blocks" — muted, removable
 * from this side too, which edits the OTHER entry), and an "add" affordance opening an anchored
 * picker: an authorable-type select plus a debounced search over ALL entries (the palette's backend
 * search — the store is windowed and must not be relied on).
 *
 * Outgoing lines derive LIVE from `entry.relations` (mutated in place via `Entry.relateTo`/`unrelate`
 * and persisted by the host through the usual `change` → commit flow), so edits render optimistically;
 * the fetched view only enriches them with resolved target entries and contributes the incoming half.
 * A server-side 400 (a cycle) is terminal, not retryable — the field reverts the edit and surfaces
 * the message inline. Relationships are series-level: an occurrence reads and edits its MASTER's list.
 */
@component('mitra-relations-field')
export class RelationsField extends Component {
	// Per-instance anchor token so two open editors' pickers never collide.
	private static count = 0
	private readonly anchor = `--relations-${RelationsField.count++}`

	@property({
		type: Object,
		// The popover got reused for another entry: the picker and the fetched view belong to the
		// previous one — close, clear, refetch.
		updated(this: RelationsField) { this.closePicker(); this.error = undefined; this.view = undefined; this.fetchView().catch(() => void 0) },
	}) entry!: Entry

	/** Fired after `entry.relations` is replaced, so the host persists. */
	@event() readonly change!: EventDispatcher

	@state() private view?: EntryRelationsView
	@state() private suggestions = new Array<Entry>()
	@state() private activeIndex = -1
	@state() private pendingType: string = RelationType.FinishToStart
	/** A terminal save rejection (self-reference/cycle → 400) surfaced inline; cleared on interaction. */
	@state() private error?: string

	// Responses may resolve out of order; only the latest issued request's may land (both fetches).
	private viewSequence = 0
	private searchSequence = 0
	private debounceTimer?: ReturnType<typeof setTimeout>

	/** Target entries by uid, for naming outgoing lines: fed by the fetched view and by picked
	 * suggestions, so a just-added line has its name before any refetch. */
	private readonly resolvedByUid = new Map<string, Entry>()

	protected override createRenderRoot() { return this }

	private get menu() { return this.querySelector<HTMLElement>('menu[popover]') }
	private get field() { return this.querySelector('textarea') }

	/** Relationships live on the series MASTER — an occurrence reads/edits its master's. */
	private get targetId() { return this.entry.recurrenceMasterId ?? this.entry.id }

	private get relations(): Array<Relation> {
		return this.entry.relations ?? []
	}

	override connected() {
		this.fetchView().catch(() => void 0)
	}

	private async fetchView() {
		const id = this.targetId
		if (!id) {
			return // a draft — nothing persisted to relate yet
		}
		const sequence = ++this.viewSequence
		const view = await getEntryRelations(id)
		if (sequence !== this.viewSequence || !this.isConnected) {
			return
		}
		for (const outgoing of view.outgoing) {
			if (outgoing.entry) {
				this.resolvedByUid.set(outgoing.targetUid, outgoing.entry)
			}
		}
		this.view = view
	}

	// --- Outgoing ---------------------------------------------------------------------------------------

	private commit(mutate: () => void) {
		const before = this.entry.relations
		this.error = undefined
		mutate()
		this.requestUpdate()
		this.change.dispatch()
		// The host's change handler started (or joined) the entry's save chain — observe THAT chain
		// (commit() returns the in-flight promise) for a terminal rejection: a 400 (self-reference,
		// cycle) can never succeed on retry, so unlike other fields the edit must revert, visibly —
		// to the last server-CONFIRMED value, not the captured pre-edit array: several edits may
		// share one chain, and every attached handler must converge on the same truth.
		EntryStore.commit(this.entry).catch((error: unknown) => {
			if ((error as { status?: number }).status === 400) {
				const canonical = EntryStore.canonicalRelations(this.entry)
				this.entry.relations = canonical !== undefined ? canonical : before
				this.error = error instanceof Error ? error.message : t('This relationship is not possible')
				EntryStore.notify()
			}
		})
	}

	// Named to dodge `HTMLElement.remove` — a private member of the same name breaks the element's
	// structural compatibility with HTMLElement and with it the component decorators.
	private removeOutgoing(relation: Relation) {
		this.commit(() => this.entry.unrelate(relation))
		this.fetchView().catch(() => void 0)
	}

	// --- Incoming ---------------------------------------------------------------------------------------

	private async removeIncoming(item: EntryRelationsView['incoming'][number]) {
		// The pointer lives on the OTHER entry: filter this edge out of its outgoing list and PUT it
		// back — a relations-only partial update; nothing else about that entry moves.
		const owner = item.entry
		if (!owner.id || !this.entry.uid) {
			return
		}
		this.error = undefined
		const remaining = (owner.relations ?? []).filter(relation => !(relation.type === item.type && relation.targetUid === this.entry.uid))
		try {
			const saved = await updateRelations(owner.id, remaining.length ? remaining : null)
			// The other entry may be tracked (and even dirty) in the store — adopt the result onto
			// its copies, or its next full PUT would resurrect the link just removed.
			EntryStore.adoptRelations(saved)
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error)
		}
		await this.fetchView()
	}

	// --- Picker -----------------------------------------------------------------------------------------

	private readonly togglePicker = () => {
		this.error = undefined
		this.menu?.togglePopover()
		if (this.menu?.matches(':popover-open')) {
			this.field?.focus()
		} else {
			this.closePicker()
		}
	}

	private closePicker() {
		clearTimeout(this.debounceTimer)
		this.searchSequence++ // orphan any in-flight response
		this.suggestions = []
		this.activeIndex = -1
		if (this.field) {
			this.field.value = ''
		}
		this.menu?.hidePopover()
	}

	private readonly handleInput = (e: Event) => {
		const field = e.target as HTMLTextAreaElement
		if (field.value.includes('\n')) {
			field.value = field.value.replace(/\s*\n+\s*/g, ' ')
		}
		clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this.search(field.value.trim()), 250)
	}

	private async search(query: string) {
		const sequence = ++this.searchSequence
		const results = query ? await searchEntries(query).catch(() => new Array<Entry>()) : []
		if (sequence !== this.searchSequence || !this.isConnected) {
			return
		}
		// Already-related only WITHIN the pending type's family: hierarchy and dependency are
		// separate graphs (see Relation.familyOf) — being a subtask of X doesn't preclude "After X".
		const family = Relation.familyOf(this.pendingType)
		const related = new Set(this.relations.filter(relation => Relation.familyOf(relation.type) === family).map(relation => relation.targetUid))
		this.suggestions = results.filter(candidate =>
			!!candidate.uid // uid-less rows can't be pointed at
			&& candidate.uid !== this.entry.uid && candidate.id !== this.targetId // not itself
			&& !candidate.recurrenceId // an override row stands behind its master
			&& !related.has(candidate.uid))
		this.activeIndex = -1
	}

	private pick(candidate: Entry) {
		this.resolvedByUid.set(candidate.uid!, candidate)
		this.commit(() => this.entry.relateTo(this.pendingType, candidate.uid!))
		this.closePicker()
	}

	private readonly handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			if (this.activeIndex >= 0 || this.suggestions.length === 1) {
				this.pick(this.suggestions[Math.max(this.activeIndex, 0)]!)
			}
			return
		}
		if (e.key === 'Escape') {
			// Only dismiss the picker — stop it before the popover machinery closes the whole editor.
			e.stopPropagation()
			this.closePicker()
			return
		}
		if (this.suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			e.preventDefault()
			const delta = e.key === 'ArrowDown' ? 1 : -1
			this.activeIndex = (this.activeIndex + delta + this.suggestions.length) % this.suggestions.length
		}
	}

	static override get styles() {
		return css`
			mitra-relations-field {
				grid-column: 2;
				min-width: 0;
				display: flex;
				flex-direction: column;
				align-items: start;
				gap: 0.125rem;

				/* The subtle-field box stretched over the whole row (the RemindersField pattern), so the
				   buttons line up with — and anchor the picker like — the other full-width fields. */
				> .empty, > .add {
					all: unset;
					box-sizing: border-box;
					align-self: stretch;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;
					cursor: pointer;
					color: var(--color-text-muted);

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}
				}

				> .add {
					font-size: 0.6875rem;
				}

				> .relation {
					align-self: stretch;
					display: flex;
					align-items: center;
					gap: 0.25rem;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}

					> span {
						flex: 1;
						min-width: 0;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;

						> .kind {
							color: var(--color-text-muted);
						}

						> .unresolved {
							color: var(--color-text-muted);
							font-style: italic;
						}
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
						font-size: 0.8rem;
						margin-block: -0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > mitra-icon-button,
					> mitra-icon-button:focus-visible {
						opacity: 1;
					}

					/* An incoming line reads back-to-front — the OTHER entry stored the pointer. */
					&.incoming {
						> mitra-icon {
							color: var(--color-text-muted);
							font-size: 0.75rem;
						}
					}
				}

				> .error {
					font-size: 0.6875rem;
					color: #ff6b6b; /* the danger tint menu.css uses */
					margin-inline: -4px;
					padding-inline: 4px;
				}

				/* The picker wears the popover's tinted glass and opens beside the row — the same
				   strategy as the reminder/location menus. */
				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					min-inline-size: 240px;
					max-inline-size: 300px;
					max-height: 60dvh;
					overflow-y: auto;
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					> .compose {
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
						padding: 0.25rem;

						> select {
							align-self: start;
						}

						> textarea {
							flex: 1;
							min-width: 0;
						}
					}

					> button {
						> .glyph {
							color: var(--color-text-muted);
						}

						> .text {
							flex: 1;
							min-width: 0;
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;

							> .when {
								font-size: 0.6875rem;
								font-weight: 400;
								color: var(--color-text-muted);
							}
						}

						&[data-active] {
							background: color-mix(in srgb, var(--color-text) 8%, transparent);
						}
					}
				}
			}
		`
	}

	protected override get template() {
		// A draft has no identity yet — nothing can point at it, and it can't be fetched for. The row
		// appears the moment the entry persists (the commit loop graduates a titled draft instantly).
		if (!this.entry || !this.targetId) {
			return html.nothing
		}
		const incoming = this.view?.incoming ?? []
		const empty = !this.relations.length && !incoming.length
		return html`
			${empty ? html`
				<button type="button" class="empty" style="anchor-name: ${this.anchor}" @click=${this.togglePicker}>${t('Relationships')}</button>
			` : html`
				${this.relations.map(relation => this.outgoingTemplate(relation))}
				${incoming.map(item => this.incomingTemplate(item))}
				<button type="button" class="add" style="anchor-name: ${this.anchor}" @click=${this.togglePicker}>${t('Add relationship')}</button>
			`}
			${!this.error ? html.nothing : html`<span class="error">${this.error}</span>`}
			${this.pickerTemplate}
		`
	}

	private outgoingTemplate(relation: Relation) {
		const target = this.resolvedByUid.get(relation.targetUid)
		const label = relationLabel(relation.type)
		return html`
			<div class="relation">
				<span>
					<span class="kind">${label ?? relation.type}</span>
					${target ? target.heading : html`<span class="unresolved">${t('Unknown entry')}</span>`}
				</span>
				<mitra-icon-button icon="x" label=${t('Remove relationship')}
					@click=${() => this.removeOutgoing(relation)}
				></mitra-icon-button>
			</div>
		`
	}

	private incomingTemplate(item: EntryRelationsView['incoming'][number]) {
		const label = inverseRelationLabel(item.type)
		return html`
			<div class="relation incoming">
				<mitra-icon icon="corner-down-left"></mitra-icon>
				<span>
					<span class="kind">${label ?? item.type}</span>
					${item.entry.heading}
				</span>
				<mitra-icon-button icon="x" label=${t('Remove relationship')}
					@click=${() => this.removeIncoming(item)}
				></mitra-icon-button>
			</div>
		`
	}

	private get pickerTemplate() {
		// Static t() per authorable type so the i18n scanner sees each key (only PARENT and
		// FINISHTOSTART are offered — see AUTHORABLE_RELATION_TYPES).
		const authorableLabel = (type: string) => type === RelationType.Parent ? t('Subtask of') : t('After')
		return html`
			<!-- A MANUAL popover (the LocationField reasoning): its lifecycle is owned here — Escape,
				picking, the toggle button and an entry switch close it; light dismiss would race the
				nested select's own picker popover. -->
			<menu popover="manual" style="position-anchor: ${this.anchor}">
				<div class="compose" @change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
					<select class="subtle" aria-label=${t('Relationship type')}
						@change=${(e: Event) => this.pendingType = (e.target as HTMLSelectElement).value}>
						<button>
							<selectedcontent></selectedcontent>
						</button>
						${AUTHORABLE_RELATION_TYPES.map(type => html`
							<option value=${type} ?selected=${type === this.pendingType}>${authorableLabel(type)}</option>
						`)}
					</select>
					<textarea class="subtle" rows="1" placeholder=${t('Search entries…')} autocomplete="off" spellcheck="false"
						@input=${this.handleInput}
						@keydown=${this.handleKeydown}></textarea>
				</div>
				${this.suggestions.map((candidate, index) => html`
					<button type="button" ?data-active=${index === this.activeIndex}
						@pointerdown=${(e: Event) => e.preventDefault()}
						@click=${() => this.pick(candidate)}>
						<mitra-icon class="glyph" icon=${candidate.type === EntryType.Task ? 'list-todo' : 'calendar'}></mitra-icon>
						<span class="text">
							${candidate.heading}
							${!candidate.start ? html.nothing : html`<span class="when"> · ${candidate.start.format({ month: 'short', day: 'numeric' })}</span>`}
						</span>
					</button>
				`)}
			</menu>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-relations-field': RelationsField
	}
}
