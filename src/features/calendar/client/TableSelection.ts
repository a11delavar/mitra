import { Component, component, html, css, property, event, type PropertyValues } from '@a11d/lit'
import { TaskStatus } from '../../entries/Entry.js'
import { type Source } from '../../sources/Source.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { taskStatusIcon, taskStatusLabel } from '../../entries/client/TaskStatus.js'
import { closeTask } from '../../entries/client/taskClosure.js'
import { DialogDeleteEntries } from '../../entries/client/DialogDeleteEntries.js'
import { getCapabilities, getEnabledSources } from '../../../infrastructure/http/Api.js'
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
		return !series && entry.type.isTask && getCapabilities(entry.sourceId).editEntries
	}

	private static deletable({ entry }: TableRow) {
		return entry.persisted && getCapabilities(entry.sourceId).deleteEntries
	}

	/** An occurrence cannot change its type on the way, so it only moves where its type is at home, and a whole series only where it can repeat. */
	private static movable(row: TableRow, to: Source) {
		const { entry } = row
		return TableSelection.deletable(row) && entry.sourceId !== to.id
			&& (!entry.partOfSeries || to.supportsEntryType(entry.type))
			&& (!row.series || getCapabilities(to.id).recurrence)
	}

	/** Parallel across entries, in turn within a series: its occurrences share one master, whose exclusions parallel writes would race on. */
	private static async write(rows: ReadonlyArray<TableRow>, write: (row: TableRow) => Promise<unknown>) {
		await Promise.all([...Map.groupBy(rows, row => row.entry.recurrenceMasterId ?? row.entry).values()].map(async series => {
			for (const row of series) {
				await write(row).catch(error => console.error('Changing the entry failed, so it was restored in the view:', error))
			}
		}))
	}

	private setStatus(status: TaskStatus) {
		const rows = this.rows.filter(row => TableSelection.editable(row) && row.entry.status !== status)
		rows.forEach(row => closeTask(row.entry, status))
		EntryStore.notify()
		void TableSelection.write(rows, row => EntryStore.commit(row.entry))
	}

	private moveTo(source: Source) {
		const rows = this.rows.filter(row => TableSelection.movable(row, source))
		rows.forEach(row => row.entry.migrateTo(source))
		EntryStore.notify()
		void TableSelection.write(rows, row => EntryStore.commit(row.entry, row.scope))
	}

	async delete() {
		const rows = this.rows.filter(TableSelection.deletable)
		const series = rows.filter(row => row.series).length
		if (!rows.length || !await new DialogDeleteEntries({ count: rows.length, series }).confirm().catch(() => false)) {
			return
		}
		this.clear.dispatch()
		await TableSelection.write(rows, row => EntryStore.delete(row.entry, row.scope))
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
		const destinations = getEnabledSources().filter(source => !source.readOnly && getCapabilities(source.id).createEntries
			&& rows.some(row => TableSelection.movable(row, source)))
		return html`
			<span class="count">${t('${count:pluralityNumber} selected', { count: rows.length })}</span>
			${!rows.some(TableSelection.editable) ? html.nothing : [TaskStatus.ToDo, TaskStatus.Done, TaskStatus.Cancelled].map(status => html`
				<mitra-button @click=${() => this.setStatus(status)}>
					<mitra-icon icon=${taskStatusIcon.get(status)!}></mitra-icon>
					${taskStatusLabel(status)}
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
