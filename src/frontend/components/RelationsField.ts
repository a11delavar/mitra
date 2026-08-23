import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { RelationType, type Relation, RelationSection, type RelationLine, EntryType, TaskStatus, type Entry } from 'shared'
import { EntryEditorIntent } from '../EntryEditorIntent.js'
import { getCapabilities, getSource, searchEntries, updateEvent, updateRelations } from '../Api.js'
import { EntryStore } from '../EntryStore.js'
import { offerFollowUps } from '../Hierarchy.js'
import { Relations } from '../Relations.js'
import { controlHeight } from './controlHeight.css.js'
import './TaskStatus.js'

/** The authorable families keyed by the section their lines land in. These sections render ALWAYS —
 * each is its own row with its own add action (the empty row IS the entry point), and each opens
 * the picker preset to its type, so the picker itself never asks for a kind. */
const AUTHORABLE_BY_SECTION = new Map(RelationType.authorable.map(type => [type.section, type]))

/** One rendered line: what to show and how to undo it (an outgoing removal edits this entry, a
 * derived one edits the OTHER entry — the line doesn't care which). */
interface Line {
	readonly target?: Entry
	readonly heading?: string
	/** This line's dependency is already broken by the two entries' times — see {@link Entry.violates}. */
	readonly violated?: boolean
	/** No heading YET — the resolver hasn't answered. Distinct from a heading-less line, which is a
	 * genuinely dangling pointer: an owned line knows only its target's uid until the view lands, so
	 * without this every editor open would flash "Unknown entry" over links that are perfectly fine. */
	readonly pending?: boolean
	readonly remove: () => void
	/** Absent where there is nothing to go to: a pointer still resolving, or a dangling one. */
	readonly open?: () => void
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
		updated(this: RelationsField) { this.closePicker(); this.error = undefined },
	}) entry!: Entry

	/** The palette's contract: the calendar navigates to the date, and the intent opens the editor once
	 * the segment renders there. Bubbles composed, so it reaches the page from inside a popover. */
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>

	/** Subscribed, because everything this renders is derived: the entry's own lines, and the headings
	 * the graph resolves for them. Without it a removal stayed on screen until some other state changed. */
	readonly store = new EntryStore(this)

	@state() private suggestions = new Array<Entry>()
	@state() private activeIndex = -1
	@state() private pendingType: RelationType = RelationType.authorable[0]!
	/** The query the shown suggestions answer — '' before any search, so the results area can tell
	 * "type something" apart from "nothing matched". */
	@state() private searchedQuery = ''
	/** A terminal save rejection (self-reference/cycle → 400) surfaced inline; cleared on interaction. */
	@state() private error?: string

	// Responses may resolve out of order; only the latest issued request's may land.
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

	/** The entry's relationships as the domain sees them — BOTH directions, already bucketed and
	 * silenced. Read paths attach the derived half, so there is nothing to fetch: an occurrence
	 * carries its master's list, and the closure names every entry a line can point at. */
	private get relationList() {
		return this.entry.relationList
	}

	/** The entries a line's endpoints name — this entry itself, a resolved target, or the owner of a
	 * derived line — so a coupling can be judged from either side by the same expression. */
	private entryOf(uid: string): Entry | undefined {
		return uid === this.entry.uid ? this.entry : Relations.entryOf(uid) ?? this.resolvedByUid.get(uid)
	}

	/** Renders sections for display, including empty authorable sections supported by the source provider. */
	private get sections(): Array<{ section: RelationSection, lines: Array<Line>, addType?: RelationType }> {
		const list = this.relationList
		const bySection = new Map(list.sections.map(({ section, lines }) => [section, lines.map(line => this.lineOf(line))]))
		// Providers without native link storage omit authoring actions, but incoming links remain visible.
		const authorable = getCapabilities(this.entry.sourceId).relations ? AUTHORABLE_BY_SECTION : new Map<RelationSection, RelationType>()
		return [...new Set([...bySection.keys(), ...authorable.keys()])]
			.sort((a, b) => a.rank - b.rank)
			.map(section => ({ section, lines: bySection.get(section) ?? [], addType: authorable.get(section) }))
	}

	private lineOf(line: RelationLine): Line {
		const other = this.entryOf(line.otherUid)
		const from = line.edge && this.entryOf(line.edge.from)
		const to = line.edge && this.entryOf(line.edge.to)
		return {
			target: other,
			heading: other?.heading,
			// Shows pending placeholder until relation closure lands to distinguish unloaded from dangling links.
			pending: !Relations.loaded,
			violated: !!line.edge && !!from && !!to && line.edge.violatedBy(from, to),
			open: other && this.opener(other),
			// Removals update this entry for outgoing lines, or the owning entry for incoming lines.
			remove: line.direction === 'outgoing'
				? () => this.removeOutgoing(line.relation)
				: () => { this.removeIncoming(line).catch(() => void 0) },
		}
	}

	/** Navigates to a related entry in the calendar, or triggers editor directly for undated entries. */
	private opener(target: Entry) {
		return !target.id ? undefined : () => {
			this.closest('mitra-entry-details')?.hidePopover()
			if (target.start) {
				this.navigate.dispatch(target.start)
			}
			EntryEditorIntent.requestOpen(target.id!)
		}
	}

	// --- Owned lines ------------------------------------------------------------------------------------

	/** Persists relations via partial update to the series master. */
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

	// Named to avoid conflicts with HTMLElement.prototype.remove.
	private removeOutgoing(relation: Relation) {
		this.commit(() => this.entry.unrelate(relation))
	}

	// --- Derived lines ----------------------------------------------------------------------------------

	private async removeIncoming(line: RelationLine) {
		// Removes the reference from the remote owning entry and updates its tracked store copy.
		const owner = Relations.entryOf(line.ownerUid)
		if (!owner?.id || !this.entry.uid) {
			return
		}
		this.error = undefined
		const remaining = (owner.relationList.writes ?? []).filter(relation => !(RelationType.of(relation.type) === line.type && relation.targetUid === this.entry.uid))
		try {
			EntryStore.adoptRelations(await updateRelations(owner.id, remaining.length ? [...remaining] : null))
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error)
		}
	}

	/** Updates status on the store's tracked instance if present, falling back to direct API write for untracked entries. */
	private async handleTargetStatusChange(target: Entry) {
		EntryStore.notify()
		if (!target.persisted) {
			this.requestUpdate()
			return
		}
		const tracked = EntryStore.entries.find(entry => entry.id === target.id)
		if (tracked && tracked !== target) {
			tracked.status = target.status
			tracked.percentComplete = target.percentComplete
			EntryStore.notify()
		}
		const saved = tracked ?? target
		await (tracked ? EntryStore.commit(tracked) : updateEvent(target)).catch(() => void 0)
		// Direct API writes bypass EntryStore.onTaskClosed, so trigger follow-up offers explicitly.
		if (saved.closed) {
			offerFollowUps(saved).catch(() => void 0)
		}
		this.requestUpdate()
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

					> .tally {
						grid-column: 3;
						grid-row: 1;
						color: var(--color-text-muted);
						font-variant-numeric: tabular-nums;
						font-size: 0.8rem;
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
						gap: 0.375rem;
						min-width: 0;

						> mitra-task-status {
							font-size: 0.85rem;
							inline-size: 0.85rem;
							block-size: 0.85rem;
							flex-shrink: 0;
						}

						> mitra-icon.glyph {
							font-size: 0.8rem;
							inline-size: 0.85rem;
							block-size: 0.85rem;
							display: flex;
							align-items: center;
							justify-content: center;
							flex-shrink: 0;
							color: var(--color-text-muted);
						}

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

						&[data-struck] > .heading {
							text-decoration: line-through;
							color: var(--color-text-muted);
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

						/* A line that leads somewhere is a button, and a button inside a field row takes none of the
						   standalone button chrome (button.css.ts) — so it only has to shed the UA's own. */
						> button.heading {
							background: none;
							border: none;
							padding: 0;
							font: inherit;
							color: inherit;
							text-align: start;
							cursor: pointer;

							&:hover,
							&:focus-visible {
								text-decoration: underline;
							}
						}

						&[data-struck] > button.heading {
							&:hover,
							&:focus-visible {
								text-decoration: line-through underline;
							}
						}

						/* A broken dependency, in the app's one status colour — the same signal the calendar's
						   connector wears, on the line that owns it rather than over the whole field. */
						&[data-violated] > .heading {
							color: var(--color-error);
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
						height: 180px;
					}

					/* The search reads as a plain row of the popover (no box, no focus ring — the caret
					   and the filtering are feedback enough), separated by a hairline. */
					> input.search {
						border: none;
						border-bottom: var(--border);
						border-radius: 0;
						background: transparent;
						padding: 0.375rem 0.5rem;
						font-size: 0.8125rem;
						color: var(--color-text);
						outline: none;

						&::placeholder {
							color: var(--color-text-muted);
						}
					}

					> .results {
						flex: 1;
						min-height: 0;
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

							&[data-struck] > .text {
								text-decoration: line-through;
								color: var(--color-text-muted);
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

	private get rollup() {
		return Relations.rollupOf(this.entry)
	}

	/** Synchronizes data-empty attribute with rendered sections for popover separator styling. */
	protected override updated() {
		this.toggleAttribute('data-empty', !this.sections.length)
	}

	protected override get template() {
		// Drafts author relations too — the list rides the create. Only the view fetch (resolved
		// names, incoming lines) waits for identity; nothing can point at a draft yet anyway.
		return !this.entry ? html.nothing : html`
			${this.sections.map(section => this.sectionTemplate(section))}
			${!this.error ? html.nothing : html`<span class="error">${this.error}</span>`}
		`
	}

	private sectionTemplate({ section, lines, addType }: { section: RelationSection, lines: Array<Line>, addType?: RelationType }) {
		// A derived/read-only family exists only through its lines — there is nothing to author from
		// this side, so an empty one has no row at all (and no add button when it does).
		return !lines.length && !addType ? html.nothing : html`
			<div class="row field" data-section=${section.value}>
				<mitra-icon icon=${section.icon}></mitra-icon>
				<div class="lines">
					<span class="kind">${section.format()}</span>
					${section !== RelationSection.Subtasks || !this.rollup?.total ? html.nothing : html`
						<span class="tally" title=${t('${done} of ${total:pluralityNumber} subtasks done', { done: this.rollup.done.format(), total: this.rollup.total })}>
							${this.rollup.done.format()}/${this.rollup.total.format()}
						</span>
					`}
					${lines.map(line => {
						const heading = line.heading ?? html`<span class="unresolved">${line.pending ? '…' : t('Unknown entry')}</span>`
						const target = line.target
						const isTask = target?.type.isTask ?? false
						const isDone = isTask && (target?.done || target?.status === TaskStatus.Done || target?.status === TaskStatus.Cancelled)
						const color = target ? (target.color || getSource(target.sourceId)?.color) : undefined

						return html`
							<span class="relation"
								data-status=${target?.status ?? (isTask ? 'todo' : 'none')}
								?data-struck=${isDone}
								?data-violated=${line.violated}
							>
								${!target ? html.nothing : isTask ? html`
									<mitra-task-status
										style=${color ? `color: ${color};` : ''}
										.entry=${target}
										@change=${() => this.handleTargetStatusChange(target)}
									></mitra-task-status>
								` : html`
									<mitra-icon class="glyph" icon="calendar" style=${color ? `color: ${color};` : ''}></mitra-icon>
								`}
								${!line.open
									? html`<span class="heading">${heading}</span>`
									: html`<button type="button" class="heading" @click=${line.open}>${heading}</button>`}
								<mitra-icon-button icon="x" label=${t('Remove relationship')}
									@click=${() => line.remove()}
								></mitra-icon-button>
							</span>
						`
					})}
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
					` : this.suggestions.map((candidate, index) => {
						const color = candidate.color || getSource(candidate.sourceId)?.color
						const isDone = candidate.type === EntryType.Task && candidate.done
						return html`
							<button type="button" ?data-active=${index === this.activeIndex} ?data-struck=${isDone}
								@pointerdown=${(e: Event) => e.preventDefault()}
								@click=${() => this.pick(candidate)}>
								<mitra-icon class="glyph" icon=${candidate.type === EntryType.Task ? 'list-todo' : 'calendar'}
									style=${color ? `color: ${color};` : ''}
								></mitra-icon>
								<span class="text">
									${candidate.heading}
									${!candidate.start ? html.nothing : html`<span class="when"> · ${candidate.start.format({ month: 'short', day: 'numeric' })}</span>`}
								</span>
							</button>
						`
					})}
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
