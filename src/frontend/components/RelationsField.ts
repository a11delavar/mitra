import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { Relation, RelationType, AUTHORABLE_RELATION_TYPES, EntryType, type Entry } from 'shared'
import { getEntryRelations, searchEntries, updateRelations, type EntryRelationsView } from '../Api.js'
import { EntryStore } from '../EntryStore.js'

// --- Sections ---------------------------------------------------------------------------------------
//
// Lines group into SECTIONS by their EDGE semantics, not by which side stored the pointer — a foreign
// CHILD pointing at this entry and this entry's own PARENT pointing elsewhere both read "Subtask of".
// The section label carries the direction, so the lines themselves need no direction glyphs, and the
// mirror pairs actually mirror: "Blocked by" ↔ "Blocks", "Subtask of" ↔ "Subtasks". Types Mitra
// doesn't interpret (X-…) each keep their raw value as their own section.

/** The section of a relation THIS entry stores. All four temporal types read "Blocked by": whichever
 * boundaries they couple, the target gates this entry (see shared/Relation.ts dependencyEdge). */
function outgoingSection(type: string): string {
	switch (type) {
		case RelationType.Parent: return 'subtask-of'
		case RelationType.Child: return 'subtasks'
		case RelationType.Sibling: return 'related'
		case RelationType.FinishToStart:
		case RelationType.FinishToFinish:
		case RelationType.StartToStart:
		case RelationType.StartToFinish: return 'blocked-by'
		default: return type
	}
}

/** The section of a DERIVED line — the other entry stored the pointer, so every reading flips. */
function incomingSection(type: string): string {
	switch (type) {
		case RelationType.Parent: return 'subtasks'
		case RelationType.Child: return 'subtask-of'
		case RelationType.Sibling: return 'related'
		case RelationType.FinishToStart:
		case RelationType.FinishToFinish:
		case RelationType.StartToStart:
		case RelationType.StartToFinish: return 'blocks'
		default: return type
	}
}

// Static t() per case so the scanner sees each key; a raw (X-…) type renders verbatim, muted like
// the interpreted labels.
function sectionLabel(section: string): string {
	switch (section) {
		case 'blocked-by': return t('Blocked by')
		case 'blocks': return t('Blocks')
		case 'subtask-of': return t('Subtask of')
		case 'subtasks': return t('Subtasks')
		case 'related': return t('Related to')
		default: return section
	}
}

const SECTION_ORDER = ['blocked-by', 'blocks', 'subtask-of', 'subtasks', 'related']

/** The authorable families keyed by the section their lines land in. These sections render ALWAYS —
 * each is its own row with its own add action (the empty row IS the entry point), and each opens
 * the picker preset to its type, so the picker itself never asks for a kind. */
const AUTHORABLE_BY_SECTION = new Map(AUTHORABLE_RELATION_TYPES.map(type => [outgoingSection(type), type]))

/** One rendered line: what to show and how to undo it (an outgoing removal edits this entry, a
 * derived one edits the OTHER entry — the line doesn't care which). */
interface Line {
	readonly heading?: string
	readonly remove: () => void
}

/**
 * The "Relationships" control for the entry editor, SECTIONED by relationship family. The two
 * authorable families ("Blocked by", "Subtask of") are ALWAYS present, each its own row with its
 * own add action — a muted label when empty (the RemindersField placeholder pattern), a small "Add"
 * under its lines otherwise — opening the anchored picker PRESET to that family, so the picker is
 * pure search. Derived families ("Blocks", "Subtasks") and read-only ones appear only when they
 * have lines; derived lines render identically to owned ones, and removing one edits whichever
 * entry owns it. The picker keeps FIXED geometry (the TimeZonePicker pattern): a hairline search
 * row over a constant-height results pane, so it never shifts while searching. The search runs over
 * ALL entries (the palette's backend search — the store is windowed and must not be relied on).
 *
 * Owned lines derive LIVE from `entry.relations` (mutated in place via `Entry.relateTo`/`unrelate`
 * and persisted by the host through the usual `change` → commit flow), so edits render optimistically;
 * the fetched view only enriches them with resolved target entries and contributes the derived half.
 * A server-side 400 (a cycle) is terminal, not retryable — the field reverts the edit and surfaces
 * the message inline. Relationships are series-level: an occurrence reads and edits its MASTER's list.
 */
