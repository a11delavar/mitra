import { Component, component, html, css, property, event, type PropertyValues } from '@a11d/lit'
import { TaskStatus, type Entry } from '#features/entries'
import type { Source } from '#features/sources'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { DialogDeleteEntries } from '#features/entries/client/DialogDeleteEntries.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import type { EntryOccurrenceChangeScope } from '#features/recurrence'
import { type TableRow } from './TableRow.js'

/**
 * What can be done to the selected rows at once. Each row reaches what it stands for: one occurrence, as
 * Ctrl does on the grids, or, where the table lists everything, a whole series.
 */
@component('mitra-table-selection')
export class TableSelection extends Component {
	@property({ type: Array }) rows: ReadonlyArray<TableRow> = []

	@event() readonly clear!: EventDispatcher

	/** What the bar reads while it leaves: emptying the selection must not empty the bar mid-transition. */
	private shown: ReadonlyArray<TableRow> = []

	/** A series has no one status to set: each occurrence keeps its own. */
	private static editable({ entry, series }: TableRow) {
		return !series && entry.type.isTask && entry.source.capabilities.entries.edit
	}

	private static deletable({ entry }: TableRow) {
		return entry.persisted && entry.source.capabilities.entries.delete
	}

	/** An occurrence cannot change its type on the way, so it only moves where its type is at home, and a whole series only where it can repeat. */
	private static movable(row: TableRow, to: Source) {
		const { entry } = row
		return TableSelection.deletable(row) && entry.sourceId !== to.id
			&& (!entry.partOfSeries || to.supportsEntryType(entry.type))
			&& (!row.series || to.ownership.holds('recurrence'))
	}

	/**
	 * What the rows' edits change, each with how far it reaches, run in parallel across entries and in turn within a
	 * recurring entry: its occurrences share its exclusions, which parallel writes would race on.
	 */
	private static async write(rows: ReadonlyArray<TableRow>, edit: (entry: Entry) => void, write: (entry: Entry, scope?: EntryOccurrenceChangeScope) => Promise<unknown>) {
		const edits = rows.map(row => ({ entry: row.editable(), scope: row.scope }))
		edits.forEach(({ entry }) => edit(entry))
		EntryStore.notify()
		await Promise.all([...Map.groupBy(edits, ({ entry }) => entry.recurringEntryId ?? entry).values()].map(async ofOne => {
			for (const { entry, scope } of ofOne) {
				await write(entry, scope).catch(error => console.error('Changing the entry failed, so it was restored in the view:', error))
			}
		}))
	}

	private setStatus(status: TaskStatus) {
		const rows = this.rows.filter(row => TableSelection.editable(row) && row.entry.status !== status)
		void TableSelection.write(rows, entry => entry.setStatus(status, entry.source.ownership), entry => EntryStore.commit(entry))
	}

	private moveTo(source: Source) {
		const rows = this.rows.filter(row => TableSelection.movable(row, source))
		void TableSelection.write(rows, entry => entry.migrateTo(source), (entry, scope) => EntryStore.commit(entry, scope))
	}

	async delete() {
		const rows = this.rows.filter(TableSelection.deletable)
		const series = rows.filter(row => row.series).length
		if (!rows.length || !await new DialogDeleteEntries({ count: rows.length, series }).confirm().catch(() => false)) {
			return
		}
		this.clear.dispatch()
		await TableSelection.write(rows, () => void 0, (entry, scope) => EntryStore.delete(entry, scope))
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		if (this.rows.length) {
			this.shown = this.rows
		}
		this.hidden = this.inert = !this.rows.length
	}

	static override get styles() {
		return css`
			/* Stays mounted, so it can leave as it came: from and back to no height at all. */
			mitra-table-selection {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 1.25rem 0.75rem;
				border-block-start: 1px solid var(--_rule);
				interpolate-size: allow-keywords;
				overflow: clip;
				transition:
					block-size 0.2s cubic-bezier(0.4, 0, 0.2, 1),
					padding-block 0.2s cubic-bezier(0.4, 0, 0.2, 1),
					opacity 0.2s ease,
					display 0.2s allow-discrete;

				@starting-style {
					block-size: 0;
					padding-block: 0;
					opacity: 0;
				}

				&[hidden] {
					display: none;
					block-size: 0;
					padding-block: 0;
					opacity: 0;
				}

				@media (prefers-reduced-motion: reduce) {
					transition: none;
				}

				> .count {
					font-size: 0.75rem;
					font-weight: 600;
					color: var(--color-text-muted);
					white-space: nowrap;
				}

				> .spacer {
					flex: 1;
				}

				mitra-menu {
					position-area: block-end span-inline-end;
				}

			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const rows = this.shown
		const destinations = Calendars.enabled().filter(source => !source.readOnly && source.capabilities.entries.create
			&& rows.some(row => TableSelection.movable(row, source)))
		return html`
			<span class="count">${t('${count:pluralityNumber} selected', { count: rows.length })}</span>
			${!rows.some(TableSelection.editable) ? html.nothing : [TaskStatus.ToDo, TaskStatus.Done, TaskStatus.Cancelled].map(status => html`
				<mitra-button @click=${() => this.setStatus(status)}>
					<mitra-icon icon=${status.icon}></mitra-icon>
					${status.format()}
				</mitra-button>
			`)}
			${!destinations.length ? html.nothing : html`
				<mitra-popover-container>
					<mitra-button>
						<mitra-icon icon="folder-input"></mitra-icon>
						${t('Move to…')}
					</mitra-button>
					<mitra-menu slot="popover">
						${destinations.map(source => html`
							<mitra-menu-item @click=${() => this.moveTo(source)}>
								<mitra-source-icon .source=${source}></mitra-source-icon>
								${source.name}
							</mitra-menu-item>
						`)}
					</mitra-menu>
				</mitra-popover-container>
			`}
			${!rows.some(TableSelection.deletable) ? html.nothing : html`
				<mitra-button variant="danger" @click=${() => void this.delete()}>
					<mitra-icon icon="trash-2"></mitra-icon>
					${t('Delete')}
				</mitra-button>
			`}
			<span class="spacer"></span>
			<mitra-button @click=${() => this.clear.dispatch()}>
				<mitra-icon icon="x"></mitra-icon>
				${t('Clear selection')}
			</mitra-button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-table-selection': TableSelection
	}
}
