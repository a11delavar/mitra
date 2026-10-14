import { Component, component, html, css, property, state } from '@a11d/lit'
import { RelationType, RelationSection } from '../RelationType.js'
import { type Relation } from '../Relation.js'
import { EntryType } from '../../entries/EntryType.js'
import { EntryRelations, type RelationLine } from '../EntryRelations.js'
import { type Entry } from '../../entries/Entry.js'
import { searchEntries, updateRelations } from '../../../infrastructure/http/Api.js'
import { Calendars } from '../../sources/client/Calendars.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { Relations } from './Relations.js'
import { controlHeight } from '../../../design/controlHeight.css.js'
import './EntryLink.js'
import { LatestSearch } from '../../../design/Combobox.js'
import { type Popover } from '../../../design/Popover.js'

/** The authorable families keyed by the section their lines land in. Each section always renders as its own row with
 * its own add action, opening the picker preset to its type. */
const AUTHORABLE_BY_SECTION = new Map(RelationType.authorable.map(type => [type.section, type]))

/** One rendered line and how to undo it: an outgoing removal edits this entry, a derived one the other entry. */
interface Line {
	readonly target?: Entry
	readonly heading?: string
	/** This line's dependency is already broken by the two entries' times (see {@link Entry.violates}). */
	readonly violated?: boolean
	/** The resolver hasn't answered yet, unlike a dangling pointer, which has no heading for good.
	 * Without it every editor open would flash "Unknown entry" over valid links. */
	readonly pending?: boolean
	readonly remove: () => void
}

/**
 * One `.field` row per section, subgridding the popover's two columns; the section label stays beside values,
 * since mirror pairs share a glyph. The field persists relations itself, outside the entry's dirty tracking,
 * and reverts an edit the server refuses (a cycle, 400).
 */
@component('mitra-relations-field')
export class RelationsField extends Component {
	@property({
		type: Object,
		// The popover is reused across entries, so the previous entry's picker and fetched view must go.
		updated(this: RelationsField) { this.closePicker(); this.error = undefined },
	}) entry!: Entry

	/** Subscribed, because everything this renders derives from the entry and the headings the graph resolves. */
	readonly store = new EntryStore(this)

	@state() private suggestions = new Array<Entry>()
	@state() private pendingType: RelationType = RelationType.authorable[0]!
	/** The query the shown suggestions answer, '' before any search, so the results area can tell
	 * "type something" apart from "nothing matched". */
	@state() private searchedQuery = ''
	/** A terminal save rejection (self-reference/cycle → 400) surfaced inline; cleared on interaction. */
	@state() private error?: string

	private readonly search = new LatestSearch((query: string) => query ? searchEntries(query).catch(() => new Array<Entry>()) : Promise.resolve(new Array<Entry>()), 250)

	/** Target entries by uid, for naming owned lines: fed by the fetched view and by picked
	 * suggestions, so a just-added line has its name before any refetch. */
	private readonly resolvedByUid = new Map<string, Entry>()

	protected override createRenderRoot() { return this }

	/** Relationships live on the series MASTER: an occurrence reads/edits its master's. */
	private get targetId() { return this.entry.recurringEntryId ?? this.entry.id }

	/** Both directions, already bucketed and silenced; read paths attach the derived half, so nothing is fetched. */
	private get relations() {
		return this.entry.relations ?? EntryRelations.none
	}

	/** The entries a line's endpoints name (this entry itself, a resolved target, or the owner of a
	 * derived line), so a coupling can be judged from either side by the same expression. */
	private entryOf(uid: string): Entry | undefined {
		return uid === this.entry.uid ? this.entry : Relations.entryOf(uid) ?? this.resolvedByUid.get(uid)
	}

