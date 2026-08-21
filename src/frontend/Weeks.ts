import { Component, component, html, property, css, type PropertyValues, repeat, event, ifDefined, styleMap, query } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from 'shared'
import { EntrySegments, type MonthWeek } from './EntrySegments.js'
import { EntryConnections } from './EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
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

	@query('.days') private readonly daysElement?: HTMLElement

	/** The shared numbers of the scroll↔date contract — the (averaged, gap-inclusive) week-row pitch
	 * and how many whole rows sit between the scrollport's start and its centre. Counted from the row
	 * at the scrollport's START, like the week view's columns: the mandatory snap makes it a whole
	 * row, so rounding to it is stable, where the centre PIXEL's row sat on a knife edge whenever an
	 * even number of rows fit. */
	private get metrics() {
		const scroller = this.daysElement
		const daysInWeek = this.navigatingDate.daysInWeek
		const rowCount = this.days.length / daysInWeek
		const pitch = !scroller || !rowCount ? 0 : scroller.scrollHeight / rowCount
		const centerRows = !scroller || !(pitch > 0) ? 0 : Math.floor(scroller.clientHeight / 2 / pitch)
		return { daysInWeek, rowCount, pitch, centerRows }
	}

	private readonly scrolling: CalendarScrollController = new CalendarScrollController(this, this.buffer, {
		axis: 'block',
		scroller: () => this.daysElement ?? null,
		ready: () => this.days.length > 0,
		offsetOf: date => {
			const first = this.days[0]
			const { daysInWeek, pitch, centerRows } = this.metrics
			if (!first || !(pitch > 0)) {
				return undefined
			}
			// Consecutive local days, so the (DST-tolerant, hence rounded) day distance IS the index.
			const index = Math.round((date.dayStart.valueOf() - first.dayStart.valueOf()) / 86_400_000)
			return (Math.floor(index / daysInWeek) - centerRows) * pitch
		},
		dateAt: offset => {
			const { daysInWeek, rowCount, pitch, centerRows } = this.metrics
			if (!(pitch > 0)) {
				return undefined
			}
			const centerRow = Math.round(offset / pitch) + centerRows
			return this.days[Math.min(Math.max(0, centerRow), rowCount - 1) * daysInWeek]
		},
		// A row that straddles two months belongs to both, and the date already held is what says
		// WHICH — a reading answering the held date's own week (or month) has nothing to re-derive.
		// Without the week half, switching in on any week that starts in the previous month reported
		// that month and threw the day away — a keyboard hop to the month view silently walked a
		// month back.
		equivalent: (a, b) => a.weekStart.dayStart.equals(b.weekStart.dayStart) || a.monthStart.dayStart.equals(b.monthStart.dayStart),
	})

	protected override initialized() {
		this.scrolling.navigate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.scrolling.navigate(this.navigatingDate)
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

			@property --_weeks-strip-width {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			/* Registered as a NUMBER above all so it inherits COMPUTED: an unregistered property hands
			   its raw tokens down, and the 100cqi inside would re-resolve against whatever container is
			   nearest to the element using it — a day cell and every bar are size containers of their
			   own, so each would answer with its own width instead of the strip's. Registered, the ratio
			   is a finished number by the time it leaves .days, and plain inheritance carries it into
			   every cell, bar and numeral below. */
			@property --_month-density {
				syntax: '<number>';
				inherits: true;
				initial-value: 1;
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

				/* The scroller's size container: the row math below needs the viewport height as 100cqb
				   (and the density ramp the strip width as 100cqi), an element can't query itself, and
				   mitra-weeks' own height includes the weekday headers — this wrapper is height-identical
				   to the scroller by construction. Size containment is inert on it: a flex: 1 (basis-0)
				   item never consults its contents for its size. */
				& > .body {
					flex: 1;
					min-height: 0;
					container-type: size;
				}

				.days {
					height: 100%;
					overflow-y: auto;
					/* Rest positions align a week row's top to the scrollport, so a settled view always
					   frames whole weeks — block-only, and mandatory does not brake a fling (see Days.ts).
					   Whether there is anything to snap to is the scrolling device's call, on .week below. */
					scroll-snap-type: block mandatory;
					scrollbar-width: none;
					overflow-anchor: auto;
					&::-webkit-scrollbar {
						display: none;
					}
				}

				/* The month grid, wrapped in the POSITIONED, co-scrolling canvas that makes the bars
				   anchorable by the connections layer (the same pattern as the week view's canvas —
				   see Days.ts; the scroller itself must NOT be the containing block). Not a stacking
				   context: the bars' z 2 and the connectors' z 1 interleave in the view's context.
				   The grid itself lives HERE rather than on the scroller so the two roles stay
				   separate — the row math below still measures the .body size container, which is
				   height-identical to the scroller. */
				.canvas {
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

					/* The grid's density, as a CONTINUOUS function of the strip's width rather than a
					   breakpoint: 0 at phone width (≤24rem) up to 1 at a comfortable desktop (≥56rem),
					   linear in between — tan(atan2()) turns the two lengths into a plain ratio, the same
					   trick as the row count above. Every compact↔comfortable pair below interpolates
					   through this one number, so a ~3.3rem day cell isn't wearing desktop-sized furniture
					   (which used to spend a third of the cell before any entry drew), a split-screen
					   window sits naturally in between, and there is no cliff to tune. */
					--_month-density: clamp(0, calc(tan(atan2(var(--_weeks-strip-width) - 24rem, 1px)) / tan(atan2(56rem - 24rem, 1px))), 1);
					--_weeks-strip-width: 100cqi;
					grid-auto-rows: max(var(--_ideal-week-height), calc((var(--_weeks-strip-height) + 1px) / var(--_visible-weeks) - 1px));
					gap: 1px;
					min-block-size: 100%;
					position: relative;
				}

				.week {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					/* Numeral track 1.375→1.75rem and bar rows 1.125→1.375rem along the density ramp. */
					grid-template-rows:
						calc(1.375rem + 0.375rem * var(--_month-density))
						repeat(var(--max-slots), calc(1.125rem + 0.25rem * var(--_month-density)))
						1fr;
					row-gap: 0.125rem;
					scroll-snap-align: var(--scroll-snap-align);

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
						/* The bar's own chrome rides the density ramp too — at ~3.3rem per day cell, the
						   desktop paddings and the 3px accent edge were a quarter of the cell. */
						gap: calc(0.25rem + 0.125rem * var(--_month-density)) !important;
						padding: 0 calc(0.25rem + 0.125rem * var(--_month-density)) !important;
						border-inline-start-width: calc(2px + 1px * var(--_month-density));

					/* Nothing to say about the time here any more: whether a bar can carry it, and whether it
						   leads the title or sits above it, both fall out of the bar's OWN box in EventSegment —
						   a month bar is short, so its time inlines and drops its end. */

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
						font-size: calc(0.65rem + 0.05rem * var(--_month-density));
						font-weight: 500;
						color: var(--color-text-muted);
						cursor: pointer;
						padding: 0 calc(0.25rem + 0.125rem * var(--_month-density));
						align-self: center;

						&:hover {
							color: var(--color-text);
						}
					}

					/* The cell's numeral rides the same ramp — reachable from HERE because the density is
					   an inherited computed number (see its registration): a container query or cq unit
					   written against the numeral would answer the CELL, its nearest container. And it
					   deliberately does not live in Day.ts, where a year cell (the same size as a phone's
					   month cell) would be indistinguishable — the .week scope says which view this is. */
					mitra-day .header .day {
						font-size: calc(0.75rem + 0.125rem * var(--_month-density));

						&[data-today] {
							min-width: calc(1.25rem + 0.25rem * var(--_month-density));
							min-height: calc(1.25rem + 0.25rem * var(--_month-density));
							padding: calc(0.1rem + 0.1rem * var(--_month-density)) calc(0.3rem + 0.1rem * var(--_month-density));
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

		// Week layouts computed once per render: the bars feed both the rows and the connections layer
		// (which must see exactly the RENDERED bars — "+N more" overflow excluded, so no edge can
		// reference an anchor that doesn't exist).
		const rendered = weeks.slice(firstWeek, lastWeek + 1).map((week, index) => ({
			week,
			row: firstWeek + index,
			...this.segments.monthWeek(week, Weeks.MAX_SLOTS) as MonthWeek,
		}))

		return html`
			${/* data-chrome: part of the grid's frame — kept above the entries a view transition
			   animates, see calendarTransition.ts. */''}
			<div class="headers" data-chrome>
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="body">
				${/* No @scroll: CalendarScrollController owns the scroll↔date relationship and binds to
				     this element through `daysElement`. It reads pitch off the scroller's scrollHeight,
				     which is the canvas's height — unchanged by moving the grid one level in. */''}
				<div class="days">
					${/* The grid lives on the canvas, not the scroller — see the .canvas rule. */''}
					<div class="canvas" style="--max-slots: ${Weeks.MAX_SLOTS};">
						${repeat(rendered, item => item.week[0]!.dayStart.toISOString(), item => this.weekTemplate(item, today))}
						${!weeks.length ? html.nothing : html`<div style="grid-row: ${weeks.length};"></div>`}
						${!EntryConnections.isEnabledFor('month') ? html.nothing : html`
							<mitra-entry-connections
								.segments=${rendered.flatMap(item => item.bars.map(bar => bar.segment))}
								.verticalRank=${new Map(rendered.flatMap(item => item.bars.map(bar => [bar.segment, item.row * 100 + bar.slot] as const)))}
							></mitra-entry-connections>
						`}
					</div>
				</div>
			</div>
		`
	}

	private weekTemplate({ week, row, bars, hiddenByColumn }: { week: Array<DateTime>, row: number, bars: MonthWeek['bars'], hiddenByColumn: MonthWeek['hiddenByColumn'] }, today: DateTime) {
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
