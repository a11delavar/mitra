import { Component, component, html, css, property, state, event, query, ifDefined } from '@a11d/lit'
import { type DataGridColumn, DataGridSortingStrategy } from '@3mo/data-grid/controller'
import { TaskStatus } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { type Source } from '../../sources/Source.js'
import { taskStatusIcon, taskStatusLabel } from '../../entries/client/TaskStatus.js'
import { getVisibleSources } from '../../../infrastructure/http/Api.js'
import { TableRow, TableFilter, type TableFacet } from './TableRow.js'
import { TableWindow } from './TableWindow.js'
import { hideable } from './TableColumns.js'
import { type Menu } from '../../../design/Menu.js'
import { checkmark } from '../../../design/checkmark.css.js'
import { selectedColor } from '../../../design/selected.css.js'

interface TableFilterOption {
	readonly value: string
	readonly label: string
	readonly icon?: string
	readonly source?: Source
}

/** One menu for every heading, shown under the one it opened from: sorting, the column's filter, and hiding it. */
@component('mitra-table-column-menu')
export class TableColumnMenu extends Component {
	@property({ type: Object }) filter = new TableFilter()
	@property({ type: Object }) window = TableWindow.default

	@event() readonly filterChange!: EventDispatcher<TableFilter>
	@event() readonly windowChange!: EventDispatcher<TableWindow>

	@state() private column?: DataGridColumn<TableRow>

	@query('mitra-menu') private readonly menu!: Menu

	private static options(facet: TableFacet): Array<TableFilterOption> {
		switch (facet) {
			case 'statusRank': return [
				...[TaskStatus.ToDo, TaskStatus.Doing, TaskStatus.Done, TaskStatus.Cancelled].map(status => ({ value: status, label: taskStatusLabel(status), icon: taskStatusIcon.get(status) })),
				{ value: TableRow.noStatus, label: t('No status') },
			]
			case 'typeKey': return EntryType.all.map(type => ({ value: type.value, label: type.format() }))
			case 'sourceName': return getVisibleSources().map(source => ({ value: source.id, label: source.name, source }))
			case 'repeats': return [
				{ value: 'repeating', label: t('Repeating'), icon: 'repeat' },
				{ value: 'once', label: t('Does not repeat') },
			]
		}
	}

	private pressedOpen = false

	/** Light dismiss closes the menu before the click ending this press arrives, so whether it was open for the column is read now. */
	press(column: DataGridColumn<TableRow>) {
		this.pressedOpen = this.isOpenFor(column)
	}

	/** Opens the column's menu under its heading, or closes it again. */
	async toggle(column: DataGridColumn<TableRow>, heading: HTMLElement) {
		const closing = this.pressedOpen || this.isOpenFor(column)
		this.pressedOpen = false
		this.close()
		if (!closing) {
			this.column = column
			await this.updateComplete
			this.menu.show(heading)
		}
	}

	private isOpenFor(column: DataGridColumn<TableRow>) {
		return this.menu.open && this.column?.dataSelector === column.dataSelector
	}

	private close() {
		this.menu.hide()
	}

	/** A click includes or leaves out one value; with Alt, it keeps that value alone, or all of them again, as Alt does on a calendar's eye. */
	private toggleValue(facet: TableFacet, value: string, e: MouseEvent) {
		const excluded = this.filter.excluded.get(facet) ?? new Set<string>()
		const others = TableColumnMenu.options(facet).map(option => option.value).filter(option => option !== value)
		const alone = !excluded.has(value) && others.every(option => excluded.has(option))
		this.filterChange.dispatch(this.filter.excluding(facet, !e.altKey ? excluded.symmetricDifference(new Set([value])) : new Set(alone ? [] : others)))
	}

