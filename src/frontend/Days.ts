import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, ifDefined } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { observeResize } from '@3mo/resize-observer'
import { Entry } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { DraftController } from './DraftController.js'
import { DragToCreateController } from './DragToCreateController.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly dates = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.dates.days }

	protected readonly dragToCreate = new DragToCreateController(this)
	private readonly draft = new DraftController(this)
	private get segments() { return EntrySegments.of(this.draft.merge(this.entries), this.days) }

	// The all-day lane sticks below the (sticky) day headers, so it needs the header row's height. The
	// time-column header cell stretches to that row, so the `observeResize` directive on it keeps
	// `--header-height` in sync — firing only when it actually resizes (e.g. on font load), not per render.
	private readonly updateHeaderHeight = ([entry]: ResizeObserverEntry[]) => {
		const height = entry?.borderBoxSize?.[0]?.blockSize ?? (entry?.target as HTMLElement | undefined)?.offsetHeight
		if (height) {
			this.style.setProperty('--header-height', `${height}px`)
		}
	}

	private timeTimeout?: ReturnType<typeof setTimeout>

	protected override connected() {
		super.connected()
		this.scheduleTimeUpdate()
	}

	private scheduleTimeUpdate() {
		const now = new DateTime()
		const msUntilNextMinute = 60_000 - (now.second * 1000 + now.millisecond)
		clearTimeout(this.timeTimeout)
		this.timeTimeout = setTimeout(() => {
			this.requestUpdate()
			this.scheduleTimeUpdate()
		}, msUntilNextMinute)
	}

	protected override disconnected() {
		super.disconnected()
		clearTimeout(this.timeTimeout)
	}

	@queryAsync('.now') readonly nowElement?: Promise<HTMLElement>

	protected override async initialized() {
		this.dates.navigatingDate = this.navigatingDate
		this.dates.scrollToDate(this.navigatingDate)
		const now = await this.nowElement
		now?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = this.navigatingDate
			this.dates.scrollToDate(this.navigatingDate)
		}
		this.style.setProperty('--_days-length', this.days.length.toString())
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const timeAxisWidth = 60 // ~3.75rem
		const colWidth = (target.scrollWidth - timeAxisWidth) / this.days.length

		// The browser centers the element within the "snapport", which excludes the time axis.
		// So we must calculate the center pixel of the snapport, not the whole client area.
		// Math.abs() is required because in RTL, scrollLeft is negative.
		const scrollDistance = Math.abs(target.scrollLeft)
		const snapportCenterOffset = timeAxisWidth + (target.clientWidth - timeAxisWidth) / 2
		const centerPixel = scrollDistance + snapportCenterOffset

		const centerCol = Math.floor((centerPixel - timeAxisWidth) / colWidth)
		const centerDate = this.days[Math.min(Math.max(0, centerCol), this.days.length - 1)]

		if (centerDate && !centerDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = centerDate
		}
	}

	static override get styles() {
		return css`
			mitra-days {
				display: grid;
				grid-template-rows: auto auto minmax(var(--grid-min-height), 1fr);
				grid-template-columns: var(--time-axis-width) repeat(var(--_days-length), minmax(10rem, 1fr));
				gap: 1px;
				height: 100%;
				min-height: 0;
				--time-axis-width: 3.75rem;
				container-type: inline-size;
				overflow: auto;
				scroll-padding-inline-start: var(--time-axis-width);
				scrollbar-width: none; /* Firefox */
				--minute-min-height: 0.75px;
				--minute-height: max(var(--minute-min-height), calc(100% / 1440));
				--grid-min-height: calc(1440 * var(--minute-min-height));

				&::-webkit-scrollbar {
					display: none; /* Chrome/Safari */
				}

				&[hideTime] {
					--time-axis-width: 0px;
				}

				mitra-day {
					grid-row: 1 / -1;
					grid-template-rows: subgrid;
					scroll-snap-align: start;

					.entries {
						background-color: var(--color-surface);
						grid-row: 3;
					}

					& > .header {
						background-color: var(--color-background);
						border-bottom: var(--border);
					}
				}

				/* All-day lane: a horizontal strip below the headers where all-day events render as
				   column-spanning bars. Sticky below the (also-sticky) headers so it stays in view. */
				.all-day-corner {
					grid-column: 1;
					grid-row: 2;
					position: sticky;
					inset-inline-start: 0;
					/* +1px for the grid gap between the header row and this one. */
					top: calc(var(--header-height, 2.75rem) + 1px);
					z-index: 120;
					background-color: var(--color-background);
					border-inline-end: var(--border);
					border-bottom: var(--border);
				}

				.all-day {
					grid-column: 2 / -1;
					grid-row: 2;
					position: sticky;
					top: calc(var(--header-height, 2.75rem) + 1px);
					z-index: 90;
					display: grid;
					grid-template-columns: subgrid;
					grid-auto-rows: 1.375rem;
					grid-auto-flow: row dense; /* bars self-place columns by date; dense packing assigns lanes */
					gap: 1px 1px;
					/* A bit of empty space below the bars stays reserved as a drag-to-create placeholder, so the
					   lane is grabbable even when full; min height keeps an empty lane draggable too. */
					padding-block: 2px;
					padding-block-end: 1.5rem;
					min-block-size: 2.75rem;
					align-content: start;
					background-color: var(--color-background);
					border-bottom: var(--border);

					mitra-entry-segment {
						margin-top: 0 !important;
						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0 0.375rem !important;

						> .heading {
							flex: 1 !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
						}
					}
				}

				& > .time {
					display: contents;

					.timezone {
						grid-column: 1;
						grid-row: 1;
						position: sticky;
						top: 0;
						inset-inline-start: 0;
						z-index: 200;
						background-color: var(--color-background);
						border-bottom: var(--border);
						border-inline-end: var(--border);
						padding: 0.5rem 0;
						text-align: center;
						color: var(--color-text-muted);
						font-size: 0.65rem;
						font-weight: 600;
					}

					.axis {
						grid-column: 1;
						grid-row: 3;
						display: grid;
						grid-template-rows: repeat(1440, var(--minute-height));
						border-inline-end: var(--border);
						position: sticky;
						inset-inline-start: 0;
						z-index: 110;
						background-color: var(--color-background);

						.now {
							grid-column: 1;
							justify-self: end;
							align-self: start;
							transform: translateY(-50%);
							background-color: var(--color-accent);
							color: var(--color-accent-text);
							padding: 0.125rem 0.25rem;
							border-radius: var(--border-radius);
							font-size: 0.65rem;
							font-weight: 600;
							z-index: 10;
						}

						.hour {
							font-size: 0.65rem;
							font-weight: 500;
							height: min-content;
							color: var(--color-text-muted);
							text-align: end;
							padding-inline-end: 0.5rem;
							transform: translateY(-50%);
						}
					}

					.overlays {
						grid-column: 2 / -1;
						grid-row: 3;
						display: grid;
						grid-template-rows: repeat(1440, var(--minute-height));
						grid-template-columns: subgrid;

						.hour {
							border-top: var(--border);
							grid-column: 1 / -1;
							z-index: 1;
						}

						.now {
							grid-column: 1 / -1;
							display: grid;
							grid-template-columns: subgrid;
							align-items: center;
							z-index: 10;
							align-self: start;
							transform: translateY(-50%);

							.track {
								grid-column: 1 / -1;
								grid-row: 1;
								height: 1px;
								background-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
							}

							.line {
								grid-row: 1;
								height: 2px;
								background-color: var(--color-accent);
								position: relative;
								overflow: visible;

								&::before, &::after {
									content: '';
									position: absolute;
									top: 50%;
									width: 9px;
									height: 9px;
									border-radius: 50%;
									background-color: var(--color-accent);
								}

								&::before {
									inset-inline-start: 0;
									transform: translate(-50%, -50%);
								}

								&::after {
									inset-inline-end: 0;
									transform: translate(50%, -50%);
								}
							}
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			${this.timeTemplate}
			${this.allDayTemplate}
			${this.dateTemplate}
		`
	}

	private get allDayTemplate() {
		const first = this.days[0]
		const last = this.days.at(-1)
		if (!first || !last) {
			return html.nothing
		}
		// The lane always renders (even with no all-day events) so it stays a drag target for creating one.
		const runs = this.segments.runsIn(first, last, entry => !!entry.allDay)
		// Built once per render so each bar's column is an O(1) numeric lookup (segments cache their dayValue).
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(this.days.map((day, index) => [day.dayStart.valueOf(), index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		return html`
			<div class="all-day-corner"></div>
			<div class="all-day">
				${runs.map(segment => {
			const startColumn = columnOf(segment.dayValue)
			const clippedRight = segment.runEnd.dayValue! > lastValue
			const endColumn = clippedRight ? this.days.length - 1 : columnOf(segment.runEnd.dayValue)
			return html`
						<mitra-entry-segment
							style="grid-column: ${startColumn + 1} / span ${endColumn - startColumn + 1};"
							?has-previous=${segment.hasPrevious}
							?has-next=${clippedRight}
							.segment=${segment}
						></mitra-entry-segment>
					`
				})}
			</div>
		`
	}

	private get timeTemplate() {
		if (this.hideTime) {
			return html.nothing
		}

		const today = new DateTime()
		const reference = this.days[0] || today
		const todayValue = today.dayStart.valueOf()
		const todayIndex = this.days.findIndex(d => d.dayStart.valueOf() === todayValue)
		const currentMinute = today.hour * 60 + today.minute
		const currentTimeString = today.format({ hour: '2-digit', minute: '2-digit', hour12: false })

		return html`
			<div class="time">
				<div class="timezone" ${observeResize(this.updateHeaderHeight)} title=${ifDefined(today.formatToParts({ timeZoneName: 'long' }).find(x => x.type === 'timeZoneName')?.value)}>
					${today.formatToParts({ timeZoneName: 'shortGeneric' }).find(x => x.type === 'timeZoneName')?.value}
				</div>

				<div class="axis">
					${Array.from({ length: reference.hoursInDay }).map((_, i) => {
						const isCloseToNow = todayIndex !== -1 && Math.abs(i * 60 - currentMinute) < 15
						const timeText = (i === 0 || !reference || isCloseToNow) ? '' : reference.with({ hour: i, minute: 0, second: 0, millisecond: 0 }).format({ hour: '2-digit', minute: '2-digit', hour12: false })
						return html`
							<div class="hour" style="grid-row: ${i * 60 + 1};">
								${timeText}
							</div>
						`
					})}
					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="grid-row: ${currentMinute + 1};">${currentTimeString}</div>
					`}
				</div>

				<div class="overlays">
					${Array.from({ length: reference.hoursInDay }).map((_, i) => {
						if (i === 0) return html.nothing
						return html`<div class="hour" style="grid-row: ${i * 60 + 1};"></div>`
					})}

					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="grid-row: ${currentMinute + 1};">
							<div class="track"></div>
							<div class="line" style="grid-column: ${todayIndex + 1};"></div>
						</div>
					`}
				</div>
			</div>
		`
	}

	private get dateTemplate() {
		const todayValue = new DateTime().dayStart.valueOf()
		return html`
			${repeat(this.days, day => day.dayStart.toISOString(), (day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					style="grid-column: ${index + 2};"
					.date=${day}
					.entries=${this.segments.timedOn(day)}
					?today=${day.dayStart.valueOf() === todayValue}
				></mitra-day>
			`)}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-days': Days
	}
}
