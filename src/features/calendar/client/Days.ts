import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { observeResize } from '@3mo/resize-observer'
import { type UserTimeZone } from '../../identity/User.js'
import { type Entry } from '../../entries/Entry.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { EntryConnections, type SegmentPlacement } from '../../relations/client/EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
import { EntryDragController } from '../../entries/client/EntryDragController.js'
import { DayDensityController } from './DayDensityController.js'
import { TimeZoneLaneController } from '../../time/client/TimeZoneLaneController.js'
import { getTimeZones } from '../../../infrastructure/http/Api.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly dates: CalendarDatesController = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.dates.days }

	/** Shared scroll-to-date metrics calculating column width and center offset. */
	private get metrics() {
		const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth
		const columnWidth = (this.scrollWidth - timeAxisWidth) / this.days.length
		const centerColumns = Math.floor((this.clientWidth - timeAxisWidth) / 2 / columnWidth)
		return { columnWidth, centerColumns }
	}

	private readonly scrolling: CalendarScrollController = new CalendarScrollController(this, this.dates, {
		axis: 'inline',
		scroller: () => this,
		ready: () => this.axisMeasured || this.hideTime,
		offsetOf: date => {
			const first = this.days[0]
			const { columnWidth, centerColumns } = this.metrics
			if (!first || !(columnWidth > 0)) {
				return undefined
			}
			const index = Math.round((date.dayStart.valueOf() - first.dayStart.valueOf()) / 86_400_000)
			return (index - centerColumns) * columnWidth
		},
		dateAt: offset => {
			const { columnWidth, centerColumns } = this.metrics
			if (!(columnWidth > 0)) {
				return undefined
			}
			const centerColumn = Math.round(offset / columnWidth) + centerColumns
			return this.days[Math.min(Math.max(0, centerColumn), this.days.length - 1)]
		},
		equivalent: (a, b) => a.dayStart.equals(b.dayStart),
		arrived: date => this.renderRoot.querySelector(`[data-date="${date.dayStart.toISOString()}"]`)?.scrollIntoView({ block: 'center', inline: 'nearest' }),
	})

	protected readonly entryDrag = new EntryDragController(this)
	protected readonly density = new DayDensityController(this)
	protected readonly zoneLane: TimeZoneLaneController = new TimeZoneLaneController(this)
	private get segments() { return EntrySegments.of(this.entries, this.dates.window.days) }

	/** Time axis columns with user-configured zones followed by the anchor system zone. */
	private get timeZoneColumns(): Array<UserTimeZone | undefined> {
		return [...getTimeZones(), undefined]
	}

	private timeAxisWidth = 60
	private axisMeasured = false

	/** Sync header height and time-axis width on resize. */
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
			this.axisMeasured = true
			void this.scrolling.anchor()
			this.updateLaneHeight()
		}
	}

	private timeTimeout?: ReturnType<typeof setTimeout>

	protected override connected() {
		super.connected()
		this.toggleAttribute('data-lane-immediate', true)
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
		void this.scrolling.anchor()
		const now = await this.nowElement
		now?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.scrolling.navigate(this.navigatingDate)
		}
		if (props.has('hideTime')) {
			void this.scrolling.anchor()
		}
		this.style.setProperty('--_days-length', this.days.length.toString())
		this.style.setProperty('--_tz-count', this.timeZoneColumns.length.toString())
		this.toggleAttribute('data-alternative-zones', this.timeZoneColumns.length > 1)
		if (this.hideTime) {
			this.style.removeProperty('--time-axis-width')
		}
		this.updateLaneHeight()
	}

	private allDayPlacements = new Array<{ lane: number, start: number, end: number }>()

	/** Updates all-day lane height based on visible on-screen bar depth. */
	private updateLaneHeight() {
		const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth
		const columnWidth = (this.scrollWidth - timeAxisWidth) / this.days.length
		if (!(columnWidth > 0)) {
			return
		}
		const leadingColumn = Math.round(Math.abs(this.scrollLeft) / columnWidth)
		const trailingColumn = leadingColumn + Math.ceil((this.clientWidth - timeAxisWidth) / columnWidth)
		const clamp = (index: number) => Math.min(Math.max(0, index), this.days.length - 1)
		const first = this.days[clamp(leadingColumn)]?.dayStart.valueOf() ?? 0
		const last = this.days[clamp(trailingColumn)]?.dayStart.valueOf() ?? -1
		let deepest = -1
		for (const placement of this.allDayPlacements) {
			if (placement.start <= last && placement.end >= first) {
				deepest = Math.max(deepest, placement.lane)
			}
		}
		this.style.setProperty('--_all-day-rows', `${deepest + 2}`)
		if ((this.axisMeasured || this.hideTime) && this.allDayPlacements.length && this.hasAttribute('data-lane-immediate')) {
			requestAnimationFrame(() => this.removeAttribute('data-lane-immediate'))
		}
	}

	@eventListener('scroll')
	protected handleScroll() {
		this.updateLaneHeight()
	}

	static override get styles() {
		return css`
			@property --_days-strip-width { syntax: '<length>'; inherits: false; initial-value: 0px; }
			@property --time-axis-width { syntax: '<length>'; inherits: true; initial-value: 0px; }
			@property --_ideal-day-width { syntax: '<length>'; inherits: false; initial-value: 160px; }
			@property --_all-day-lane-height { syntax: '<length>'; inherits: true; initial-value: 22px; }
			@property --zone-width { syntax: '<length>'; inherits: true; initial-value: 0px; }
			@property --zone-lane-width { syntax: '<length>'; inherits: true; initial-value: 52px; }
			@property --_auto-fold { syntax: '<number>'; inherits: false; initial-value: 0; }

			@container (max-width: 40rem) {
				mitra-days { --_auto-fold: 1; }
			}

			mitra-days {
				display: grid;
				--_all-day-lane-height: calc(var(--_all-day-rows, 1) * (1.375rem + 1px) - 1px);
				--grid-min-height: max(0px, calc(var(--_week-zoom, 1) * (100% - var(--header-height, 2.75rem) - var(--_all-day-lane-height) - 2px)));
				grid-template-rows: auto var(--_all-day-lane-height) var(--grid-min-height);
				align-content: start;
				--_days-strip-width: 100cqi;
				--_ideal-day-width: 10rem;
				--_visible-days: max(3, round(down, tan(atan2(var(--_days-strip-width) - var(--time-axis-width), var(--_ideal-day-width))), 1));
				--_day-width: max(4rem, calc((var(--_days-strip-width) - var(--time-axis-width) + 1px) / var(--_visible-days) - 1px));
				grid-template-columns: auto repeat(var(--_tz-count, 1), auto) repeat(var(--_days-length, 1), var(--_day-width));
				gap: 1px;
				height: 100%;
				min-height: 0;
				--zone-lane-width: 4rem;
				--zone-width: var(--zone-lane-width);
				--_lane-height-duration: 0.18s;
				transition: --zone-width 0.3s cubic-bezier(0.3, 0, 0.4, 1), --_all-day-lane-height var(--_lane-height-duration) ease-out;

				&[data-lane-immediate] { --_lane-height-duration: 0s; }
				--time-axis-width: calc(3.75rem + (var(--_tz-count, 1) - 1) * var(--zone-width));

				&[data-alternative-zones] :is(.timezone, .axis) { touch-action: pan-y; }
				&[data-zones-folded] { --zone-width: 0px; }
				&[data-zones-immediate] { transition: none; }

				container-type: inline-size;
				overflow: auto;
				scroll-timeline: --mitra-days-scroll block;
				touch-action: pan-x pan-y;
				scroll-snap-type: inline mandatory;
				scroll-padding-inline-start: var(--time-axis-width);
				scrollbar-width: none;

				&::-webkit-scrollbar { display: none; }

				&[hideTime] {
					--time-axis-width: 0px;
					--zone-width: 0px;
				}

				> .canvas {
					grid-row: 1 / -1;
					grid-column: calc(-1 * var(--_days-length) - 1) / -1;
					display: grid;
					grid-template-rows: subgrid;
					grid-template-columns: subgrid;
					position: relative;
				}

				mitra-day {
					grid-row: 1 / -1;
					grid-template-rows: subgrid;
					scroll-snap-align: var(--scroll-snap-align);

					.entries { background-color: var(--color-surface); grid-row: 3; }
					& > .header { background-color: var(--color-background); }
				}

				.all-day-corner {
					grid-column: 1 / calc(-1 * var(--_days-length) - 1);
					grid-row: 2;
					position: sticky;
					inset-inline-start: 0;
					top: var(--header-height, 2.75rem);
					z-index: 120;
					background-color: var(--color-background);
					border-block: var(--border);
					margin-block-end: -1px;
				}

				.all-day {
					grid-column: calc(-1 * var(--_days-length) - 1) / -1;
					grid-row: 2;
					position: sticky;
					top: var(--header-height, 2.75rem);
					z-index: 90;
					anchor-name: --mitra-all-day-lane;
					--mitra-connection-z: 0;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: repeat(var(--_all-day-window-rows, 1), 1.375rem);
					overflow-y: clip;
					border-block-end: 1px solid var(--color-background);
					gap: 1px;
					align-content: start;
					background-color: var(--color-background);
					margin-block-end: -1px;

					> .day { grid-row: 1 / -1; background-color: var(--color-surface); }

					mitra-entry-segment {
						margin-top: 0 !important;
						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0 0.375rem !important;
						overflow: clip !important;

						> .heading {
							flex: 0 1 auto !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
							position: sticky;
							inset-inline-start: calc(var(--time-axis-width, 0px) + 0.375rem);
						}
					}
				}

				& > .time {
					display: contents;

					.timezone, .axis { user-select: none; }

					.timezone {
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 1;
						display: grid;
						grid-template-columns: subgrid;
						position: sticky;
						top: 0;
						inset-inline-start: 0;
						z-index: 200;
						background-color: var(--color-background);
						padding: 0.375rem 0;
					}

					.axis {
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 3;
						display: grid;
						grid-template-rows: repeat(1440, minmax(0, 1fr));
						grid-template-columns: subgrid;
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

							&[data-foreign] {
								opacity: calc(0.55 * clamp(0, tan(atan2(var(--zone-width), var(--zone-lane-width))), 1));
								box-sizing: border-box;
								max-inline-size: var(--zone-width);
								overflow: clip;
								padding-inline-end: min(0.5rem, var(--zone-width));
							}
						}
					}

					.overlays {
						--border: 1px solid var(--color-background);
						grid-column: calc(-1 * var(--_days-length) - 1) / -1;
						grid-row: 3;
						display: grid;
						grid-template-rows: repeat(1440, minmax(0, 1fr));
						grid-template-columns: subgrid;

						.hour { border-top: var(--border); grid-column: 1 / -1; z-index: 1; }

						.now {
							grid-column: 1 / -1;
							display: grid;
							grid-template-columns: subgrid;
							align-items: center;
							z-index: 10;
							align-self: start;
							transform: translateY(-50%);

							.track { grid-column: 1 / -1; grid-row: 1; height: 1px; background-color: color-mix(in srgb, var(--color-accent) 40%, transparent); }

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

								&::before { inset-inline-start: 0; transform: translate(-50%, -50%); }
								&::after { inset-inline-end: 0; transform: translate(50%, -50%); }
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
			<div class="all-day-corner" data-chrome></div>
			<div class="canvas" ${observeResize(this.updateScrollRange)}>
				${this.allDayTemplate}
				${this.dateTemplate}
				${this.connectionsTemplate}
			</div>
		`
	}

	private static readonly laneRankFloor = 1e12

	private laneSegments: ReadonlyArray<EntrySegment> = []
	private lanePlacement: ReadonlyMap<EntrySegment, SegmentPlacement> = new Map()

	private lastScrollRange = -1
	private readonly updateScrollRange = () => {
		const range = Math.max(0, this.scrollHeight - this.clientHeight)
		if (range !== this.lastScrollRange) {
			this.lastScrollRange = range
			this.style.setProperty('--mitra-days-scroll-range', `${range}px`)
		}
	}

	private get connectionsTemplate() {
		return !EntryConnections.isEnabledFor('week') ? html.nothing : html`
			<mitra-entry-connections draft-host
				.segments=${[...this.laneSegments, ...this.dates.window.days.flatMap(day => this.segments.timedOn(day))]}
				.placement=${this.lanePlacement}
			></mitra-entry-connections>
		`
	}

	private get allDayTemplate() {
		const { days, offset } = this.dates.window
		const first = days[0]
		const last = days.at(-1)
		this.laneSegments = []
		this.lanePlacement = new Map()
		if (!first || !last) {
			return html.nothing
		}
		const runs = this.segments.runsIn(first, last, entry => !!entry.allDay)
		const slots = this.segments.allDaySlots
		const laneCount = runs.reduce((count, segment) => EntryStore.isPreview(segment.entry) ? count : Math.max(count, (slots.get(segment.entry) ?? -1) + 1), 0)
		const laneOf = (entry: Entry) => Math.min(slots.get(entry) ?? laneCount, laneCount)
		this.allDayPlacements = runs
			.filter(segment => !EntryStore.isPreview(segment.entry))
			.map(segment => ({ lane: laneOf(segment.entry), start: segment.dayValue!, end: segment.runEnd.dayValue! }))
		this.style.setProperty('--_all-day-window-rows', `${laneCount + 1}`)
		this.updateLaneHeight()
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(days.map((day, index) => [day.dayStart.valueOf(), offset + index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		const bars = runs.map(segment => {
			const startColumn = columnOf(segment.dayValue)
			const clippedRight = segment.runEnd.dayValue! > lastValue
			const endColumn = clippedRight ? offset + days.length - 1 : columnOf(segment.runEnd.dayValue)
			return { segment, startColumn, endColumn, clippedRight }
		})
		const placements = new Map(runs.map(segment => [segment, {
			start: Math.round(segment.dayValue! / 86_400_000),
			end: Math.round(Math.min(segment.runEnd.dayValue ?? segment.dayValue!, lastValue) / 86_400_000),
			rank: laneOf(segment.entry),
		}]))
		this.laneSegments = runs
		this.lanePlacement = new Map([...placements].map(([segment, placement]) =>
			[segment, { ...placement, rank: placement.rank - Days.laneRankFloor, frame: 'lane' as const }]))
		return html`
			<div class="all-day">
				${days.map((_, index) => html`<div class="day" style="grid-column: ${offset + index + 1};"></div>`)}
				${repeat(bars, bar => bar.segment.entry, bar => html`
					<mitra-entry-segment
						style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.endColumn - bar.startColumn + 1}`, gridRow: `${laneOf(bar.segment.entry) + 1}` })}
						resize="inline"
						?has-previous=${bar.segment.hasPrevious}
						?has-next=${bar.clippedRight}
						.segment=${bar.segment}
					></mitra-entry-segment>
				`)}
				${!EntryConnections.isEnabledFor('week') ? html.nothing : html`
					<mitra-entry-connections .segments=${runs} .placement=${placements}></mitra-entry-connections>
				`}
			</div>
		`
	}

	private get timeTemplate() {
		if (this.hideTime) {
			return html.nothing
		}

		const today = new DateTime()
		const reference = this.dates.navigatingDate
		const todayValue = today.dayStart.valueOf()
		const todayIndex = this.days.findIndex(d => d.dayStart.valueOf() === todayValue)
		const currentMinute = today.hour * 60 + today.minute
		const currentTimeString = today.format({ hour: '2-digit', minute: '2-digit', hour12: false })
		const zones = this.timeZoneColumns

		return html`
			<div class="time">
				<div class="timezone" data-chrome ${observeResize(this.updateHeaderSize)}>
					<mitra-time-zone-header ?folded=${this.zoneLane.folded}
						@change=${() => this.requestUpdate()}
						@fold=${(e: CustomEvent<boolean>) => this.zoneLane.setFolded(e.detail)}
					></mitra-time-zone-header>
				</div>

				<div class="axis" data-chrome>
					${zones.map((zone, column) => Array.from({ length: reference.hoursInDay }).map((_, i) => {
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
		const { days, offset } = this.dates.window
		return html`
			${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					column-header
					style="grid-column: ${offset + index + 1};"
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
