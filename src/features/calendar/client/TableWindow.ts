import { DateTime, DateTimeRange } from '@3mo/date-time'

export const tableWindowPresets = ['past30', 'today', 'next7', 'next30', 'next12', 'all'] as const

export type TableWindowPreset = typeof tableWindowPresets[number]

/**
 * Which entries the table lists: days counted from today, never a page turned from a navigated date.
 * Undated tasks and overdue open ones ride along with every window, as they do with every fetch.
 * Like the grids' density it lives on the device rather than in the URL.
 */
export class TableWindow {
	private static readonly key = 'Mitra.Table.Window'
	/** The window chosen this session, so every reader agrees even where storage refuses it. */
	private static chosen?: TableWindow

	static readonly presets: ReadonlyArray<TableWindow> = tableWindowPresets.map(kind => new TableWindow(kind))

	static of(kind: TableWindowPreset) {
		return TableWindow.presets.find(window => window.kind === kind)!
	}

	/** What a new table lists: the backlog and the coming month. */
	static get default() {
		return TableWindow.of('next30')
	}

	/** Whole days from the earlier of the two to the later. */
	static between(from: DateTime, to: DateTime) {
		const [first, last] = from.isAfter(to) ? [to, from] : [from, to]
		return new TableWindow('custom', first.dayStart, last.dayStart)
	}

	/** A stored key: a preset's name, or a range's two days. */
	static parse(key: string | null | undefined): TableWindow | undefined {
		const [kind, from, to] = key?.split(':') ?? []
		if (kind !== 'custom') {
			return TableWindow.presets.find(window => window.kind === kind)
		}
		const [first, last] = [from, to].map(day => new DateTime(`${day}T00:00:00`))
		return !first || !last || Number.isNaN(first.valueOf()) || Number.isNaN(last.valueOf()) ? undefined : TableWindow.between(first, last)
	}

	static get current(): TableWindow {
		try {
			return TableWindow.chosen ??= TableWindow.parse(localStorage.getItem(TableWindow.key)) ?? TableWindow.default
		} catch {
			return TableWindow.chosen ??= TableWindow.default
		}
	}

	static set current(window: TableWindow) {
		TableWindow.chosen = window
		try {
			localStorage.setItem(TableWindow.key, window.key)
		} catch {
			// The window is a convenience; without storage the table opens on the default again.
		}
	}

	private constructor(
		readonly kind: TableWindowPreset | 'custom',
		readonly from?: DateTime,
		readonly to?: DateTime,
	) { }

	get key() {
		return this.kind !== 'custom' ? this.kind : `custom:${TableWindow.dayOf(this.from!)}:${TableWindow.dayOf(this.to!)}`
	}

	/** A day as a key and a date field write it. */
	static dayOf(date: DateTime) {
		return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
	}

	/** No bounds at all. A series then lists once, as its start, since its occurrences never end. */
	get unbounded() {
		return this.kind === 'all'
	}

	equals(other: TableWindow) {
		return this.key === other.key
	}

	get label(): string {
		switch (this.kind) {
			case 'past30': return t('Past 30 days')
			case 'today': return t('Today')
			case 'next7': return t('Next 7 days')
			case 'next30': return t('Next 30 days')
			case 'next12': return t('Next 12 months')
			case 'all': return t('All entries')
			case 'custom': return new DateTimeRange(this.from!, this.to!).format({ day: 'numeric', month: 'short', year: 'numeric' })
		}
	}

	/** The first and the last instant listed, counted in whole days from today; none when unbounded. */
	bounds(today = new DateTime()): { readonly start: DateTime, readonly end: DateTime } | undefined {
		switch (this.kind) {
			case 'past30': return { start: today.subtract({ days: 29 }).dayStart, end: today.dayEnd }
			case 'today': return { start: today.dayStart, end: today.dayEnd }
			case 'next7': return { start: today.dayStart, end: today.add({ days: 6 }).dayEnd }
			case 'next30': return { start: today.dayStart, end: today.add({ days: 29 }).dayEnd }
			case 'next12': return { start: today.dayStart, end: today.add({ months: 12 }).subtract({ days: 1 }).dayEnd }
			case 'all': return undefined
			case 'custom': return { start: this.from!.dayStart, end: this.to!.dayEnd }
		}
	}
}
