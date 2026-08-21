import { Component, component, html, css, property, state } from '@a11d/lit'
import { RelationType, type RelationSection, EntryType, type Entry, type Relation } from 'shared'
import { getEntryRelations, searchEntries, updateRelations, type EntryRelationsView } from '../Api.js'
import { EntryStore } from '../EntryStore.js'
import { controlHeight } from './controlHeight.css.js'

/** The authorable families keyed by the section their lines land in. These sections render ALWAYS —
 * each is its own row with its own add action (the empty row IS the entry point), and each opens
 * the picker preset to its type, so the picker itself never asks for a kind. */
const AUTHORABLE_BY_SECTION = new Map(RelationType.authorable.map(type => [type.section, type]))

/** One rendered line: what to show and how to undo it (an outgoing removal edits this entry, a
 * derived one edits the OTHER entry — the line doesn't care which). */
interface Line {
	readonly heading?: string
	/** No heading YET — the resolver hasn't answered. Distinct from a heading-less line, which is a
	 * genuinely dangling pointer: an owned line knows only its target's uid until the view lands, so
	 * without this every editor open would flash "Unknown entry" over links that are perfectly fine. */
	readonly pending?: boolean
	readonly remove: () => void
}

/**
 * The relationship controls for the entry editor: ONE `.field` ROW PER SECTION (see field.css.ts),
 * not one row holding them all. "Blocked by" and "Subtask of" are separate fields the way Location and
 * Reminders are — each with its own leading glyph, its own hover box, and its own `+` icon button at
 * the row's end (the RemindersField add affordance). The component therefore subgrids the popover's
 * two columns and emits the rows itself, exactly like `mitra-entry-details-when`.
 *
 * The two authorable families are ALWAYS present — an empty one is the muted section label standing in
 * as the field's placeholder, which is also its own entry point. Derived families ("Blocks",
 * "Subtasks") and read-only ones appear only when they have lines, and carry no add button: the
 * pointer lives on the other entry, so there is nothing to author from this side. Derived lines
 * otherwise render identically to owned ones, and removing one edits whichever entry owns it.
 *
 * Unlike every other field the section label STAYS once the row has values, rather than giving way to
 * them: the mirror pairs share a glyph (see RelationSection), so "Blocked by X" and "Blocks X" would be
 * indistinguishable without it.
 *
 * Each authorable row owns its own picker, anchored by the field's scoped `--field` (field.css.ts) —
 * no per-instance anchor tokens, and no re-anchoring when the user moves between families. The picker
 * keeps FIXED geometry (the TimeZonePicker pattern): a hairline search row over a constant-height
 * results pane, so it never shifts while searching. Its kind is preset by whichever row opened it, so
 * the picker itself is pure search — over ALL entries (the palette's backend search; the store is
 * windowed and must not be relied on).
 *
 * Owned lines derive LIVE from `entry.relations` and edits render optimistically; the field OWNS
 * persistence (see commit) — relations are excluded from the entry's dirty-tracking entirely;
 * the fetched view only enriches them with resolved target entries and contributes the derived half.
 * A server-side 400 (a cycle) is terminal, not retryable — the field reverts the edit and surfaces
 * the message inline. Relationships are series-level: an occurrence reads and edits its MASTER's list.
 */
@component('mitra-relations-field')
export class RelationsField extends Component {
	@property({
		type: Object,
		// The popover got reused for another entry: the picker and the fetched view belong to the
		// previous one — close, clear, refetch.
		updated(this: RelationsField) { this.closePicker(); this.error = undefined; this.view = undefined; this.fetchView().catch(() => void 0) },
	}) entry!: Entry

	@state() private view?: EntryRelationsView
	@state() private suggestions = new Array<Entry>()
	@state() private activeIndex = -1
	@state() private pendingType: RelationType = RelationType.authorable[0]!
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