	/** Renders sections for display, including empty authorable sections supported by the source provider. */
	private get sections(): Array<{ section: RelationSection, lines: Array<Line>, addType?: RelationType }> {
		const bySection = new Map(this.relations.sections(this.entry.uid).map(({ section, lines }) => [section, lines.map(line => this.lineOf(line))]))
		// Providers without native link storage omit authoring actions, but incoming links remain visible.
		const authorable = Calendars.ownershipOf(this.entry.sourceId).holds('relations') ? AUTHORABLE_BY_SECTION : new Map<RelationSection, RelationType>()
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
			remove: line.direction === 'outgoing'
				? () => this.removeOutgoing(line.relation)
				: () => { this.removeIncoming(line).catch(() => void 0) },
		}
	}

	private commit(mutate: () => void) {
		this.error = undefined
		EntryStore.commitRelations(this.entry, mutate).catch((error: unknown) => {
			this.error = error instanceof Error ? error.message : t('This relationship is not possible')
		})
	}

	// Named to avoid conflicts with HTMLElement.prototype.remove.
	private removeOutgoing(relation: Relation) {
		this.commit(() => this.entry.unrelate(relation))
	}

	private async removeIncoming(line: RelationLine) {
		const owner = Relations.entryOf(line.ownerUid)
		if (!owner?.id || !this.entry.uid) {
			return
		}
		this.error = undefined
		const remaining = EntryRelations.of((owner.relations?.writes ?? []).filter(relation => !(RelationType.of(relation.type) === line.type && relation.targetUid === this.entry.uid)))
		try {
			EntryStore.adoptRelations(await updateRelations(owner.id, remaining))
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error)
		}
	}

	/** Opening a row's picker starts the search over, as results are filtered against that row's family. */
	private handlePickerToggle(type: RelationType, open: boolean) {
		this.resetSearch()
		if (open) {
			this.error = undefined
			this.pendingType = type
		}
	}

	private resetSearch() {
		this.search.cancel()
		this.suggestions = []
		this.searchedQuery = ''
		this.querySelectorAll<HTMLElementTagNameMap['mitra-search-field']>('.picker mitra-search-field').forEach(field => field.value = '')
	}

	private closePicker() {
		this.resetSearch()
		this.querySelectorAll<Popover>('mitra-popover.picker').forEach(picker => picker.hide())
	}

	private readonly handleInput = async (e: Event) => {
		const query = (e.target as HTMLInputElement).value.trim()
		const results = await this.search.run(query)
		if (!this.isConnected) {
			return
		}
		// Already related only within the pending family: being a subtask of X doesn't preclude "Blocked by X".
		const family = this.pendingType.family
		const related = new Set(this.relations.all.filter(relation => RelationType.of(relation.type).family === family).map(relation => relation.targetUid))
		this.suggestions = results.filter(candidate =>
			!!candidate.uid // uid-less rows can't be pointed at
			&& candidate.uid !== this.entry.uid && candidate.id !== this.targetId
			&& !candidate.recurrenceId // an override row stands behind its master
			&& !related.has(candidate.uid))
		this.searchedQuery = query
	}

	private pick(candidate: Entry) {
		this.resolvedByUid.set(candidate.uid!, candidate)
		this.commit(() => this.entry.relateTo(this.pendingType, candidate.uid!))
		this.closePicker()
	}

	static override get styles() {
		return css`
			mitra-relations-field {
				/* Each section is a row of the popover's own two-column grid, a sibling of Location and Reminders. */
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

					/* The box bleeds past the columns to wrap glyph and content as one control, as li.field rows do,
					   so the row lines up with the Reminders row above it. */
					&.field { margin-inline: -0.5rem; }

					> mitra-icon {
						grid-column: 1;
						font-size: 0.87rem;
						color: var(--color-text-muted);
						flex-shrink: 0;
					}
				}

				/* The add button holds the end of the first line, so it stays put as the list grows. */
				> .row > .lines {
					grid-column: 2;
					min-width: 0;
					display: grid;
					grid-template-columns: max-content minmax(0, 1fr) auto;
					/* The FIRST line spans the control height, so the field glyph's first-line pin (see
					   editorFields.css.ts) stays centred on it however many lines follow. */
					grid-template-rows: minmax(calc(var(--control-height) - 2px), auto);
					align-items: center;
					column-gap: 0.5rem;
					row-gap: 0.25rem;

					/* Later lines are bare text, so a grown row gets the same air below them that the
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

					> mitra-popover-container > .add {
						grid-column: 3;
						grid-row: 1;
						color: var(--color-text-muted);
						/* Swallow the button's own padding so it never stretches the row past a line's height. */
						margin-block: -0.25rem;
					}

					> .relation {
						grid-column: 2;
						display: flex;
						align-items: center;
						gap: 0.375rem;
						min-width: 0;

						> .unresolved {
							flex: 1;
							min-width: 0;
							color: var(--color-text-muted);
							font-style: italic;
						}

						> mitra-icon-button {
							color: var(--color-text-muted);
							margin-block: -0.25rem;
							opacity: 0;
							transition: opacity 0.15s ease;
						}

						&:hover > mitra-icon-button,
						> mitra-icon-button:focus-within {
							opacity: 1;
						}

						/* A broken dependency, in the app's one status colour: the same signal the calendar's
						   connector wears, on the line that owns it rather than over the whole field. */
						&[data-violated] > mitra-entry-link > .heading {
							color: var(--color-error);
						}
					}
				}

				> .error {
					grid-column: 2;
					font-size: 0.6875rem;
					color: var(--color-error);
				}

				/* A search over a results pane of fixed height, so nothing shifts as results come and go. */
				mitra-popover.picker {
					padding: 0;
					inline-size: 280px;
					max-inline-size: calc(100dvw - 0.75rem);

					&:popover-open {
						display: flex;
						flex-direction: column;
						block-size: 180px;
					}

					mitra-search-field {
						flex-shrink: 0;
						border-block-end: var(--border);
					}

					mitra-listbox {
						flex: 1;
						min-block-size: 0;
						padding: 0.25rem;
					}

					.hint {
						margin: auto;
						padding-inline: 1rem;
						text-align: center;
						color: var(--color-text-muted);
						font-size: 0.75rem;
					}

					mitra-option {
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
								color: var(--color-text-muted);
							}
						}

						&[data-struck] > .text {
							text-decoration: line-through;
							color: var(--color-text-muted);
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
		// Drafts author relations too: the list rides the create. Only the view fetch (resolved
		// names, incoming lines) waits for identity; nothing can point at a draft yet anyway.
		return !this.entry ? html.nothing : html`
			${this.sections.map(section => this.sectionTemplate(section))}
			${!this.error ? html.nothing : html`<span class="error">${this.error}</span>`}
		`
	}

	private sectionTemplate({ section, lines, addType }: { section: RelationSection, lines: Array<Line>, addType?: RelationType }) {
		// A derived or read-only family exists only through its lines, so an empty one has no row.
		return !lines.length && !addType ? html.nothing : html`
			<div class="row field" data-section=${section.value}>
				<mitra-icon icon=${section.icon}></mitra-icon>
				<div class="lines">
					<span class="kind">${section.format()}</span>
					${section !== RelationSection.Subtasks || !this.rollup?.subtasks.total ? html.nothing : html`
						<span class="tally" title=${t('${done:number} of ${total:pluralityNumber} subtasks done', this.rollup.subtasks)}>
							${this.rollup.subtasks.done.format()}/${this.rollup.subtasks.total.format()}
						</span>
					`}
					${lines.map(line => html`
						<span class="relation" ?data-violated=${line.violated}>
							${line.target
								? html`<mitra-entry-link .entry=${line.target}></mitra-entry-link>`
								: html`<span class="heading unresolved">${line.pending ? '…' : t('Unknown entry')}</span>`}
							<mitra-icon-button size="small" icon="x" label=${t('Remove relationship')}
								@click=${() => line.remove()}
							></mitra-icon-button>
						</span>
					`)}
					${!addType ? html.nothing : html`
						<mitra-popover-container>
							<mitra-icon-button size="small" class="add" icon="plus" label=${t('Add relationship')}></mitra-icon-button>
							${this.pickerTemplate(addType)}
						</mitra-popover-container>
					`}
				</div>
			</div>
		`
	}

	private pickerTemplate(type: RelationType) {
		return html`
			<mitra-popover slot="popover" class="picker" @openChange=${(e: CustomEvent<boolean>) => this.handlePickerToggle(type, e.detail)}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				<mitra-combobox inline activateFirst @pick=${(e: CustomEvent<Entry>) => this.pick(e.detail)}
					@dismiss=${(e: Event) => ((e.currentTarget as HTMLElement).parentElement as Popover).hide()}>
					<mitra-search-field slot="input" plain autofocus placeholder=${t('Search entries…')} @input=${this.handleInput}></mitra-search-field>
					<mitra-listbox aria-label=${t('Search entries…')}>
						${this.pendingType !== type || !this.suggestions.length ? html`
							<span class="hint" data-hint>${this.searchedQuery ? t('No matching entries') : t('Search for an event or task to link')}</span>
						` : this.suggestions.map(candidate => {
							const color = candidate.color || Calendars.source(candidate.sourceId)?.color
							return html`
								<mitra-option .value=${candidate} ?data-struck=${candidate.type === EntryType.Task && candidate.done}>
									<mitra-icon class="glyph" icon=${candidate.type === EntryType.Task ? 'list-todo' : 'calendar'} style=${color ? `color: ${color};` : ''}></mitra-icon>
									<span class="text">
										${candidate.heading}
										${!candidate.start ? html.nothing : html`<span class="when"> · ${candidate.start.format({ month: 'short', day: 'numeric' })}</span>`}
									</span>
								</mitra-option>
							`
						})}
					</mitra-listbox>
				</mitra-combobox>
			</mitra-popover>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-relations-field': RelationsField
	}
}
