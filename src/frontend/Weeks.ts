import { Component, component, html, property, css, type PropertyValues, repeat, event, ifDefined, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'

/** The month view's grid: a vertically-scrolling strip of week rows — named, like `Days` (the week
 * view's strip of day columns), after the unit it strips. */
@component('mitra-weeks')
export class Weeks extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToWeek!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	private static readonly MAX_SLOTS = 4

	// A taller render window than the day view's default: month rows are short, so a tall viewport
	// shows many weeks — the radius must stay comfortably ahead of it (see CalendarDatesController.window).
	private readonly buffer: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 77, shiftDays: 14 })
	protected readonly entryDrag = new EntryDragController(this, 'month')

	private get bufferNavigatingDate(): DateTime { return this.buffer.navigatingDate }
	private get days(): Array<DateTime> { return this.buffer.days }
	private get segments(): EntrySegments { return EntrySegments.of(this.entries, this.buffer.window.days) }

	protected override initialized() {
		this.buffer.navigatingDate = this.navigatingDate
		this.buffer.scrollToDate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = this.navigatingDate
			this.buffer.scrollToDate(this.navigatingDate)
		}
	}

	private handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const daysInWeek = this.navigatingDate.daysInWeek
		const rowCount = this.days.length / daysInWeek

		const rowHeight = target.scrollHeight / rowCount
		const centerRow = Math.floor((target.scrollTop + target.clientHeight / 2) / rowHeight)
		const row = this.days.slice(centerRow * daysInWeek, (centerRow + 1) * daysInWeek)
		const centerDate = row[0] ?? this.days.at(-1)
		if (!centerDate) {
			return
		}

		// A row that straddles two months belongs to both, and the date we already hold is what says
		// WHICH — so when it sits in the centred row there is nothing to re-derive. Without this, the
		// row's first day answers instead, and its month is the earlier one: every arrival in this view
		// re-anchors the scroll (see `initialized`/`updated`), whose scroll event lands here, so
		// switching in on any week that starts in the previous month reported that month and threw the
		// day away — a keyboard hop to the month view silently walked a month back.
		const held = this.buffer.navigatingDate.dayStart.valueOf()
		if (row.some(day => day.dayStart.valueOf() === held)) {
			return
		}

		if (!centerDate.monthStart.equals(this.buffer.navigatingDate.monthStart)) {
			this.buffer.navigatingDate = centerDate
		}
	}

	private get weekDays() {
		return CalendarDatesController.sampleWeek.map(d => d.format({ weekday: 'short' }))
	}

	static override get styles() {
		return css`
			/* Registered so the 100cqb (and the rem-based ideal) they carry are ABSOLUTIZED to px at
			   computed-value time — see the twin registrations in Days.ts for why this is what makes
			   the row math work outside Chromium. */
			@property --_weeks-strip-height {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			@property --_ideal-week-height {
				syntax: '<length>';
				inherits: false;
				initial-value: 136px;
			}

			mitra-weeks {
				display: flex;
				flex-direction: column;
				background-color: var(--color-background);
				flex: 1;
				min-height: 0;

				& > .headers {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					z-index: 200;
				}

				.weekday {
					padding: 0.5rem;
					text-align: center;
					font-size: 0.8rem;
					font-weight: 500;
					color: var(--color-text-muted);
				}

				/* The scroller's size container: the row math below needs the viewport height as 100cqb,
				   an element can't query itself, and mitra-weeks' own height includes the weekday headers —
				   this wrapper is height-identical to the scroller by construction. Size containment is
				   inert on it: a flex: 1 (basis-0) item never consults its contents for its size. */
				& > .body {
					flex: 1;
					min-height: 0;
					container-type: size;
				}

				.days {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					/* Week rows fit the viewport WHOLE, the vertical twin of the week view's day columns
					   (see Days.ts for the mechanics — the atan2() length-ratio and the ±1px gap pay-off):
					   as many ideal-height (8.5rem) rows as fit, never fewer than 2, each stretched to an
					   exact share so no fractional week shows at the fold. The outer max() guards degenerate
					   viewports — below ~2 ideal rows it reverts to the old fixed minimum (rows overflow and
					   scroll with partial weeks rather than crushing the day cells' content). */
					--_weeks-strip-height: 100cqb;
					--_ideal-week-height: 8.5rem;
					--_visible-weeks: max(2, round(down, tan(atan2(var(--_weeks-strip-height), var(--_ideal-week-height))), 1));
					grid-auto-rows: max(var(--_ideal-week-height), calc((var(--_weeks-strip-height) + 1px) / var(--_visible-weeks) - 1px));
					gap: 1px;
					height: 100%;
					overflow-y: auto;
					/* Rest positions align a week row's top to the scrollport, so a settled view always
					   frames whole weeks — block-only, and mandatory does not brake a fling (see Days.ts). */
					scroll-snap-type: block mandatory;
					scrollbar-width: none;
					overflow-anchor: auto;
					&::-webkit-scrollbar {
						display: none;
					}
				}

				.week {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: 1.75rem repeat(var(--max-slots), 1.375rem) 1fr;
					row-gap: 0.125rem;
					scroll-snap-align: start;

					mitra-day {
						grid-row: 1 / -1;
						container-type: size;
					}

					> mitra-entry-segment {
						z-index: 2;
						align-self: stretch;
						margin-top: 0 !important;
						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0 0.375rem !important;

						> .time {
							display: block !important;
							.separator, .end { display: none !important; }
						}

						> .heading {
							flex: 1 !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
						}
					}

					> .more {
						grid-row: calc(var(--max-slots) + 1);
						z-index: 2;
						font-size: 0.7rem;
						font-weight: 500;
						color: var(--color-text-muted);
						cursor: pointer;
						padding: 0 0.375rem;
						align-self: center;

						&:hover {
							color: var(--color-text);
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const today = new DateTime().dayStart
		const daysInWeek = this.navigatingDate.daysInWeek
		const weeks = new Array<Array<DateTime>>()
		for (let i = 0; i < this.days.length; i += daysInWeek) {
			weeks.push(this.days.slice(i, i + daysInWeek))
		}

		// Only the weeks intersecting the render window get real content, each placed at its explicit
		// row; the trailing spacer forces the implicit grid to its full week count, so the scrollbar
		// (and the scroll-position→date math above) never depends on what's rendered.
		const { days: windowDays, offset } = this.buffer.window
		const firstWeek = Math.floor(offset / daysInWeek)
		const lastWeek = windowDays.length ? Math.floor((offset + windowDays.length - 1) / daysInWeek) : firstWeek

		return html`
			${/* data-chrome: part of the grid's frame — kept above the entries a view transition
			   animates, see calendarTransition.ts. */''}
			<div class="headers" data-chrome>
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="body">
				<div class="days" @scroll=${this.handleScroll} style="--max-slots: ${Weeks.MAX_SLOTS};">
					${repeat(weeks.slice(firstWeek, lastWeek + 1), week => week[0]!.dayStart.toISOString(), (week, index) => this.weekTemplate(week, today, firstWeek + index))}
					${!weeks.length ? html.nothing : html`<div style="grid-row: ${weeks.length};"></div>`}
				</div>
			</div>
		`
	}

	private weekTemplate(week: Array<DateTime>, today: DateTime, row: number) {
		const { bars, hiddenByColumn } = this.segments.monthWeek(week, Weeks.MAX_SLOTS)
		return html`
			<div class="week" style="grid-row: ${row + 1};">
				${week.map((day, col) => html`
					<mitra-day
						data-date=${day.dayStart.toISOString()}
						style="grid-column: ${col + 1};"
						.date=${day}
						?today=${day.dayStart.equals(today)}
						?data-with-background=${day.month === this.bufferNavigatingDate.month}>
					</mitra-day>
				`)}
				${repeat(bars, bar => bar.segment.entry, bar => html`
					<mitra-entry-segment
						style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, gridRow: `${bar.slot + 2}` })}
						resize=${ifDefined(bar.segment.entry.allDay ? 'inline' : undefined)}
						?has-previous=${bar.segment.hasPrevious}
						?has-next=${bar.clippedRight}
						.segment=${bar.segment}
					></mitra-entry-segment>
				`)}
				${hiddenByColumn.map((count, col) => !count ? html.nothing : html`
					<div class="more" style="grid-column: ${col + 1};" @click=${() => { this.navigate.dispatch(week[col]!); this.switchToWeek.dispatch() }}>${t('+${count:number} more', { count })}</div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-weeks': Weeks
	}
}
