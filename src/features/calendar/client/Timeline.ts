import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, ifDefined, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { getPrimarySource, getSource } from '../../../infrastructure/http/Api.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { EntryConnections } from '../../relations/client/EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
import { EntryDragController } from '../../entries/client/EntryDragController.js'
import { TimelineDensityController } from './TimelineDensityController.js'

/** An entry's run projected onto the buffer as a column-spanning bar. */
interface TimelineBar {
	readonly segment: EntrySegment
	readonly startColumn: number
	readonly span: number
	readonly clippedRight: boolean
}

/** A timeline lane containing task bars (or ghost previews) for a single row. */
interface TimelineRow {
	readonly key: string
	/** Task start date used for sorting and offscreen jump targeting. */
	readonly date: DateTime
	readonly sortValue: number
	readonly heading: string
	readonly bars: Array<TimelineBar>
}

/** A bar with the row it landed in (1-based, as CSS grid counts). */
type PlacedBar = TimelineBar & { readonly row: number }

/** How far ahead recurring task occurrences are shown before collapsing into the next single instance. */
const ROUTINE_HORIZON = 24 * 60 * 60 * 1000

/** Maximum distance in days to smooth-scroll a jump before cutting directly to the target. */
const MAX_GLIDE_DAYS = 365

/**
 * Horizontally-scrolling timeline view for open, scheduled tasks.
 * Each row corresponds to a single task sorted by start date.
 */
