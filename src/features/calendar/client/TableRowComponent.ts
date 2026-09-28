import { Component, component, html, property, eventListener, type PropertyValues } from '@a11d/lit'
import { type DataRecord } from '@3mo/data-grid/controller'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { type Table } from './Table.js'
import { type TableRow } from './TableRow.js'

/**
 * One row of the table: an element of its own so the grid's virtualization can empty it while it is
 * far from view and re-render it alone when its selection changes. Every row stays in the DOM, which
 * keeps the keyboard cursor's universe whole.
 */
@component('mitra-table-row')
export class TableRowComponent extends Component {
	@property({ type: Object }) table!: Table
	@property({ type: Object }) record!: DataRecord<TableRow>

	/** Its place in the table's records, which the virtualization reports its part under. */
	get index() { return this.record.index }

	protected override createRenderRoot() { return this }

	/** A click on a cell selects the row, with Shift or Ctrl reading as a range or an addition; the chip and the controls keep their own clicks. */
	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		if (!(e.target as Element).closest('mitra-entry-segment, input, button, a, menu')) {
			this.table.grid.selection.select(this.record.data, { event: e })
		}
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if ((e.target as Element).closest('input, select, button, a, mitra-entry-details')) {
			return
		}
		if (e.key === ' ') {
			e.preventDefault()
			this.table.grid.selection.select(this.record.data, { preserve: true, event: e })
		} else if (e.key === 'Enter') {
			e.preventDefault()
			const segment = this.querySelector('mitra-entry-segment')
			if (segment) {
				segment.open = true
			}
		}
	}

	/** An entry being edited, or about to be, keeps its cells: its editor opens from the chip in them. */
	private get rendered() {
		return this.table.grid.virtualization.isRendered(this) || EntryEditorIntent.holds(this.record.data.entry)
	}

	/** An entry asked to open elsewhere — a link, the palette — comes into view, so its editor opens where it can be seen. */
	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		if (EntryEditorIntent.shouldOpen(this.record.data.entry)) {
			this.scrollIntoView({ block: 'nearest' })
		}
	}

	protected override get template() {
		const { grid } = this.table
		const rendered = this.rendered
		return html`
			<div class="cells" ?data-rendered=${rendered} ${grid.virtualization.cells(this)}>
				${!rendered ? html.nothing : this.cellsTemplate}
			</div>
		`
	}

	private get cellsTemplate() {
		const { grid } = this.table
		const row = this.record.data
		return html`
			<div class="select" role="gridcell" @click=${(e: Event) => e.stopPropagation()}>
				<input type="checkbox" tabindex="-1" aria-label=${t('Select')} .checked=${this.record.isSelected}
					@click=${(e: MouseEvent) => grid.selection.select(row, { preserve: true, selected: (e.target as HTMLInputElement).checked, event: e })}>
			</div>
			${grid.columns.columns.visible.map(column => html`
				<div class="cell" ${grid.cell(column)} data-alignment=${column.alignment}>
					${column.getContentTemplate?.(row[column.dataSelector as keyof TableRow], row)}
				</div>
			`)}
			<div class="actions" role="gridcell"></div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-table-row': TableRowComponent
	}
}