	static override get styles() {
		return css`
			mitra-table-column-menu {
				display: contents;

				/* Hangs from the heading's start edge, or its end edge where the heading sits near the end. */
				> mitra-menu {
					position-area: block-end span-inline-end;
					position-try-fallbacks: flip-inline, flip-block, flip-block flip-inline;

					/* The two days a custom range spans, under a label ticked like the presets above it while it is in force. */
					> .range {
						display: grid;
						grid-template-columns: 1fr 1fr;
						gap: 0.25rem;
						padding: 0.25rem 0.625rem 0.375rem;

						> .label {
							grid-column: 1 / -1;
							position: relative;
							padding-inline-start: 1.375rem;
							font-size: 0.8125rem;
							font-weight: 500;

							&[data-checked]::before {
								${checkmark};
								inset-inline-start: 0;
								background-color: ${selectedColor};
							}
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const { column } = this
		return html`
			<mitra-menu>
				${!column ? html.nothing : html`
					${this.sortingTemplate(column)}
					${this.filterTemplate(column)}
					${column.dataSelector === 'when' ? this.windowTemplate : html.nothing}
					${!hideable(column) ? html.nothing : html`
						<hr>
						<mitra-menu-item icon="eye-off" @click=${() => column.hide()}>${t('Hide column')}</mitra-menu-item>
					`}
				`}
			</mitra-menu>
		`
	}

	/** Choosing the order in force again takes it away. Shift, Ctrl or Meta adds the column to the sorting. */
	private sortingTemplate(column: DataGridColumn<TableRow>) {
		const strategy = column.sortingDefinition?.strategy
		return [DataGridSortingStrategy.Ascending, DataGridSortingStrategy.Descending].map(option => html`
			<mitra-menu-item type="radio" ?selected=${strategy === option} icon=${option === DataGridSortingStrategy.Ascending ? 'arrow-up' : 'arrow-down'}
				@click=${(e: MouseEvent) => column.toggleSort(option, e)}
			>${option === DataGridSortingStrategy.Ascending ? t('Sort ascending') : t('Sort descending')}</mitra-menu-item>
		`)
	}

	/** The When column's filter is the window the table fetches: one choice among the presets, or two days of the user's own. */
	private get windowTemplate() {
		const { window } = this
		const custom = window.kind === 'custom'
		const { start, end } = window.bounds() ?? TableWindow.default.bounds()!
		const choose = (from: string, to: string) => {
			const range = TableWindow.parse(`custom:${from}:${to}`)
			if (range) {
				this.windowChange.dispatch(range)
			}
		}
		const day = TableWindow.dayOf
		return html`
			<hr>
			${TableWindow.presets.map(option => html`
				<mitra-menu-item type="radio" ?selected=${window.equals(option)} @click=${() => this.windowChange.dispatch(option)}>${option.label}</mitra-menu-item>
			`)}
			<div class="range" role="group" aria-label=${t('Custom range')}>
				<span class="label" ?data-checked=${custom}>${t('Custom range')}</span>
				<mitra-date-field label=${t('From')} .value=${day(start)} @change=${(e: CustomEvent<string | undefined>) => e.detail && choose(e.detail, day(end))}></mitra-date-field>
				<mitra-date-field label=${t('Until')} .value=${day(end)} @change=${(e: CustomEvent<string | undefined>) => e.detail && choose(day(start), e.detail)}></mitra-date-field>
			</div>
		`
	}

	private filterTemplate(column: DataGridColumn<TableRow>) {
		const facet = column.dataSelector
		if (!TableRow.isFacet(facet)) {
			return html.nothing
		}
		const excluded = this.filter.excluded.get(facet)
		return html`
			<hr>
			${TableColumnMenu.options(facet).map(option => html`
				<mitra-menu-item type="checkbox" ?selected=${!excluded?.has(option.value)} icon=${ifDefined(option.icon)}
					@click=${(e: MouseEvent) => this.toggleValue(facet, option.value, e)}
				>
					${!option.source ? html.nothing : html`<mitra-source-icon .source=${option.source}></mitra-source-icon>`}
					${option.label}
				</mitra-menu-item>
			`)}
			${!excluded?.size ? html.nothing : html`
				<mitra-menu-item icon="rotate-ccw" @click=${() => this.filterChange.dispatch(this.filter.excluding(facet))}>${t('Clear filter')}</mitra-menu-item>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-table-column-menu': TableColumnMenu
	}
}
