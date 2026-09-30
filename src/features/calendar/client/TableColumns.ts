import { html, type HTMLTemplateResult } from '@a11d/lit'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { DataGridColumn } from '@3mo/data-grid/controller'
import { type Entry, TaskStatus } from '../../entries/Entry.js'
import { taskStatusLabel } from '../../entries/client/TaskStatus.js'
import { Relations } from '../../relations/client/Relations.js'
import '../../participants/client/ParticipantFaces.js'
import '../../relations/client/EntryLink.js'
import '../../locations/client/MapLink.js'
import { reminderSpanLabel } from '../../reminders/client/RemindersField.js'
import { type TableRow } from './TableRow.js'

type TableColumnKey = 'heading' | 'when' | 'statusRank' | 'durationMinutes' | 'sourceName' | 'typeKey' | 'location' | 'repeats' | 'participants' | 'reminders' | 'subtaskOf' | 'blockedBy' | 'description'

/** A cell's text, cut short where the column is narrower. */
const text = (value: unknown) => html`<span class="text">${value ?? ''}</span>`

const column = (dataSelector: TableColumnKey, heading: string, definition: Partial<DataGridColumn<TableRow>> = {}) =>
	new DataGridColumn<TableRow>({ dataSelector, heading, getContentTemplate: value => text(value), ...definition })

/** How a list of days reads a date: by its weekday, with the year only when it is not this one, and the time when it has one. */
function dateFormat(start: DateTime, last: DateTime, timed: boolean): Intl.DateTimeFormatOptions {
	const year = new DateTime().year
	return {
		weekday: 'short', day: 'numeric', month: 'short',
		...start.year === year && last.year === year ? {} : { year: 'numeric' },
		...!timed ? {} : { hour: '2-digit', minute: '2-digit', hour12: false },
	}
}

/** The span as the chip says it, with what both ends share said once. A row standing for a series says where it starts; its rule is the Repeats column's. */
function span(row: TableRow) {
	const { entry } = row
	const last = entry.lastDay
	if (!last) {
		return text('')
	}
	const start = entry.start ?? last
	const timed = !entry.allDay && !!entry.start
	if (row.series) {
		return text(t('From ${date}', { date: start.format(dateFormat(start, start, timed)) }))
	}
	return text((timed ? new DateTimeRange(start, entry.effectiveEnd) : new DateTimeRange(start.dayStart, last)).format(dateFormat(start, last, timed)))
}

/** The first few faces, the rest counted; the list itself is the editor's. */
function participants(entry: Entry) {
	const list = entry.participantList ?? []
	return html`
		<mitra-participant-faces .participants=${list.slice(0, 3)} title=${list.map(participant => participant.name || participant.email).join(', ')}></mitra-participant-faces>
		${list.length <= 3 ? html.nothing : html`<span class="more">+${list.length - 3}</span>`}
	`
}

/** The entries a row points at, each as the editor names it. */
function links(entries: ReadonlyArray<Entry>) {
	return html`${entries.map(entry => html`<mitra-entry-link .entry=${entry}></mitra-entry-link>`)}`
}

function reminders(entry: Entry) {
	return text((entry.reminders ?? []).map(minutes => minutes === 0 ? t('At start') : reminderSpanLabel(minutes)).join(', '))
}

function status(entry: Entry) {
	if (!entry.type.isTask) {
		return text('')
	}
	const progress = Relations.progressOf(entry)
	const underway = progress !== undefined && progress > 0 && progress < 1
	return text(`${taskStatusLabel(entry.status ?? TaskStatus.ToDo)}${!underway ? '' : ` · ${Math.round(progress * 100).formatAsPercent()}`}`)
}

/**
 * The table's columns. A table makes them once: the grid controller syncs its definitions again for
 * every new array. Each default column says what the title chip does not say in words.
 */
export const tableColumns = (): Array<DataGridColumn<TableRow>> => [
	column('heading', t('Title'), {
		sticky: 'start',
		sortDataSelector: 'headingKey',
		getContentTemplate: (_, row) => html`<mitra-entry-segment .segment=${row.segment}></mitra-entry-segment>`,
	}),
	column('when', t('When'), { getContentTemplate: (_, row) => span(row) }),
	column('sourceName', t('Calendar'), {
		getContentTemplate: (_, row) => html`
			<mitra-source-icon .source=${row.source}></mitra-source-icon>
			${text(row.sourceName)}
		`,
	}),
	column('statusRank', t('Status'), { getContentTemplate: (_, row) => status(row.entry) }),
	column('durationMinutes', t('Duration'), { alignment: 'end', hidden: true, getContentTemplate: (_, row) => text(row.entry.duration) }),
	column('typeKey', t('Type'), { hidden: true, getContentTemplate: (_, row) => text(row.entry.type.format()) }),
	column('location', t('Location'), {
		getContentTemplate: (_, row) => html`
			${text(row.location)}
			${!row.location ? html.nothing : html`<mitra-map-link location=${row.location}></mitra-map-link>`}
		`,
	}),
	column('repeats', t('Repeats'), { hidden: true }),
	column('participants', t('Participants'), { getContentTemplate: (_, row) => participants(row.entry) }),
	column('reminders', t('Reminders'), { hidden: true, getContentTemplate: (_, row) => reminders(row.entry) }),
	column('subtaskOf', t('Subtask of'), { getContentTemplate: (_, row) => links(Relations.parentsOf(row.entry)) }),
	column('blockedBy', t('Blocked by'), { getContentTemplate: (_, row) => links(!row.entry.uid ? [] : Relations.graph.predecessorsOf(row.entry.uid)) }),
	column('description', t('Description'), { hidden: true }),
]

/** The title names each row and When holds the window the table fetches, so neither hides. */
export const hideable = (column: DataGridColumn<TableRow>) => column.dataSelector !== 'heading' && column.dataSelector !== 'when'

/** What a cell's template reads, nested templates included. */
function textOf(template: unknown): string {
	if (typeof template === 'string' || typeof template === 'number') {
		return String(template)
	}
	if (Array.isArray(template)) {
		return template.map(textOf).join('')
	}
	if (template && typeof template === 'object' && 'strings' in template && 'values' in template) {
		const { strings, values } = template as HTMLTemplateResult
		return strings.map(string => string.trim()).join('') + textOf(values)
	}
	return ''
}

const canvas = document.createElement('canvas').getContext('2d')!

/**
 * The column's content that renders widest across the rows in the cells' font, which the size anchor row
 * renders to hold the column's width. The title chip has no width of its own (size containment), so its
 * heading stands in for it.
 */
export function widestContentOf(column: DataGridColumn<TableRow>, rows: ReadonlyArray<TableRow>, font: string) {
	canvas.font = font
	let widest: HTMLTemplateResult | typeof html.nothing = html.nothing
	let width = 0
	for (const row of rows) {
		const template = column.dataSelector === 'heading'
			? html`<span class="title">${row.heading}</span>`
			: column.getContentTemplate?.(row[column.dataSelector as keyof TableRow], row) ?? html.nothing
		const templateWidth = canvas.measureText(textOf(template)).width
		if (templateWidth > width) {
			widest = template
			width = templateWidth
		}
	}
	return widest
}