@component('mitra-relations-field')
export class RelationsField extends Component {
	// Per-instance anchor token so two open editors' pickers never collide.
	private static count = 0
	private readonly anchorBase = `--relations-${RelationsField.count++}`

	/** Each family's add action is its own anchor — the picker re-anchors to whichever opened it. */
	private anchorFor(type: string) {
		return `${this.anchorBase}-${type.toLowerCase()}`
	}

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
	@state() private pendingType: string = AUTHORABLE_RELATION_TYPES[0]!
	/** The query the shown suggestions answer — '' before any search, so the results area can tell
	 * "type something" apart from "nothing matched". */
	@state() private searchedQuery = ''
	/** A terminal save rejection (self-reference/cycle → 400) surfaced inline; cleared on interaction. */
	@state() private error?: string

	// Responses may resolve out of order; only the latest issued request's may land (both fetches).
	private viewSequence = 0
	private searchSequence = 0
	private debounceTimer?: ReturnType<typeof setTimeout>

	/** Target entries by uid, for naming owned lines: fed by the fetched view and by picked
	 * suggestions, so a just-added line has its name before any refetch. */
	private readonly resolvedByUid = new Map<string, Entry>()

	protected override createRenderRoot() { return this }

	private get menu() { return this.querySelector<HTMLElement>('menu[popover]') }
	private get field() { return this.querySelector<HTMLInputElement>('menu input.search') }

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

	/** Every line, bucketed into its section, sections in fixed order (uninterpreted types trail in
	 * encounter order): owned lines first within a section, then the derived ones. The authorable
	 * sections are present even with no lines — their rows carry the add actions. */
	private get sections(): Array<{ label: string, lines: Array<Line>, addType?: string }> {
		const bySection = new Map<string, Array<Line>>()
		const add = (section: string, line: Line) => {
			const lines = bySection.get(section) ?? []
			lines.push(line)
			bySection.set(section, lines)
		}
		for (const relation of this.relations) {
			add(outgoingSection(relation.type), {
				heading: this.resolvedByUid.get(relation.targetUid)?.heading,
				remove: () => this.removeOutgoing(relation),
			})
		}
		for (const item of this.view?.incoming ?? []) {
			add(incomingSection(item.type), {
				heading: item.entry.heading,
				remove: () => { this.removeIncoming(item).catch(() => void 0) },
			})
		}
		const rank = (section: string) => {
			const index = SECTION_ORDER.indexOf(section)
			return index < 0 ? SECTION_ORDER.length : index
		}
		return [...new Set([...bySection.keys(), ...AUTHORABLE_BY_SECTION.keys()])]
			.sort((a, b) => rank(a) - rank(b))
			.map(section => ({ label: sectionLabel(section), lines: bySection.get(section) ?? [], addType: AUTHORABLE_BY_SECTION.get(section) }))
	}

	// --- Owned lines ------------------------------------------------------------------------------------

	private commit(mutate: () => void) {
		this.error = undefined
		mutate()
		this.requestUpdate()
		this.change.dispatch()
		// The host's change handler started (or joined) the entry's save chain — observe THAT chain
		// (commit() returns the in-flight promise) for a terminal rejection: a 400 (self-reference,
		// cycle) can never succeed on retry, so unlike other fields the edit must revert, visibly —
		// to the last server-CONFIRMED value, so every attached handler converges on the same truth.
		const before = this.entry.relations
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

	// --- Derived lines ----------------------------------------------------------------------------------

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

	private togglePicker(type: string) {
		this.error = undefined
		const open = this.menu?.matches(':popover-open')
		if (open && this.pendingType === type) {
			this.closePicker()
			return
		}
		this.pendingType = type
		if (open) {
			// Jumped from one family's add action to the other's: the open picker re-anchors (its
			// position-anchor tracks pendingType), but the shown results answer the WRONG kind's
			// already-related filter — start the search over.
			this.resetSearch()
		} else {
			this.menu?.showPopover()
		}
		this.field?.focus()
	}

	private resetSearch() {
		clearTimeout(this.debounceTimer)
		this.searchSequence++ // orphan any in-flight response
		this.suggestions = []
		this.activeIndex = -1
		this.searchedQuery = ''
		if (this.field) {
			this.field.value = ''
		}
	}

	private closePicker() {
		this.resetSearch()
		this.menu?.hidePopover()
	}

	private readonly handleInput = (e: Event) => {
		clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this.search((e.target as HTMLInputElement).value.trim()), 250)
	}

