import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Localizer } from '@3mo/localization'
import { observeResize } from '@3mo/resize-observer'
import { type TimeZone } from '#features/time/TimeZone.js'
import { type UserTimeZone } from '#features/time/UserTimeZones.js'
import type { EntryOccurrence } from '#features/recurrence'
import { EntrySegments } from '#features/entries/client/EntrySegments.js'
import { type EntrySegment } from '#features/entries/client/EntrySegment.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { Availability } from '#features/availability/client/Availability.js'
import { EntryConnections, type SegmentPlacement } from '#features/relations/client/EntryConnections.js'
import { EntryDragController } from '#features/entries/client/EntryDragController.js'
import { TimeZoneLaneController } from '#features/time/client/TimeZoneLaneController.js'
import { TimeZones } from '#features/time/client/TimeZones.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
import { DayDensityController } from './DayDensityController.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	/** Whether `navigatingDate` comes from a step, which keeps the time in view. */
	@property({ type: Boolean }) stepping = false
	@property({ type: Array }) occurrences = new Array<EntryOccurrence>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly dates: CalendarDatesController = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.dates.days }

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
		// The zone lane anchors the date itself while it moves; an offset read meanwhile is a day the narrowing passed.
		suspended: () => this.zoneLane.moving,
		// Today is arrived at at the time it is now, any other day at its middle.
		arrival: date => {
			const target = date.dayStart.equals(new DateTime().dayStart)
				? this.renderRoot.querySelector('.overlays > .now')
				: this.renderRoot.querySelector(`[data-date="${date.dayStart.toISOString()}"]`)
			const box = target?.getBoundingClientRect()
			return !box ? undefined : box.top - this.getBoundingClientRect().top - this.clientTop + this.scrollTop + (box.height - this.clientHeight) / 2
		},
	})

	protected readonly entryDrag = new EntryDragController(this)
	protected readonly density = new DayDensityController(this)
	protected readonly zoneLane: TimeZoneLaneController = new TimeZoneLaneController(this, settled => void this.scrolling.anchor().then(() => settled && this.updateLaneHeight()))
	private get segments() { return EntrySegments.of(Availability.outside(this.occurrences), this.dates.window.days) }

	/** `undefined` is the anchor, here, which comes last. */
	private get timeZoneColumns(): Array<UserTimeZone | undefined> {
		return [...TimeZones.besides, undefined]
	}

	/** The axis' width as CSS lays it out this frame, a moving zone lane included, where a measurement is a frame behind. */
	private get timeAxisWidth() {
		return parseFloat(getComputedStyle(this).getPropertyValue('--time-axis-width')) || 0
	}

	private axisMeasured = false

	private readonly updateHeaderSize = ([entry]: ResizeObserverEntry[]) => {
		const target = entry?.target as HTMLElement | undefined
		const height = entry?.borderBoxSize?.[0]?.blockSize ?? target?.offsetHeight
		if (height) {
			this.style.setProperty('--header-height', `${height}px`)
		}
		const width = entry?.borderBoxSize?.[0]?.inlineSize ?? target?.offsetWidth
		if (!width) {
			return
		}
		// The lane's columns are CSS's own, so a fold changes nothing measured here and the days follow it in the same frame.
		const lane = (this.timeZoneColumns.length - 1) * (parseFloat(getComputedStyle(this).getPropertyValue('--zone-width')) || 0)
		const rest = width - lane
		// Within layout's rounding of the lane's columns, nothing changed.
		if (Math.abs(rest - this.axisRest) < 0.5 && this.axisMeasured) {
			return
		}
		this.axisRest = rest
		this.style.setProperty('--_axis-rest', `${rest}px`)
		this.axisMeasured = true
		void this.scrolling.anchor()
		this.updateLaneHeight()
	}

	private axisRest = 0

	private timeTimeout?: ReturnType<typeof setTimeout>

	protected override connected() {
		super.connected()
		this.scheduleTimeUpdate()
		void document.fonts.ready.then(() => this.measureLane(true))
	}

	private laneLabels = ''

	/**
	 * The zone lane opens as wide as its widest label, a time or a zone's name, as CSS must know its columns' width
	 * (`--time-axis-width`). Measured only when the labels' text changes, and once the fonts are in.
	 */
	private measureLane(force = false) {
		const labels = [...this.querySelectorAll<HTMLElement>('.axis > .hour[data-foreign], mitra-time-zone-header .zone[data-alternative]')]
		const texts = labels.map(label => label.textContent).join('|')
		if (!labels.length || (!force && texts === this.laneLabels)) {
			return
		}
		this.laneLabels = texts
		// A label's text keeps its width however narrow the folding lane makes its box.
		const range = document.createRange()
		let widest = 0
		for (const label of labels) {
			range.selectNodeContents(label)
			widest = Math.max(widest, range.getBoundingClientRect().width)
		}
		// With its padding open: 0.5rem at a time's end, 0.25rem on either side of a name.
		this.style.setProperty('--zone-lane-width', `calc(${Math.ceil(widest)}px + 0.5rem)`)
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
		// A scroll hands back the very date it read; any other date is a navigation, also to the day already in view
		// (Today, after scrolling away from the time it is now).
		if (props.has('navigatingDate') && this.navigatingDate !== this.dates.navigatingDate) {
			this.scrolling.navigate(this.navigatingDate, { arrive: !this.stepping })
		}
		if (props.has('hideTime')) {
			void this.scrolling.anchor()
		}
		this.style.setProperty('--_days-length', this.days.length.toString())
		this.style.setProperty('--_tz-count', this.timeZoneColumns.length.toString())
		this.toggleAttribute('data-alternative-zones', this.timeZoneColumns.length > 1)
		this.updateLaneHeight()
		this.applyScrollRange()
		// The header renders its names after this.
		void this.querySelector('mitra-time-zone-header')?.updateComplete.then(() => this.measureLane())
	}

	private allDayPlacements = new Array<{ lane: number, start: number, end: number }>()

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
	}

	@eventListener('scroll')
	protected handleScroll() {
		// Measured once the zone lane comes to rest: in between, every frame's scroll laid the week out a second time.
		if (!this.zoneLane.moving) {
			this.updateLaneHeight()
		}
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
			/* Only the host reads these, so they don't inherit: a change of an inherited one, every frame of a zoom,
			   recalculated the style of every element in the week. */
			@property --_week-zoom { syntax: '<number>'; inherits: false; initial-value: 1; }
			@property --_all-day-rows { syntax: '<number>'; inherits: false; initial-value: 1; }

			@container (max-width: 40rem) {
				mitra-days { --_auto-fold: 1; }
			}

			mitra-days {
				display: grid;
				--_all-day-lane-height: calc(var(--_all-day-rows, 1) * (1.375rem + 1px) - 1px);
				/* The timed rows, inline rather than a variable: a variable here would inherit, and a zoom recalculate the week's style. */
				grid-template-rows: auto var(--_all-day-lane-height) max(0px, calc(var(--_week-zoom) * (100% - var(--header-height, 2.75rem) - var(--_all-day-lane-height) - 2px)));
				align-content: start;
				--_days-strip-width: 100cqi;
				--_ideal-day-width: 10rem;
				--_visible-days: max(3, round(down, tan(atan2(var(--_days-strip-width) - var(--time-axis-width), var(--_ideal-day-width))), 1));
				--_day-width: max(4rem, calc((var(--_days-strip-width) - var(--time-axis-width) + 1px) / var(--_visible-days) - 1px));
				grid-template-columns: auto repeat(var(--_tz-count, 1), auto) repeat(var(--_days-length, 1), var(--_day-width));
				gap: 1px;
				height: 100%;
				min-height: 0;
				/* Until measured, which sets it to the widest label (measureLane). */
				--zone-lane-width: 4rem;
				--zone-width: var(--zone-lane-width);
				/* The all-day lane's height snaps: a frame of its transition re-laid out every day. */
				transition: --zone-width 0.3s cubic-bezier(0.3, 0, 0.4, 1);

				/* What never folds (the controls, the anchor zone, the gaps) is measured; the lane's columns are its width each. */
				--time-axis-width: calc(var(--_axis-rest, 3.75rem) + (var(--_tz-count, 1) - 1) * var(--zone-width));

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

					/* The surface is the day's, beneath its entries, which are a stacking context (below), so the hour lines and
					   connectors stay drawn between the two. The header and the lane cover its other rows. */
					background-color: var(--color-surface);

					.entries {
						grid-row: 3;
						/* A zoom re-lays out every day, so the days out of view skip their chips. Its paint containment makes each day
						   a stacking context, lifted as a whole to where its chips sat: over the hour lines and connectors. */
						content-visibility: auto;
						contain-intrinsic-size: none;
						z-index: 2;
					}
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

					/* Placed by their minute's fraction of the day, as the chips are (Day.ts). */
					:is(.axis, .overlays) > :is(.hour, .now) {
						grid-row: 1;
						align-self: start;
						position: relative;
						top: calc(var(--_at) * 100% / 1440);
					}

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
						grid-template-rows: minmax(0, 1fr);
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
							white-space: nowrap;
							z-index: 10;
						}

						.hour {
							font-size: 0.65rem;
							font-weight: 500;
							white-space: nowrap;
							height: min-content;
							color: var(--color-text-muted);
							text-align: end;
							padding-inline-end: 0.5rem;
							transform: translateY(-50%);

							/* Exactly as wide as the lane, as is its header label, so the column is too and the axis' width is CSS's
							   own (--time-axis-width): sized to their text, the days followed a measurement a frame behind. */
							&[data-foreign] {
								opacity: calc(0.55 * clamp(0, tan(atan2(var(--zone-width), var(--zone-lane-width))), 1));
								box-sizing: border-box;
								inline-size: var(--zone-width);
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
						grid-template-rows: minmax(0, 1fr);
						grid-template-columns: subgrid;

						/* Click-through: a line lies over the day, and a click on it belongs to what is beneath (the grid's create
						   gesture, an availability window). */
						.hour { border-top: var(--border); grid-column: 1 / -1; z-index: 1; pointer-events: none; }

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
			this.applyScrollRange()
		}
	}

	/** Set on the connection layers, its only readers: set on the host, every element of the week inherited it, and a zoom changes it every frame. */
	private applyScrollRange() {
		for (const layer of this.querySelectorAll<HTMLElement>('mitra-entry-connections')) {
			layer.style.setProperty('--mitra-days-scroll-range', `${this.lastScrollRange}px`)
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
		const runs = this.segments.runsIn(first, last, occurrence => occurrence.allDay)
		const slots = this.segments.allDaySlots
		const laneCount = runs.reduce((count, segment) => EntryStore.isPreview(segment.entry) ? count : Math.max(count, (slots.get(segment.occurrence) ?? -1) + 1), 0)
		const laneOf = (occurrence: EntryOccurrence) => Math.min(slots.get(occurrence) ?? laneCount, laneCount)
		this.allDayPlacements = runs
			.filter(segment => !EntryStore.isPreview(segment.entry))
			.map(segment => ({ lane: laneOf(segment.occurrence), start: segment.dayValue!, end: segment.runEnd.dayValue! }))
		this.style.setProperty('--_all-day-window-rows', `${laneCount + 1}`)
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
			rank: laneOf(segment.occurrence),
		}]))
		this.laneSegments = runs
		this.lanePlacement = new Map([...placements].map(([segment, placement]) =>
			[segment, { ...placement, rank: placement.rank - Days.laneRankFloor, frame: 'lane' as const }]))
		return html`
			<div class="all-day">
				${days.map((_, index) => html`<div class="day" style="grid-column: ${offset + index + 1};"></div>`)}
				${repeat(bars, bar => EntryStore.identityOf(bar.segment.occurrence), bar => html`
					<mitra-entry-segment
						style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.endColumn - bar.startColumn + 1}`, gridRow: `${laneOf(bar.segment.occurrence) + 1}` })}
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
		const currentTimeString = today.format({ timeStyle: 'short' })
		// A 12-hour clock names a whole hour alone ("4 PM"); a 24-hour one keeps its minutes, as its hour alone reads "16 Uhr".
		const hourStyle: Intl.DateTimeFormatOptions = new Intl.DateTimeFormat(Localizer.locales.current, { hour: 'numeric' }).resolvedOptions().hour12 ? { hour: 'numeric' } : { timeStyle: 'short' }
		const here = TimeZones.here
		// A zone a half or three quarters of an hour off here (India, Nepal) lands between hours, so it keeps its minutes.
		const styleIn = (zone: TimeZone): Intl.DateTimeFormatOptions => ({
			...(zone.offsetAt(reference) - here.offsetAt(reference)) % 60 === 0 ? hourStyle : { timeStyle: 'short' },
			timeZone: zone.id,
		})
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
						const timeText = (i === 0 || isCloseToNow) ? '' : reference.with({ hour: i, minute: 0, second: 0, millisecond: 0 }).format(!zone ? hourStyle : styleIn(zone.zone))
						return html`
							<div class="hour" style="--_at: ${i * 60}; grid-column: ${column + 2};" ?data-foreign=${!!zone}>
								${timeText}
							</div>
						`
					}))}
					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="--_at: ${currentMinute};">${currentTimeString}</div>
					`}
				</div>

				<div class="overlays">
					${Array.from({ length: reference.hoursInDay }).map((_, i) => {
						if (i === 0) return html.nothing
						return html`<div class="hour" style="--_at: ${i * 60};"></div>`
					})}

					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="--_at: ${currentMinute};">
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
					.availability=${Availability.on(this.occurrences, day)}
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