@component('mitra-timeline')
export class Timeline extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	// Render radius must stay ahead of the half-viewport plus recenter hysteresis (120 ≥ 90 + 21).
	private readonly dates: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 120, shiftDays: 21 })
	protected readonly entryDrag = new EntryDragController(this, 'timeline')
	protected readonly density = new TimelineDensityController(this)

	private get days(): Array<DateTime> { return this.dates.days }
	// Segments span the full buffer so horizontal scrolling does not alter row presence.
	private get segments() { return EntrySegments.of(this.entries, this.dates.days) }

	/** Rows of the last render, in order for scroll-anchoring lookups. */
	private renderedRows: Array<TimelineRow> = []

	/** Column pitch measured off a rendered backdrop cell to avoid sub-pixel rounding drift across wide buffers. */
	private get pitch() {
		const cell = this.renderRoot.querySelector('.backdrop .day')
		return cell ? cell.getBoundingClientRect().width : this.scrollWidth / (this.days.length || 1)
	}

	/** Content offset centering the given date's column. */
	private inlineOffsetOf(date: DateTime) {
		const first = this.days[0]
		const pitch = this.pitch
		if (!first || !(pitch > 0)) {
			return undefined
		}
		// Consecutive local days, so day distance is the column index.
		const column = Math.round((date.dayStart.valueOf() - first.dayStart.valueOf()) / 86_400_000)
		return (column + 0.5) * pitch - this.clientWidth / 2
	}

	private readonly scrolling: CalendarScrollController = new CalendarScrollController(this, this.dates, {
		axis: 'inline',
		scroller: () => this,
		ready: () => this.days.length > 0 && this.pitch > 0,
		// Suspend scroll sync during pinch-zoom or glides to prevent intermediate frame churn.
		suspended: () => this.density.active || this.gliding,
		offsetOf: date => this.inlineOffsetOf(date),
		dateAt: offset => {
			const pitch = this.pitch
			if (!this.days.length || !(pitch > 0)) {
				return undefined
			}
			const column = Math.floor((offset + this.clientWidth / 2) / pitch)
			return this.days[Math.max(0, Math.min(column, this.days.length - 1))]
		},
		equivalent: (a, b) => a.dayStart.equals(b.dayStart),
		// Reveal the target date's vertical row band upon arrival.
		arrived: date => this.revealRowAt(date),
	})

	/**
	 * Anchors vertical scroll position to a row key (or start day fallback) so row mutations above
	 * the viewport do not shift visible content.
	 */
	private blockAnchor?: { key?: string, value: number, offset: number }
	private restoringBlock = false

	/** Content offset and height metrics of the entry rows. */
	private get rowMetrics() {
		const entries = this.renderRoot.querySelector('.entries')
		const height = entries?.querySelector('.row')?.getBoundingClientRect().height
		if (!entries || !height) {
			return undefined
		}
		return { top: entries.getBoundingClientRect().top - this.getBoundingClientRect().top + this.scrollTop, height }
	}

	/** Updates dataset attributes on offscreen rows directly to avoid per-scroll-frame re-renders. */
	private readonly markOffscreenRows = () => {
		this.jumpFrame = undefined
		const rows = this.renderRoot.querySelectorAll<HTMLElement>('.entries > .row')
		const pitch = this.pitch
		if (!rows.length || !(pitch > 0)) {
			return
		}
		const from = Math.abs(this.scrollLeft) / pitch
		const to = from + this.clientWidth / pitch
		const dayAt = (column: number) => this.days[Math.min(this.days.length - 1, Math.max(0, Math.round(column)))]?.dayStart.valueOf() ?? 0
		rows.forEach((element, index) => {
			const row = this.renderedRows[index]
			const bar = row?.bars[0]
			// When a task has no rendered bar in the buffer, determine direction from its start date.
			const side = !row ? undefined
				: !bar ? (row.sortValue < dayAt(from) ? 'before' : 'after')
					: bar.startColumn + bar.span - 1 < from ? 'before'
						: bar.startColumn > to ? 'after'
							: undefined
			if (element.dataset.offscreen !== side) {
				if (side) {
					element.dataset.offscreen = side
				} else {
					delete element.dataset.offscreen
				}
			}
		})
	}

	private jumpFrame?: number

	/** True while a jump is gliding. */
	private gliding = false

	@eventListener('scrollend')
	protected handleScrollEnd() {
		this.gliding = false
	}

	/** Smoothly scrolls the timeline horizontally to reveal the row's entry. */
	private jumpToRow(row: TimelineRow) {
		const bar = row.bars[0]
		// Target bar midpoint if rendered, otherwise fall back to task date.
		const target = bar ? this.days[Math.round(bar.startColumn + (bar.span - 1) / 2)] ?? row.date : row.date
		const buffer = this.dates.days
		this.dates.navigatingDate = target
		const offset = this.inlineOffsetOf(target)
		// Cut instantly if distance exceeds max glide threshold, buffer regenerated, or reduced motion is requested.
		const pitch = this.pitch
		const far = offset === undefined || !(pitch > 0) || Math.abs(offset - Math.abs(this.scrollLeft)) / pitch > MAX_GLIDE_DAYS
		if (far || this.dates.days !== buffer || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			void this.scrolling.anchor(target)
			return
		}
		this.gliding = true
		const distance = Math.max(0, Math.min(offset, this.scrollWidth - this.clientWidth))
		// scrollLeft counts backwards in RTL — the mirror of the reading's Math.abs().
		this.scrollTo({ left: getComputedStyle(this).direction === 'rtl' ? -distance : distance, behavior: 'smooth' })
	}

	@eventListener('scroll', { passive: true })
	protected handleBlockScroll(e: Event) {
		if (e.target !== this) {
			return
		}
		this.jumpFrame ??= requestAnimationFrame(this.markOffscreenRows)
		if (this.restoringBlock) {
			return
		}
		const metrics = this.rowMetrics
		if (!metrics || !this.renderedRows.length) {
			return
		}
		// Row currently intersecting the viewport's top edge.
		const index = Math.min(this.renderedRows.length - 1, Math.max(0, Math.floor((this.scrollTop - metrics.top) / metrics.height)))
		const row = this.renderedRows[index]!
		this.blockAnchor = { key: row.key, value: row.sortValue, offset: metrics.top + index * metrics.height - this.scrollTop }
	}

	/** Restores vertical scroll position to match the current block anchor. */
	private restoreBlockAnchor() {
		const anchor = this.blockAnchor
		const metrics = this.rowMetrics
		if (!anchor || !metrics || !this.renderedRows.length) {
			return
		}
		const byKey = anchor.key === undefined ? -1 : this.renderedRows.findIndex(row => row.key === anchor.key)
		const byDate = this.renderedRows.findIndex(row => row.sortValue >= anchor.value)
		const index = byKey >= 0 ? byKey : byDate >= 0 ? byDate : this.renderedRows.length - 1
		const target = Math.max(0, metrics.top + index * metrics.height - anchor.offset)
		if (Math.abs(this.scrollTop - target) >= 1) {
			this.restoringBlock = true
			this.scrollTop = target
			this.restoringBlock = false
		}
	}

	/** Centers the row corresponding to date in the vertical viewport. */
	private revealRowAt(date: DateTime) {
		this.blockAnchor = { value: date.dayStart.valueOf(), offset: Math.round(this.clientHeight / 2) }
		this.restoreBlockAnchor()
	}

	protected override initialized() {
		this.scrolling.navigate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		// Avoid re-anchoring when navigation originated from internal scrolling.
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.scrolling.navigate(this.navigatingDate)
		}
		this.restoreBlockAnchor()
		this.markOffscreenRows()
		this.style.setProperty('--_days-length', this.days.length.toString())
	}

	static override get styles() {
		return css`
			mitra-timeline {
				display: grid;
				/* Integer pixel rounding prevents sub-pixel phase jitter and cumulative pitch error during zoom. */
				--day-width: max(1px, round(calc(100cqi / 180 * var(--timeline-zoom, 3)), 1px));
				--row-height: 1.75rem;
				/* Tinted rules ensure consistent contrast across transparent canvas backgrounds. */
				--_rule: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
				--_rule-strong: color-mix(in srgb, var(--color-text-muted) 28%, transparent);
				grid-template-columns: repeat(var(--_days-length, 1), var(--day-width));
				grid-template-rows: auto auto 1fr;
				min-height: 0;
				min-width: 0;
				overflow: auto;
				/* Two-finger pinch belongs to TimelineDensityController; single-finger pan still scrolls. */
				touch-action: pan-x pan-y;

				mitra-entry-segment {
					margin-top: 0 !important;
					flex-direction: row !important;
					align-items: center !important;
					gap: 0.375rem !important;
					padding: 0 0.375rem !important;

					> .time {
						display: block !important;

						.separator, .end {
							display: none !important;
						}

						/* Too narrow for both: the time goes before the heading does. */
						@container (max-width: 6rem) {
							display: none !important;
						}
					}

					> .heading {
						flex: 1 !important;
						white-space: nowrap !important;
						overflow: hidden !important;
						text-overflow: ellipsis !important;
					}
				}

				.header {
					grid-column: 1 / -1;
					grid-row: 1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: auto auto auto;
					position: sticky;
					top: 0;
					z-index: 200;
					background-color: var(--color-background);
					border-block-end: 1px solid var(--_rule-strong);

					.month {
						grid-row: 1;
						display: flex;
						padding-block: 0.25rem;
						border-inline-start: 1px solid var(--_rule-strong);

						/* Sticks label within the visible portion of its month cell. */
						> span {
							position: sticky;
							inset-inline-start: 0.5rem;
							width: max-content;
							font-size: 0.75rem;
							font-weight: 600;
							color: var(--color-text-muted);
							padding-inline: 0.5rem;
							white-space: nowrap;
						}
					}

					.day {
						grid-row: 2;
						container-type: inline-size;
						text-align: center;
						padding-block: 0.25rem;
						font-size: 0.65rem;
						font-weight: 500;
						color: var(--color-text-muted);

						> span {
							display: inline-block;
							min-width: 1.125rem;
							line-height: 1.125rem;
							border-radius: 999px;
						}

						/* In narrow columns, hide day numbers except for week starts and today. */
						&:not([data-week-start]):not([data-today]) > span {
							@container (max-width: 1.25rem) {
								display: none;
							}
						}

						&[data-today] > span {
							background-color: var(--color-accent);
							color: var(--color-accent-text);
						}
					}

					/* Packed bands for all-day events. */
					.events {
						grid-row: 3;
						grid-column: 1 / -1;
						display: grid;
						grid-template-columns: subgrid;
						grid-auto-rows: 1.5rem;
						grid-auto-flow: row dense;
						row-gap: 2px;
						align-content: start;

						&:has(mitra-entry-segment) {
							padding-block: 0.125rem 0.25rem;
						}
					}
				}

				.backdrop {
					grid-column: 1 / -1;
					grid-row: 2 / -1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: 1fr;

					.day {
						grid-row: 1;
						border-inline-start: 1px solid var(--_rule);

						&[data-month-start] {
							border-inline-start-color: var(--_rule-strong);
						}

						&[data-today] {
							border-inline-start: 2px solid var(--color-accent);
						}
					}

					/* Shaded column extending all-day event background through the body. */
					.shade {
						grid-row: 1;
						background-color: color-mix(in srgb, var(--_shade-color, transparent) 10%, transparent);
					}
				}

				.entries {
					grid-column: 1 / -1;
					grid-row: 2;
					display: grid;
					grid-template-columns: subgrid;
					grid-auto-rows: var(--row-height);
					align-content: start;
					z-index: 1;
					position: relative;
					--mitra-connection-z: 0;

					> .row {
						grid-column: 1 / -1;
						display: flex;
						align-items: center;
						border-block-end: 1px solid var(--_rule);

						&:hover {
							background-color: color-mix(in srgb, var(--color-text-muted) 6%, transparent);
						}

						/* Sticky indicator pointing towards offscreen task bars. */
						> .jump {
							position: sticky;
							z-index: 2;
							display: none;
							place-items: center;
							flex: none;
							inline-size: 1.25rem;
							block-size: 1.25rem;
							padding: 0;
							font-size: 0.75rem;
							color: var(--color-text-muted);
							/* Opaque background avoids muddying over shaded event columns or the today line. */
							background-color: color-mix(in srgb, var(--color-text) 5%, var(--color-background));
							border: 1px solid color-mix(in srgb, var(--color-text) 20%, var(--color-background));

							&:hover {
								color: var(--color-text);
								background-color: color-mix(in srgb, var(--color-text) 12%, var(--color-background));
								border-color: color-mix(in srgb, var(--color-text) 40%, var(--color-background));
							}

							&.before {
								inset-inline-start: 0.25rem;
							}

							&.after {
								inset-inline-end: 0.25rem;
								margin-inline-start: auto;
							}
						}

						&[data-offscreen=before] > .jump.before,
						&[data-offscreen=after] > .jump.after {
							display: grid;
						}
					}

					/* Explicit height prevents container sizing collapse. */
					> mitra-entry-segment {
						align-self: center;
						block-size: calc(var(--row-height) - 0.375rem);
						z-index: 1;
						/* Heading overflows single-day bars and sticks to the viewport edge during horizontal scroll. */
						overflow: visible !important;

						> .heading {
							position: sticky;
							inset-inline-start: 0.375rem;
							inline-size: max-content;
							flex: none !important;
							overflow: visible !important;
						}

						/* Always display task status checkbox even in narrow bars since heading overflows the box. */
						mitra-task-status {
							display: inline-flex !important;
						}
					}

					> .empty {
						grid-column: 1 / -1;
						grid-row: 1;
						position: sticky;
						inset-inline-start: 0;
						width: max-content;
						padding: 0.5rem 1rem;
						color: var(--color-text-muted);
						font-size: 0.8rem;
					}
				}

				/* Sticky drop/create target filling the remaining viewport area below the planned rows. */
				.create {
					grid-column: 1 / -1;
					grid-row: 3;
					position: sticky;
					inset-block-end: 0;
					z-index: 100;
					min-block-size: var(--row-height);
					cursor: cell;

					> .row {
						position: absolute;
						inset-inline: 0;
						inset-block-end: 0;
						block-size: var(--row-height);
						display: flex;
						align-items: center;
						background-color: var(--color-background);
						border-block-start: 1px solid var(--_rule-strong);
						/* The press belongs to the day column underneath. */
						pointer-events: none;
					}

					&:hover > .row {
						background-color: color-mix(in srgb, var(--color-accent) 6%, var(--color-background));
					}

					.hint {
						position: sticky;
						inset-inline-start: 0;
						inline-size: max-content;
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding-inline: 0.75rem;
						color: var(--color-text-muted);
						font-size: 0.75rem;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const context = (entry: Entry) => entry.type === EntryType.Event && !!entry.allDay
		const events = this.bars(context)
		// Cached for scroll-anchoring lookups.
		const rows = this.renderedRows = this.rows
		const placed: Array<PlacedBar> = rows.flatMap((row, index) => row.bars.map(bar => ({ ...bar, row: index + 1 })))
		return html`
			${this.headerTemplate(events)}
			${this.backdropTemplate(events)}
			${this.entriesTemplate(rows, placed)}
			${!getPrimarySource(EntryType.Task) ? html.nothing : html`
				<div class="create">
					<div class="row">
						<span class="hint">
							<mitra-icon icon="plus"></mitra-icon>
							${t('New task')}
						</span>
					</div>
				</div>
			`}
		`
	}

	/** Predicate for entries eligible for the timeline (open, scheduled tasks). */
	private static isPlanned(entry: Entry) {
		return entry.type === EntryType.Task && entry.scheduled && !entry.closed
	}

	/** Unique key identifying a task or recurring instance row. */
	private static rowKey(entry: Entry) {
		return entry.uid
			? `${entry.uid}:${entry.recurrenceId?.valueOf() ?? ''}`
			: entry.id ?? (EntryStore.isPreview(entry) ? 'preview' : 'draft')
	}

	/**
	 * Limits recurring series occurrences to those due within the horizon (or the next single instance),
	 * preventing repetitive tasks from crowding out the planning list.
	 */
	private static withinRoutineHorizon(entries: Array<Entry>): Array<Entry> {
		const now = new DateTime()
		const from = now.dayStart.valueOf()
		const to = now.valueOf() + ROUTINE_HORIZON
		const series = new Map<string, Array<Entry>>()
		const kept = new Array<Entry>()
		for (const entry of entries) {
			const master = entry.recurrenceMasterId
			if (!master) {
				kept.push(entry)
			} else {
				series.set(master, [...series.get(master) ?? [], entry])
			}
		}
		for (const occurrences of series.values()) {
			const sorted = [...occurrences].sort((a, b) => a.start!.valueOf() - b.start!.valueOf())
			const due = sorted.filter(entry => entry.start!.valueOf() >= from && entry.start!.valueOf() <= to)
			kept.push(...due.length ? due : sorted.filter(entry => entry.start!.valueOf() > to).slice(0, 1))
		}
		return kept
	}

	/**
	 * One row per planned task, sorted by start date.
	 * Derived from entries (not visible bars) so panning does not alter row presence. Drafts sort last.
	 */
	private get rows(): Array<TimelineRow> {
		const bars = new Map(this.bars(Timeline.isPlanned).map(bar => [bar.segment.entry, bar]))
		const byKey = new Map<string, TimelineRow>()
		for (const entry of Timeline.withinRoutineHorizon(this.entries.filter(Timeline.isPlanned))) {
			const key = Timeline.rowKey(entry)
			const bar = bars.get(entry)
			const row = byKey.get(key)
			if (row) {
				if (bar) {
					row.bars.push(bar)
				}
			} else {
				byKey.set(key, {
					key,
					date: entry.start!,
					sortValue: entry.persisted ? entry.start!.dayStart.valueOf() : Number.MAX_SAFE_INTEGER,
					heading: entry.heading || '',
					bars: bar ? [bar] : [],
				})
			}
		}
		return [...byKey.values()].sort((a, b) => a.sortValue - b.sortValue || a.heading.localeCompare(b.heading))
	}

	/** Projects entries across the buffer days into column-spanning bars. */
	private bars(accept: (entry: Entry) => boolean): Array<TimelineBar> {
		const days = this.days
		const first = days[0]
		const last = days.at(-1)
		if (!first || !last) {
			return []
		}
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(days.map((day, index) => [day.dayStart.valueOf(), index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		return this.segments.runsIn(first, last, accept).map(segment => {
			const startColumn = columnOf(segment.dayValue)
			const clippedRight = segment.runEnd.dayValue! > lastValue
			const endColumn = clippedRight ? days.length - 1 : columnOf(segment.runEnd.dayValue)
			return { segment, startColumn, span: endColumn - startColumn + 1, clippedRight }
		})
	}

	private barTemplate(bar: TimelineBar, row?: number) {
		return html`
			<mitra-entry-segment
				style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, gridRow: row?.toString() })}
				resize=${ifDefined(bar.segment.entry.allDay ? 'inline' : undefined)}
				?has-previous=${bar.segment.hasPrevious}
				?has-next=${bar.clippedRight}
				.segment=${bar.segment}
			></mitra-entry-segment>
		`
	}

	private headerTemplate(events: Array<TimelineBar>) {
		const { days, offset } = this.dates.window
		const todayValue = new DateTime().dayStart.valueOf()
		// Group days into contiguous month header cells.
		const months = new Array<{ column: number, span: number, label: string }>()
		for (const [index, day] of days.entries()) {
			const previous = days[index - 1]
			if (!previous || day.month !== previous.month) {
				months.push({ column: offset + index, span: 1, label: day.format({ month: 'long', year: 'numeric' }) })
			} else {
				months.at(-1)!.span++
			}
		}
		return html`
			<div class="header">
				${months.map(month => html`
					<div class="month" style="grid-column: ${month.column + 1} / span ${month.span};">
						<span>${month.label}</span>
					</div>
				`)}
				${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
					<div class="day"
						style="grid-column: ${offset + index + 1};"
						?data-week-start=${day.dayOfWeek === 1}
						?data-today=${day.dayStart.valueOf() === todayValue}
					><span>${day.day}</span></div>
				`)}
				<div class="events">
					${repeat(events, bar => bar.segment.entry, bar => this.barTemplate(bar))}
				</div>
			</div>
		`
	}

	private backdropTemplate(events: Array<TimelineBar>) {
		const { days, offset } = this.dates.window
		const todayValue = new DateTime().dayStart.valueOf()
		// Render DOM cells only for the visible window; surrounding buffer days remain empty grid tracks.
		return html`
			<div class="backdrop">
				${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
					<div class="day"
						data-date=${day.dayStart.toISOString()}
						style="grid-column: ${offset + index + 1};"
						?data-month-start=${day.day === 1}
						?data-today=${day.dayStart.valueOf() === todayValue}
					></div>
				`)}
				${events.map(bar => html`
					<div class="shade" style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, '--_shade-color': bar.segment.entry.color ?? getSource(bar.segment.entry.sourceId)?.color ?? '' })}></div>
				`)}
			</div>
		`
	}

	private entriesTemplate(rows: Array<TimelineRow>, placed: Array<PlacedBar>) {
		return html`
			<div class="entries">
				${rows.length ? html.nothing : html`<div class="empty">${t('Nothing planned yet — draw a task on the row below')}</div>`}
				${repeat(rows, row => row.key, (row, index) => html`
					<div class="row" style="grid-row: ${index + 1};">
						<button class="jump before" tabindex="-1" title=${t('Go to entry')} @click=${() => this.jumpToRow(row)}>
							<mitra-icon icon="arrow-left"></mitra-icon>
						</button>
						<button class="jump after" tabindex="-1" title=${t('Go to entry')} @click=${() => this.jumpToRow(row)}>
							<mitra-icon icon="arrow-right"></mitra-icon>
						</button>
					</div>
				`)}
				${repeat(placed, bar => bar.segment.id, bar => this.barTemplate(bar, bar.row))}
				${/* Connectors must render after anchor elements; bar row serves as rank. */ ''}
				${!EntryConnections.isEnabledFor('timeline') ? html.nothing : html`
					<mitra-entry-connections
						.segments=${placed.map(bar => bar.segment)}
						.placement=${new Map(placed.map(bar => [bar.segment, { start: bar.startColumn, end: bar.startColumn + bar.span - 1, rank: bar.row }] as const))}
					></mitra-entry-connections>
				`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-timeline': Timeline
	}
}