	/** Each authorable row carries its own picker, keyed by the family it authors. */
	private menuFor(type: RelationType) { return this.querySelector<HTMLElement>(`menu.picker[data-type="${type.value}"]`) }
	private searchInputFor(type: RelationType) { return this.querySelector<HTMLInputElement>(`menu.picker[data-type="${type.value}"] input.search`) }

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
	private get sections(): Array<{ section: RelationSection, lines: Array<Line>, addType?: RelationType }> {
		const bySection = new Map<RelationSection, Array<Line>>()
		const add = (section: RelationSection, line: Line) => {
			const lines = bySection.get(section) ?? []
			lines.push(line)
			bySection.set(section, lines)
		}
		for (const relation of this.relations) {
			add(RelationType.of(relation.type).section, {
				heading: this.resolvedByUid.get(relation.targetUid)?.heading,
				// A just-picked target is resolved locally, so only a line the view hasn't spoken for
				// is still pending — and only until the FIRST view lands.
				pending: !this.view,
				remove: () => this.removeOutgoing(relation),
			})
		}
		// A pair a foreign client authored redundantly from BOTH sides (our PARENT→B plus B's own
		// CHILD→us) reads identically twice — the owned line already says it, so its derived echo
		// stays silent (and removal edits the pointer we own).
		const owned = new Set(this.relations.map(relation => `${RelationType.of(relation.type).section.value} ${relation.targetUid}`))
		for (const item of this.view?.incoming ?? []) {
			const type = RelationType.of(item.type)
			if (item.entry.uid && owned.has(`${type.inverseSection.value} ${item.entry.uid}`)) {
				continue
			}
			add(type.inverseSection, {
				heading: item.entry.heading,
				remove: () => { this.removeIncoming(item).catch(() => void 0) },
			})
		}
		return [...new Set([...bySection.keys(), ...AUTHORABLE_BY_SECTION.keys()])]
			.sort((a, b) => a.rank - b.rank)
			.map(section => ({ section, lines: bySection.get(section) ?? [], addType: AUTHORABLE_BY_SECTION.get(section) }))
	}

	// --- Owned lines ------------------------------------------------------------------------------------

