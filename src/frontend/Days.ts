import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { observeResize } from '@3mo/resize-observer'
import { type Entry, type UserTimeZone } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'
import { getTimeZones } from './Api.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly dates: CalendarDatesController = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.dates.days }

	protected readonly entryDrag = new EntryDragController(this)
	// Segments over the RENDER WINDOW, not the whole buffer — offscreen days need no slicing.
	private get segments() { return EntrySegments.of(this.entries, this.dates.window.days) }

	/** The time-axis columns: the user's additional zones first, the system zone (`undefined` — it
	 * anchors the grid) last, adjacent to the days. */
	private get timeZoneColumns(): Array<UserTimeZone | undefined> {
		return [...getTimeZones(), undefined]
	}

	// The measured width of the (content-sized) time axis, for the scroll math — the snapport excludes
	// the sticky axis, and with auto-sized zone columns the width is only known after layout.
	private timeAxisWidth = 60

	// The all-day lane sticks below the (sticky) day headers, so it needs the header row's height; the
	// scroll-padding and the scroll→date math need the axis column's laid-out width. The time-column
	// header cell stretches to both, so the `observeResize` directive on it keeps `--header-height` and
	// `--time-axis-width` in sync — firing only when it actually resizes, not per render.
	private readonly updateHeaderSize = ([entry]: ResizeObserverEntry[]) => {
		const target = entry?.target as HTMLElement | undefined
		const height = entry?.borderBoxSize?.[0]?.blockSize ?? target?.offsetHeight
		if (height) {
			this.style.setProperty('--header-height', `${height}px`)
		}
		const width = entry?.borderBoxSize?.[0]?.inlineSize ?? target?.offsetWidth
		if (width) {
			this.timeAxisWidth = width
			this.style.setProperty('--time-axis-width', `${width}px`)
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
		this.style.setProperty('--_tz-count', this.timeZoneColumns.length.toString())
		if (this.hideTime) {
			// No axis to measure — let the [hideTime] rule's 0px win over a stale inline measurement.
			this.style.removeProperty('--time-axis-width')
		}
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth // measured (see updateHeaderSize)
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
				/* ONE grid owns every column: an auto track for the "+" affordance, one content-sized
				   track per displayed time zone (the header labels and the axis hours adopt these same
				   tracks via subgrid, so they align by construction), then the day columns. The day
				   tracks are addressed with NEGATIVE line numbers throughout, so nothing depends on how
				   many zone tracks precede them. --time-axis-width mirrors the axis' laid-out width
				   (measured, see updateHeaderSize) for the scroll padding and the scroll→date math. */
				grid-template-columns: auto repeat(var(--_tz-count, 1), auto) repeat(var(--_days-length), minmax(10rem, 1fr));
				gap: 1px;
				height: 100%;
				min-height: 0;
				--time-axis-width: calc(var(--_tz-count, 1) * 3.75rem); /* pre-measurement approximation */
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
					grid-column: 1 / calc(-1 * var(--_days-length) - 1);
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
					grid-column: calc(-1 * var(--_days-length) - 1) / -1;
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
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 1;
						/* The zone labels sit on the parent's own zone tracks (through the header
						   component's nested subgrid), exactly like the axis hours below them. */
						display: grid;
						grid-template-columns: subgrid;
						position: sticky;
						top: 0;
						inset-inline-start: 0;
						z-index: 200;
						background-color: var(--color-background);
						border-bottom: var(--border);
						border-inline-end: var(--border);
						padding: 0.375rem 0;
					}

					.axis {
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 3;
						display: grid;
						grid-template-rows: repeat(1440, var(--minute-height));
						/* The same parent tracks as the header labels — aligned by construction. */
						grid-template-columns: subgrid;
						border-inline-end: var(--border);
						position: sticky;
						inset-inline-start: 0;
						z-index: 110;
						background-color: var(--color-background);

						.now {
							grid-column: -2;
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

							/* An additional zone's hours read as secondary next to the system column's. */
							&[data-foreign] {
								opacity: 0.55;
							}
						}
					}

					.overlays {
						grid-column: calc(-1 * var(--_days-length) - 1) / -1;
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
		// Bars render (and clip) against the window — a run's parts beyond it are offscreen by definition.
		const { days, offset } = this.dates.window
		const first = days[0]
		const last = days.at(-1)
		if (!first || !last) {
			return html.nothing
		}
		// The lane always renders (even with no all-day events) so it stays a drag target for creating one.
		const runs = this.segments.runsIn(first, last, entry => !!entry.allDay)
		// Built once per render so each bar's column is an O(1) numeric lookup (segments cache their dayValue).
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(days.map((day, index) => [day.dayStart.valueOf(), offset + index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		return html`
			<div class="all-day-corner"></div>
			<div class="all-day">
				${repeat(runs, segment => segment.entry, segment => {
					const startColumn = columnOf(segment.dayValue)
					const clippedRight = segment.runEnd.dayValue! > lastValue
					const endColumn = clippedRight ? offset + days.length - 1 : columnOf(segment.runEnd.dayValue)
					return html`
						<mitra-entry-segment
							style=${styleMap({ gridColumn: `${startColumn + 1} / span ${endColumn - startColumn + 1}` })}
							resize="inline"
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
		// The navigating date, not the buffer start: an additional zone's offset must be the one in
		// effect for the VIEWED week (DST!), and the buffer start can be a year and a half away.
		const reference = this.dates.navigatingDate
		const todayValue = today.dayStart.valueOf()
		const todayIndex = this.days.findIndex(d => d.dayStart.valueOf() === todayValue)
		const currentMinute = today.hour * 60 + today.minute
		const currentTimeString = today.format({ hour: '2-digit', minute: '2-digit', hour12: false })
		const zones = this.timeZoneColumns

		return html`
			<div class="time">
				<div class="timezone" ${observeResize(this.updateHeaderSize)}>
					<mitra-time-zone-header @change=${() => this.requestUpdate()}></mitra-time-zone-header>
				</div>

				<div class="axis">
					${zones.map((zone, column) => Array.from({ length: reference.hoursInDay }).map((_, i) => {
						// Blank the label the now-chip is about to overlay — only in its (the system) column.
						const isCloseToNow = !zone && todayIndex !== -1 && Math.abs(i * 60 - currentMinute) < 15
						const timeText = (i === 0 || isCloseToNow) ? '' : reference.with({ hour: i, minute: 0, second: 0, millisecond: 0 })
							.format({ hour: '2-digit', minute: '2-digit', hour12: false, ...(!zone ? {} : { timeZone: zone.id }) })
						return html`
							<div class="hour" style="grid-row: ${i * 60 + 1}; grid-column: ${column + 2};" ?data-foreign=${!!zone}>
								${timeText}
							</div>
						`
					}))}
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
		// Only the window gets real day trees; every other buffer day is just its (empty) grid track —
		// the columns are placed explicitly, so scroll geometry doesn't depend on what's rendered.
		const { days, offset } = this.dates.window
		// Day tracks start after the "+" track and the zone tracks (see the grid-template comment).
		const firstDayColumn = this.timeZoneColumns.length + 2
		return html`
			${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					style="grid-column: ${firstDayColumn + offset + index};"
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
