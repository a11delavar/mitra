import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, ifDefined } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Entry, EntrySegment } from 'shared'
import { CalendarDatesController } from './CalendarDatesController.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly buffer = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.buffer.days }

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
		this.buffer.navigatingDate = this.navigatingDate
		this.buffer.scrollToDate(this.navigatingDate)
		const now = await this.nowElement
		now?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = this.navigatingDate
			this.buffer.scrollToDate(this.navigatingDate)
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

		if (centerDate && !centerDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = centerDate
		}
	}

	static override get styles() {
		return css`
			mitra-days {
				display: grid;
				grid-template-rows: auto minmax(var(--grid-min-height), 1fr);
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
					}

					& > .header {
						background-color: var(--color-background);
						border-bottom: var(--border);
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
						grid-row: 2;
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
						grid-row: 2;
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
			${this.dateTemplate}
		`
	}

	private get timeTemplate() {
		if (this.hideTime) {
			return html.nothing
		}

		const today = new DateTime()
		const reference = this.days[0] || today
		const todayIndex = this.days.findIndex(d => d.dayStart.equals(today.dayStart))
		const currentMinute = today.hour * 60 + today.minute
		const currentTimeString = today.format({ hour: '2-digit', minute: '2-digit', hour12: false })

		return html`
			<div class="time">
				<div class="timezone" title=${ifDefined(today.formatToParts({ timeZoneName: 'long' }).find(x => x.type === 'timeZoneName')?.value)}>
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
		const today = new DateTime()
		const allSegments = this.entries.flatMap(e => e.segments)
		const getEntriesForDay = (date: DateTime) => {
			const dayEvents = allSegments.filter(e => e.fallsOnDay(date))
			return dayEvents.length ? EntrySegment.cluster(dayEvents) : []
		}
		return html`
			${repeat(this.days, day => day.dayStart.toISOString(), (day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					style="grid-column: ${index + 2};"
					.date=${day}
					.entries=${getEntriesForDay(day)}
					?today=${day.dayStart.equals(today.dayStart)}
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
