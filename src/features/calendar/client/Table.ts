import { Component, component, html, css, property, state, event, eventListener, query, repeat, styleMap, bind, live, type PropertyValues } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { observeResize } from '@3mo/resize-observer'
import { DataGridController, type DataGridColumn, DataGridSelectability, DataGridSelectionBehaviorOnDataChange, DataGridSortingStrategy } from '@3mo/data-grid/controller'
import { type Entry } from '../../entries/Entry.js'
import { Availability } from '../../availability/client/Availability.js'
import { TableWindow } from './TableWindow.js'
import { TableRow, TableFilter } from './TableRow.js'
import { tableColumns, widestContentOf, hideable } from './TableColumns.js'
import './TableRowComponent.js'
import './TableColumnMenu.js'
import './TableSelection.js'
import { startedInField } from '../../../design/eventOrigin.js'

/**
 * The entries of a window as rows: the same continuum the grids draw, listed for sorting, filtering
 * and editing many at once. The grid controller stamps the roles, the cursor, the sorting and where
 * the sticky parts stick, and empties the rows far from view; the rows, the cells and everything they
 * look like are the table's own.
 */
@component('mitra-table')
export class Table extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	@event() readonly windowChange!: EventDispatcher<TableWindow>

	@state() query = ''
	@state() filter = new TableFilter()
	@state() private window = TableWindow.current
	@state() private selection = new Array<TableRow>()

	@query('mitra-table-column-menu') private readonly columnMenu!: HTMLElementTagNameMap['mitra-table-column-menu']
	@query('mitra-table-selection') private readonly selectionBar!: HTMLElementTagNameMap['mitra-table-selection']

	/** Derived only when what it lists changes: the controller keys its records on the array. */
	private rows = new Array<TableRow>()

	readonly grid: DataGridController<TableRow, Table> = new DataGridController<TableRow, Table>(this, host => ({
		get data() { return host.rows },
		columns: tableColumns(),
		selectability: DataGridSelectability.Multiple,
		selectionBehaviorOnDataChange: DataGridSelectionBehaviorOnDataChange.Maintain,
		get selectedData() { return host.selection },
		handleSelectionChange: selection => host.selection = selection,
		// A filter lives in its column: hiding the column lifts it.
		handleColumnsChange: columns => { host.filter = columns.filter(column => column.hidden).reduce((filter, column) => filter.excluding(column.dataSelector), host.filter) },
	}))

	constructor() {
		super()
		this.grid.sorting.set({ selector: 'when', strategy: DataGridSortingStrategy.Ascending })
	}

	/** The rows are elements of their own, so the controller decides which of them a change re-renders. The selection is stamped onto them. */
	override requestUpdate(...parameters: Parameters<Component['requestUpdate']>) {
		if (parameters[0] !== 'selection') {
			this.grid?.handleUpdateRequest(...parameters)
		}
		super.requestUpdate(...parameters)
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		if (['entries', 'query', 'filter', 'window'].some(key => changed.has(key as keyof Table))) {
			const { window } = this
			this.rows = Availability.outside(this.entries).map(entry => TableRow.for(entry, window)).filter(row => row.inWindow(window) && row.matches(this.query, this.filter))
			this.grid.virtualization.handleItemsChange()
		}
	}

	/** Navigating, by Today or to a date, brings the first row on or after that day into view; the window stays. */
	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		if (changed.get('navigatingDate')) {
			this.reveal(this.navigatingDate)
		}
	}

	private reveal(date: DateTime) {
		const from = date.dayStart.valueOf()
		const records = this.grid.records.records
		const next = records.reduce<TableRow | undefined>((nearest, { data }) => data.when !== undefined && data.when >= from && (nearest?.when === undefined || data.when < nearest.when) ? data : nearest, undefined)
		const index = !next ? -1 : records.findIndex(record => record.data === next)
		this.querySelectorAll('mitra-table-row')[index]?.scrollIntoView({ block: 'start' })
	}

	private setWindow(window: TableWindow) {
		TableWindow.current = this.window = window
		this.windowChange.dispatch(window)
	}

	/** The keys that act on the selection as a whole; a field, an open editor or a menu keeps them for itself. */
	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if (startedInField(e) || this.querySelector(':popover-open') || !this.selection.length) {
			return
		}
		if (e.key === 'Escape') {
			this.selection = []
		} else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && !e.ctrlKey && !e.metaKey) {
			e.preventDefault()
			void this.selectionBar.delete()
		}
	}

	private handleHeadingKeyDown(e: KeyboardEvent, column: DataGridColumn<TableRow>) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			this.columnMenu.press(column)
			void this.columnMenu.toggle(column, e.currentTarget as HTMLElement)
		}
	}

	static override get styles() {
		return css`
			mitra-table {
				display: flex;
				flex-direction: column;
				min-block-size: 0;
				min-inline-size: 0;
				--_rule: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
				--_row-height: 2rem;

				/* The selection bar is a row of its own below, never a flex item: flex layout would pin its height transition at the start value. */
				> header {
					display: grid;
					grid-template-columns: minmax(0, 20rem) 1fr;
					align-items: center;
					column-gap: 0.75rem;

					> .search {
						margin-block-end: 0.75rem;
						margin-inline-start: 1.25rem;
					}

					> .count {
						justify-self: end;
						margin-block-end: 0.75rem;
						margin-inline-end: 1.25rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
						white-space: nowrap;
						font-variant-numeric: tabular-nums;
					}

					> mitra-table-selection {
						grid-column: 1 / -1;
					}
				}

				> .empty {
					flex: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 2rem 1.25rem;
					color: var(--color-text-muted);
					font-size: 0.8rem;
					text-align: center;
				}

				&[data-reordering] {
					cursor: grabbing;
				}

				/* Scrolling a row into view, as the keyboard cursor does, stops below the sticky header rather than under it. */
				> .scroller {
					flex: 1;
					min-block-size: 0;
					overflow: auto;
					scrollbar-gutter: stable;
					scroll-padding-block-start: calc(var(--_row-height) + 1px);
					border-block-start: 1px solid var(--_rule);

					> .grid {
						display: grid;
						grid-template-columns: var(--_columns);
						align-content: start;
						inline-size: 100%;
						min-inline-size: max-content;
						font-size: 0.8125rem;

						> .header, > mitra-table-row {
							display: grid;
							grid-template-columns: subgrid;
							grid-column: 1 / -1;
							block-size: var(--_row-height);
							border-block-end: 1px solid var(--_rule);
							--_row-bg: var(--color-background);
						}

						/* Zero height, so the anchor's content sizes the tracks without taking a row. The title stands in in the chip's type, with room for its status box and repeat glyph. */
						> .anchor {
							display: grid;
							grid-template-columns: subgrid;
							grid-column: 1 / -1;
							block-size: 0;
							overflow: hidden;
							visibility: hidden;

							> .cell > .title {
								padding-inline: 1.75rem 1.5rem;
								font-size: 0.7rem;
								font-weight: 600;
							}
						}

						> mitra-table-row {
							&:hover {
								--_row-bg: color-mix(in srgb, var(--color-text-muted) 8%, var(--color-background));
							}

							&[aria-selected=true] {
								--_row-bg: color-mix(in srgb, var(--color-accent) 10%, var(--color-background));
							}

							/* The part the virtualization watches: an empty one spans the row with no tracks to align. */
							> .cells {
								display: grid;
								grid-column: 1 / -1;
								grid-template-columns: subgrid;

								&:not([data-rendered]) {
									grid-template-columns: none;
								}
							}
						}

						.select, .column, .cell, .actions {
							box-sizing: border-box;
							display: flex;
							align-items: center;
							gap: 0.375rem;
							min-inline-size: 0;
							padding-inline: 0.75rem;
							white-space: nowrap;
							background: var(--_row-bg);

							&[data-alignment=end] {
								justify-content: end;
							}

							> .text {
								min-inline-size: 0;
								overflow: hidden;
								text-overflow: ellipsis;
							}

							&.select {
								position: sticky;
								inset-inline-start: 0;
								z-index: 2;
								padding-inline: 0.5rem;
							}

							&.actions {
								position: sticky;
								inset-inline-end: 0;
								z-index: 2;
								justify-content: end;
								padding-inline: 0.25rem;
							}

							&[data-sticky] {
								position: sticky;
								z-index: 2;
							}
						}

						/* The row sticks, not its cells: a cell only sticks inside its parent, and the row is one row tall. */
						> .header {
							position: sticky;
							inset-block-start: 0;
							z-index: 5;
						}

						/* Only the sticky cells layer themselves, so a resizer straddling into the next heading stays above it. */
						> .header > * {
							position: relative;
							font-size: 0.75rem;
							font-weight: 600;
							color: var(--color-text-muted);

							&.select, &.actions, &[data-sticky] {
								z-index: 4;
							}
						}

						> .header > .column {
							cursor: pointer;
							outline: none;

							&:is(:hover, :focus-visible) > .label {
								color: var(--color-text);
							}

							&:focus-visible {
								box-shadow: inset 0 0 0 2px var(--focus-ring-color, transparent);
							}

							> .label {
								min-inline-size: 0;
								overflow: hidden;
								text-overflow: ellipsis;
							}

							> .sort, > .filtered {
								font-size: 0.875rem;
								flex-shrink: 0;
							}

							/* Centred on the boundary: a double-click aimed at the edge drifts either way. */
							> .resizer {
								position: absolute;
								z-index: 1;
								inset-block: 0;
								inset-inline-end: -0.375rem;
								inline-size: 0.75rem;
								cursor: col-resize;

								/* Drawn inside the handle rather than fixed to the viewport: the calendar contains fixed elements, which shifts them by the sidebar. */
								&[data-resizing]::after {
									content: '';
									position: absolute;
									inset-block-start: 0;
									inset-inline-start: calc(var(--mo-data-grid-column-resizer-pointer) - var(--_resizer-origin));
									block-size: 100vb;
									border-inline-start: 1px dashed var(--color-text-muted);
									pointer-events: none;
								}
							}

							/* The heading's own place stays behind as a hollow while its preview follows the pointer. */
							&[data-reorderability=dragging] {
								background: color-mix(in srgb, var(--color-text) 6%, var(--color-background));

								> * {
									opacity: 0.25;
								}
							}

							/* Where the column lands: a line down through the rows, clipped by the scroller. */
							&[data-reorderability=drop-before]::before, &[data-reorderability=drop-after]::before {
								content: '';
								position: absolute;
								inset-block-start: 0;
								block-size: 100vb;
								inline-size: 2px;
								background: var(--color-accent);
								pointer-events: none;
							}

							&[data-reorderability=drop-before]::before {
								inset-inline-start: -1px;
							}

							&[data-reorderability=drop-after]::before {
								inset-inline-end: -1px;
							}
						}

						.cell {
							&:focus-visible {
								outline: 2px solid var(--focus-ring-color, transparent);
								outline-offset: -2px;
							}

							> mitra-source-icon {
								font-size: 0.875rem;
								padding: 0;
							}

							/* Ringed in the row's own colour, so the faces cut into each other the way the row paints. */
							> mitra-participant-faces {
								--participant-faces-ring: var(--_row-bg);
								--mitra-avatar-size: 1.25rem;
							}

							> .more {
								font-size: 0.6875rem;
								color: var(--color-text-muted);
							}
						}

						/* The chip fills its cell: size containment leaves it no intrinsic width to shrink to. */
						/* The chip fills its cell: size containment leaves it no intrinsic width to shrink to. */
						mitra-entry-segment {
							block-size: calc(var(--_row-height) - 0.5rem);
							inline-size: 100%;
							margin: 0;
							cursor: pointer;

							> .heading > .header > .when:is(.range, .point) {
								display: none;
							}
						}
					}
				}
			}

			/* The heading a column drag carries. It renders into the document body, outside the table. */
			.table-column-preview {
				display: flex;
				align-items: center;
				block-size: 2rem;
				padding-inline: 0.75rem;
				border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
				border-radius: var(--border-radius);
				background: color-mix(in srgb, var(--color-surface) 95%, transparent);
				backdrop-filter: blur(10px);
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
				color: var(--color-text);
				font: 600 0.75rem var(--font-family);
				white-space: nowrap;
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const { grid } = this
		const records = grid.records.records
		// Every column fits its content; the trailing column takes the width to spare.
		const tracks = ['1.75rem', ...grid.columns.columns.visible.map(column => String(column.width)), 'auto'].join(' ')
		return html`
			<header>
				<mitra-search-field class="search" placeholder=${t('Search entries…')} ${bind(this, 'query')}></mitra-search-field>
				<span class="count">${t('${count:pluralityNumber} entries', { count: this.rows.length })}</span>
				<mitra-table-selection role="toolbar" .rows=${this.selection} @clear=${() => this.selection = []}></mitra-table-selection>
			</header>
			<div class="scroller" ${grid.virtualization.root.ref()}>
				<div class="grid" ${grid.root.ref()} style=${styleMap({ '--_columns': tracks })}>
					${this.headerTemplate}
					${this.anchorTemplate}
					${repeat(records, record => record.data.id, record => html`
						<mitra-table-row ${grid.row(record)} .table=${this} .record=${record}></mitra-table-row>
					`)}
				</div>
			</div>
			${records.length ? html.nothing : html`
				<p class="empty">${this.query.trim() || this.filter.excluded.size ? t('No entries match the filters') : t('No entries in this period')}</p>
			`}
			<mitra-table-column-menu .filter=${bind(this, 'filter')} .window=${this.window}
				@windowChange=${(e: CustomEvent<TableWindow>) => this.setWindow(e.detail)}
			></mitra-table-column-menu>
		`
	}

	/** A hidden row of each content-sized column's widest content, so the tracks hold still while the rows near view change. */
	private get anchorTemplate() {
		const { grid } = this
		const font = getComputedStyle(this).font
		return html`
			<div class="anchor" aria-hidden="true">
				<div class="cell"></div>
				${grid.columns.columns.visible.map(column => html`
					<div class="cell" data-alignment=${column.alignment}>
						${column.width !== 'max-content' ? html.nothing : grid.records.longestContentOf(column, () => widestContentOf(column, this.rows, font))}
					</div>
				`)}
				<div class="cell"></div>
			</div>
		`
	}

	/** The controller says where the pointer is in the viewport; the line is drawn from the handle, so the handle's own start is taken at the press. */
	private static handleResizerPress(e: PointerEvent) {
		const handle = e.currentTarget as HTMLElement
		const { left, right } = handle.getBoundingClientRect()
		handle.style.setProperty('--_resizer-origin', `${handle.matches(':dir(rtl)') ? innerWidth - right : left}px`)
	}

	/** Whether the column leaves rows out: its facet's values, or When's window unless it lists everything. */
	private filters(column: DataGridColumn<TableRow>) {
		return this.filter.has(column.dataSelector) || (column.dataSelector === 'when' && !this.window.unbounded)
	}

	private get headerTemplate() {
		const { grid } = this
		const allState = grid.selection.allState
		return html`
			<div class="header" ${grid.header.ref()}>
				<div class="select" role="columnheader" ${observeResize(([entry]) => grid.columns.setColumnWidth('selection', entry?.borderBoxSize[0]?.inlineSize ?? 0))}>
					<mitra-checkbox label=${t('Select all')} .checked=${live(allState === 'all')} .indeterminate=${live(allState === 'some')}
						@click=${() => grid.selection.toggleAll()}></mitra-checkbox>
				</div>
				${grid.columns.columns.visible.map(column => html`
					<div class="column" tabindex="0" aria-haspopup="menu" data-alignment=${column.alignment}
						${grid.columnHeader(column, { dragImage: html`<div class="table-column-preview">${column.heading}</div>` })}
						@pointerdown=${() => this.columnMenu.press(column)}
						@click=${(e: MouseEvent) => !(e.target as Element).closest('.resizer') && void this.columnMenu.toggle(column, e.currentTarget as HTMLElement)}
						@keydown=${(e: KeyboardEvent) => this.handleHeadingKeyDown(e, column)}
					>
						<span class="label">${column.heading}</span>
						${!column.sortingDefinition ? html.nothing : html`
							<mitra-icon class="sort" icon=${column.sortingDefinition.strategy === DataGridSortingStrategy.Ascending ? 'arrow-up' : 'arrow-down'}></mitra-icon>
						`}
						${!this.filters(column) ? html.nothing : html`<mitra-icon class="filtered" icon="funnel"></mitra-icon>`}
						<span class="resizer" ${grid.columns.resizer(column)} @pointerdown=${Table.handleResizerPress}></span>
					</div>
				`)}
				<div class="actions" role="columnheader" aria-label=${t('Columns')}>
					<mitra-popover-container>
						<mitra-icon-button icon="columns-3-cog" label=${t('Columns')}></mitra-icon-button>
						<mitra-menu slot="popover">
							${[...grid.columns.columns].map(column => html`
								<mitra-menu-item type="checkbox" ?selected=${!column.hidden} ?disabled=${!hideable(column)}
									@click=${() => column.modify({ hidden: !column.hidden })}>${column.heading}</mitra-menu-item>
							`)}
							<hr>
							<mitra-menu-item icon="rotate-ccw" @click=${() => grid.columns.columns.modifications.set([])}>${t('Reset columns')}</mitra-menu-item>
						</mitra-menu>
					</mitra-popover-container>
				</div>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-table': Table
	}
}