	private async search(query: string) {
		const sequence = ++this.searchSequence
		const results = query ? await searchEntries(query).catch(() => new Array<Entry>()) : []
		if (sequence !== this.searchSequence || !this.isConnected) {
			return
		}
		// Already-related only WITHIN the pending type's family: hierarchy and dependency are
		// separate graphs (see Relation.familyOf) — being a subtask of X doesn't preclude "Blocked by X".
		const family = Relation.familyOf(this.pendingType)
		const related = new Set(this.relations.filter(relation => Relation.familyOf(relation.type) === family).map(relation => relation.targetUid))
		this.suggestions = results.filter(candidate =>
			!!candidate.uid // uid-less rows can't be pointed at
			&& candidate.uid !== this.entry.uid && candidate.id !== this.targetId // not itself
			&& !candidate.recurrenceId // an override row stands behind its master
			&& !related.has(candidate.uid))
		this.activeIndex = -1
		this.searchedQuery = query
	}

	private pick(candidate: Entry) {
		this.resolvedByUid.set(candidate.uid!, candidate)
		this.commit(() => this.entry.relateTo(this.pendingType, candidate.uid!))
		this.closePicker()
	}

	private readonly handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			// The highlighted suggestion, or — straight after typing — the top match.
			e.preventDefault()
			const candidate = this.suggestions[this.activeIndex] ?? this.suggestions[0]
			if (candidate) {
				this.pick(candidate)
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
			this.updateComplete.then(() => this.querySelector('.results [data-active]')?.scrollIntoView({ block: 'nearest' })).catch(() => void 0)
		}
	}

	static override get styles() {
		return css`
			mitra-relations-field {
				grid-column: 2;
				min-width: 0;

				/* Two columns — section labels | targets — so every family reads as its own row-block
				   and the lines share one label gutter. Rows subgrid into these tracks. */
				display: grid;
				grid-template-columns: max-content minmax(0, 1fr);
				column-gap: 0.5rem;
				row-gap: 0.125rem;
				align-items: center;

				/* An empty authorable family: the muted label IS the add action (the RemindersField
				   placeholder pattern), boxed like the other full-width fields. */
				> .empty {
					all: unset;
					box-sizing: border-box;
					grid-column: 1 / -1;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;
					cursor: pointer;
					color: var(--color-text-muted);

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}
				}

				/* A populated family's add action: a small line in the target column, under its lines. */
				> .add {
					all: unset;
					box-sizing: border-box;
					grid-column: 2;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;
					cursor: pointer;
					color: var(--color-text-muted);
					font-size: 0.6875rem;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}
				}

				> .relation {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					align-items: center;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}

					/* The section label — rendered (empty) on every line so the target always sits in
					   the second track; only a section's first line carries the text. */
					> .kind {
						color: var(--color-text-muted);
						white-space: nowrap;
					}

					> .target {
						display: flex;
						align-items: center;
						gap: 0.25rem;
						min-width: 0;

						> .heading {
							flex: 1;
							min-width: 0;
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;

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
					}

					&:hover > .target > mitra-icon-button,
					> .target > mitra-icon-button:focus-visible {
						opacity: 1;
					}
				}

				> .error {
					grid-column: 1 / -1;
					font-size: 0.6875rem;
					color: #ff6b6b; /* the danger tint menu.css uses */
					margin-inline: -4px;
					padding-inline: 4px;
				}

				/* The picker wears the popover's tinted glass and opens beside whichever family's add
				   action anchored it, with FIXED geometry (the TimeZonePicker pattern): a hairline
				   search row over a constant-height results pane — nothing shifts as results come and
				   go. No kind control: the opener preset the kind. */
				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					padding: 0;
					inline-size: 280px;
					max-inline-size: calc(100dvw - 0.75rem);
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					&:popover-open {
						display: flex;
						flex-direction: column;
						gap: 0;
					}

					/* The search reads as a plain row of the popover (no box, no focus ring — the caret
					   and the filtering are feedback enough), separated by a hairline. */
					> input.search {
						flex-shrink: 0;
						background: transparent;
						border: none;
						border-radius: 0;
						border-block-end: 1px solid rgba(255, 255, 255, 0.06);
						padding: 0.4rem 0.625rem;

						&:hover,
						&:focus-visible {
							background: transparent;
							border-color: transparent;
							border-block-end-color: rgba(255, 255, 255, 0.06);
							box-shadow: none;
						}
					}

					> .results {
						block-size: 13.5rem; /* FIXED — the popover must not resize while searching */
						overflow-y: auto;
						display: flex;
						flex-direction: column;
						gap: 1px;
						padding: 0.25rem;

						> .hint {
							margin: auto;
							padding-inline: 1rem;
							text-align: center;
							color: var(--color-text-muted);
							font-size: 0.75rem;
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
			}
		`
	}

	protected override get template() {
		// A draft has no identity yet — nothing can point at it, and it can't be fetched for. The rows
		// appear the moment the entry persists (the commit loop graduates a titled draft instantly).
		if (!this.entry || !this.targetId) {
			return html.nothing
		}
		return html`
			${this.sections.map(section => this.sectionTemplate(section))}
			${!this.error ? html.nothing : html`<span class="error">${this.error}</span>`}
			${this.pickerTemplate}
		`
	}

	private sectionTemplate(section: { label: string, lines: Array<Line>, addType?: string }) {
		if (!section.lines.length) {
			// Only authorable sections render empty — the others exist purely through their lines.
			return !section.addType ? html.nothing : html`
				<button type="button" class="empty" style="anchor-name: ${this.anchorFor(section.addType)}"
					@click=${() => this.togglePicker(section.addType!)}>${section.label}</button>
			`
		}
		return html`
			${section.lines.map((line, index) => html`
				<div class="relation">
					<span class="kind">${index === 0 ? section.label : ''}</span>
					<span class="target">
						<span class="heading">${line.heading ?? html`<span class="unresolved">${t('Unknown entry')}</span>`}</span>
						<mitra-icon-button icon="x" label=${t('Remove relationship')}
							@click=${() => line.remove()}
						></mitra-icon-button>
					</span>
				</div>
			`)}
			${!section.addType ? html.nothing : html`
				<button type="button" class="add" style="anchor-name: ${this.anchorFor(section.addType)}"
					@click=${() => this.togglePicker(section.addType!)}>${t('Add')}</button>
			`}
		`
	}

	private get pickerTemplate() {
		// ONE picker element serves every family's add action: only one can be open at a time anyway,
		// and its position-anchor tracks whichever opener preset the pending type.
		return html`
			<!-- A MANUAL popover (the LocationField reasoning): its lifecycle is owned here — Escape,
				picking, the add actions and an entry switch close it; light dismiss would tear it
				away from the editor popover's own dismissal. -->
			<menu popover="manual" style="position-anchor: ${this.anchorFor(this.pendingType)}"
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				<input class="search" placeholder=${t('Search entries…')} autocomplete="off" spellcheck="false"
					@input=${this.handleInput}
					@keydown=${this.handleKeydown}>
				<div class="results">
					${this.suggestions.length ? this.suggestions.map((candidate, index) => html`
						<button type="button" ?data-active=${index === this.activeIndex}
							@pointerdown=${(e: Event) => e.preventDefault()}
							@click=${() => this.pick(candidate)}>
							<mitra-icon class="glyph" icon=${candidate.type === EntryType.Task ? 'list-todo' : 'calendar'}></mitra-icon>
							<span class="text">
								${candidate.heading}
								${!candidate.start ? html.nothing : html`<span class="when"> · ${candidate.start.format({ month: 'short', day: 'numeric' })}</span>`}
							</span>
						</button>
					`) : html`
						<span class="hint">${this.searchedQuery ? t('No matching entries') : t('Search for an event or task to link')}</span>
					`}
				</div>
			</menu>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-relations-field': RelationsField
	}
}