	/** Persist the new outgoing list. Relations have their OWN write path — a relations-only PUT to
	 * the series master, never the entry commit pipeline: they are series-level, server-validated
	 * facts, so a rejection (a cycle's 400) is terminal and reverts rather than retrying. A DRAFT
	 * only keeps the list on the entry — it rides the create once the draft graduates. */
	private commit(mutate: () => void) {
		this.error = undefined
		const before = this.entry.relations ?? null
		mutate()
		EntryStore.notify()
		const id = this.targetId
		if (!id) {
			return
		}
		updateRelations(id, this.entry.relations ?? null)
			.then(saved => EntryStore.adoptRelations(saved))
			.catch((error: unknown) => {
				this.entry.relations = before
				this.error = error instanceof Error ? error.message : t('This relationship is not possible')
				EntryStore.notify()
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
		const remaining = (owner.relations ?? []).filter(relation => !(RelationType.of(relation.type) === RelationType.of(item.type) && relation.targetUid === this.entry.uid))
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

	private togglePicker(type: RelationType) {
		this.error = undefined
		const wasOpen = this.menuFor(type)?.matches(':popover-open')
		// Closes whichever family's picker was open — including this one, making the button a toggle.
		// Jumping between families therefore always starts the search over, which it must: the results
		// are filtered against the pending kind's already-related set (hierarchy and dependency are
		// separate graphs), so the other family's list would be answering the wrong question.
		this.closePicker()
		if (wasOpen) {
			return
		}
		this.pendingType = type
		this.menuFor(type)?.showPopover()
		this.searchInputFor(type)?.focus()
	}

	private resetSearch() {
		clearTimeout(this.debounceTimer)
		this.searchSequence++ // orphan any in-flight response
		this.suggestions = []
		this.activeIndex = -1
		this.searchedQuery = ''
		this.querySelectorAll<HTMLInputElement>('menu.picker input.search').forEach(input => input.value = '')
	}

	private closePicker() {
		this.resetSearch()
		this.querySelectorAll<HTMLElement>('menu.picker').forEach(menu => {
			// hidePopover() throws on an element that isn't showing.
			if (menu.matches(':popover-open')) {
				menu.hidePopover()
			}
		})
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
		// separate graphs (see RelationType.family) — being a subtask of X doesn't preclude "Blocked by X".
		const family = this.pendingType.family
		const related = new Set(this.relations.filter(relation => RelationType.of(relation.type).family === family).map(relation => relation.targetUid))
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
				/* Each section is a ROW of the popover's own two-column grid, not a block inside one
				   cell — so "Blocked by" and "Subtask of" are siblings of Location and Reminders rather
				   than tenants of a shared "Relationships" row. Same shape as mitra-entry-details-when. */
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				row-gap: 0.125rem;

				> .row {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					/* A row stands the shared control height even when it holds nothing but its
					   placeholder label, so an empty family doesn't read as a half-height row. */
					${controlHeight};
					min-height: var(--control-height);

					/* The field box bleeds past the columns so it wraps the glyph and the content as ONE
					   control — the same pair the editor's own li.field rows use, TRAILING CAP INCLUDED
					   (see EventDetails): the full bleed would sit flush against the popover's tighter
					   0.5rem end inset, and a row 4px wider than the Reminders row above it is exactly the
					   misalignment these rows exist to avoid. */
					&.field { margin-inline: -0.5rem -0.25rem; }

					> mitra-icon {
						grid-column: 1;
						font-size: 0.87rem;
						color: var(--color-text-muted);
						flex-shrink: 0;
					}
				}

				/* The row's content: label | targets | add. The targets stack in the middle track while
				   the add button holds the END of the FIRST line, so it stays put as the list grows
				   (the RemindersField arrangement). */
				> .row > .lines {
					grid-column: 2;
					min-width: 0;
					display: grid;
					grid-template-columns: max-content minmax(0, 1fr) auto;
					/* The FIRST line spans the control height, so the field glyph's first-line pin (see
					   field.css.ts) stays centred on it however many lines follow. */
					grid-template-rows: minmax(calc(var(--control-height) - 2px), auto);
					align-items: center;
					column-gap: 0.5rem;
					row-gap: 0.25rem;

					/* Later lines are bare text — a grown row gets the same air below them that the
					   first line's centring leaves above. */
					&:has(.relation ~ .relation) {
						padding-block-end: 0.3125rem;
					}

					/* The section label doubles as the field's placeholder, so it wears the placeholder
					   voice whether or not the row has values (see the class comment for why it stays). */
					> .kind {
						grid-column: 1;
						grid-row: 1;
						color: var(--color-text-muted);
						white-space: nowrap;
					}

					> .add {
						grid-column: 3;
						grid-row: 1;
						color: var(--color-text-muted);
						font-size: 0.8rem;
						/* Swallow the button's own padding so it never stretches the row past a line's height. */
						margin-block: -0.25rem;
					}

					> .relation {
						grid-column: 2;
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

						&:hover > mitra-icon-button,
						> mitra-icon-button:focus-visible {
							opacity: 1;
						}
					}
				}

				> .error {
					grid-column: 2;
					font-size: 0.6875rem;
					color: #ff6b6b; /* the danger tint menu.css uses */
				}

				/* The picker wears the popover's tinted glass and opens beside its OWN row — the
				   position-anchor comes from the field's scoped --field name (field.css.ts), so there is
				   no per-instance token here. FIXED geometry (the TimeZonePicker pattern): a hairline
				   search row over a constant-height results pane — nothing shifts as results come and
				   go. No kind control: the row that opened it preset the kind. */
				menu.picker {
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
		// Drafts author relations too — the list rides the create. Only the view fetch (resolved
		// names, incoming lines) waits for identity; nothing can point at a draft yet anyway.
		if (!this.entry) {
			return html.nothing
		}
		return html`
			${this.sections.map(section => this.sectionTemplate(section))}
			${!this.error ? html.nothing : html`<span class="error">${this.error}</span>`}
		`
	}

	private sectionTemplate({ section, lines, addType }: { section: RelationSection, lines: Array<Line>, addType?: RelationType }) {
		// A derived/read-only family exists only through its lines — there is nothing to author from
		// this side, so an empty one has no row at all (and no add button when it does).
		if (!lines.length && !addType) {
			return html.nothing
		}
		return html`
			<div class="row field" data-section=${section.value}>
				<mitra-icon icon=${section.icon}></mitra-icon>
				<div class="lines">
					<span class="kind">${section.format()}</span>
					${lines.map(line => html`
						<span class="relation">
							<span class="heading">${line.heading ?? (line.pending
								? html`<span class="unresolved">…</span>`
								: html`<span class="unresolved">${t('Unknown entry')}</span>`)}</span>
							<mitra-icon-button icon="x" label=${t('Remove relationship')}
								@click=${() => line.remove()}
							></mitra-icon-button>
						</span>
					`)}
					${!addType ? html.nothing : html`
						<mitra-icon-button class="add" icon="plus" label=${t('Add relationship')}
							@click=${() => this.togglePicker(addType)}
						></mitra-icon-button>
						${this.pickerTemplate(addType)}
					`}
				</div>
			</div>
		`
	}

	private pickerTemplate(type: RelationType) {
		return html`
			<!-- A MANUAL popover (the LocationField reasoning): its lifecycle is owned here — Escape,
				picking, the add buttons and an entry switch close it; light dismiss would tear it
				away from the editor popover's own dismissal. -->
			<menu class="picker" popover="manual" data-type=${type.value}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				<input class="search" placeholder=${t('Search entries…')} autocomplete="off" spellcheck="false"
					@input=${this.handleInput}
					@keydown=${this.handleKeydown}>
				<div class="results">
					${/* Only the open picker's results are worth rendering — the suggestions are filtered
					     against the PENDING family, so another row's copy would be answering for the
					     wrong kind if it ever showed. */''}
					${this.pendingType !== type || !this.suggestions.length ? html`
						<span class="hint">${this.searchedQuery ? t('No matching entries') : t('Search for an event or task to link')}</span>
					` : this.suggestions.map((candidate, index) => html`
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
