import { Component, component, css, event, html, property, query, state } from '@a11d/lit'
import { ResizeController } from '@3mo/resize-observer'
import { DateTime } from '@3mo/date-time'
import { centered, devicePixel, type Popover } from '#design'
import '#features/calendar/client/DateTime.calendar.js'
import { EntryStatus, EntryType } from '#features/entries'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { type Routine } from '../Routine.js'
import { RoutineEntryOccurrenceStatus } from '../RoutineEntryOccurrenceStatus.js'
import { RoutineStore } from './RoutineStore.js'
import { cellStep } from './cellStep.css.js'

/** Which status a day of the year grid shows when several dates fall on it: the one that asks most of the reader. */
const precedence: ReadonlyArray<RoutineEntryOccurrenceStatus> = [
	RoutineEntryOccurrenceStatus.Missed, RoutineEntryOccurrenceStatus.Cancelled, RoutineEntryOccurrenceStatus.Open,
	RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Upcoming,
]

/** An ISO day as the start of that day here. */
const dayOf = (day: string) => new DateTime(TimeZone.device.midnightOf(Temporal.PlainDate.from(day)).getTime())

/**
 * A routine's detail, beside its row or as a sheet on a phone: how often it comes and since when, a year of its occurrences
 * as a grid of days, how often it was kept and where it slips, and what today's occurrence can still become.
 */
@component('mitra-routine-details')
export class RoutineDetails extends Component {
	@event() readonly close!: EventDispatcher

	@property({ type: Object }) routine?: Routine

	@query('mitra-popover') private readonly popoverElement?: Popover
	readonly routines = new RoutineStore(this)

	/** How many of the last weeks the grid draws: as many as fit its width, a year at most. */
	@state() private weeks = 53

	@query('.year') private readonly yearElement?: HTMLElement
	private readonly resize = new ResizeController(this, { target: null, callback: () => this.fit() })

	/** Draws as many of the last weeks as fit beside the weekdays, at a cell's step. */
	private fit() {
		const cells = this.yearElement?.querySelector('.cells')
		if (!this.yearElement || !cells) {
			return
		}
		const step = parseFloat(getComputedStyle(cells).gridTemplateColumns)
		const room = this.yearElement.getBoundingClientRect().right - cells.getBoundingClientRect().left
		// Unlaid out, as before the popover shows, the grid has no columns to measure.
		if (!(step > 0) || !(room > 0)) {
			return
		}
		this.weeks = Math.max(1, Math.min(53, Math.floor(room / step)))
	}

	protected override firstUpdated() {
		// Deferred a frame, so the click that opened it is not also the press outside that dismisses it.
		requestAnimationFrame(() => this.popoverElement?.show(this.closest<HTMLElement>('mitra-routine-row') ?? undefined))
	}

	/** The grid the resize controller watches: observing asks for another render, so only a new one is observed. */
	private observedYear?: HTMLElement

	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		if (this.yearElement && this.yearElement !== this.observedYear) {
			this.observedYear = this.yearElement
			this.resize.observe(this.yearElement)
		}
	}

	private readonly handleOpenChange = async (e: CustomEvent<boolean>) => {
		if (!e.detail) {
			await this.popoverElement?.settle()
			this.close.dispatch()
		}
	}

	private hide() {
		this.popoverElement?.hide()
	}

	private readonly handleDone = () => {
		this.hide()
		return RoutineStore.completeToday(this.routine!)
	}

	private readonly handleCancel = () => {
		this.hide()
		return RoutineStore.cancelToday(this.routine!)
	}

	private readonly handleShow = async () => {
		const routine = this.routine!
		const date = RoutineStore.todayOf(routine) ?? RoutineStore.datesOf(routine)?.next
		const start = date?.start ?? date?.due
		if (!date || !start) {
			return
		}
		this.hide()
		this.dispatchEvent(new CustomEvent('navigate', { detail: new DateTime(start.valueOf()), bubbles: true, composed: true }))
		await Calendars.show(routine.sourceId)
		EntryEditorIntent.requestOpen(date.key!)
	}

	static override get styles() {
		return css`
			${centered}

			mitra-routine-details {
				display: contents;
				cursor: default;
			}

			/* Beside its row, or where neither side has room, in the middle of the viewport. It hangs from the row's named
			   anchor rather than the one show() gives, which hiding takes away while it fades out. */
			mitra-routine-details > mitra-popover:not([data-sheet]) {
				inline-size: 25rem;
				max-inline-size: calc(100dvw - 1.5rem);
				max-block-size: 85dvh;
				overflow-y: auto;
				margin: 0 0.5rem;
				position-anchor: --mitra-routine-details;
				position-area: inline-end span-block-end;
				position-try-fallbacks: flip-inline, --centered;
			}

			mitra-routine-details .routine-detail {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				padding: 0.25rem 0.5rem 0.5rem;
				color: var(--color-text);
				font-size: 0.8125rem;

				> header {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					color: var(--color-text-muted);

					> .dot {
						inline-size: 0.75rem;
						block-size: 0.75rem;
						border-radius: 3px;
						background: var(--mitra-entry-segment-color);
					}

					> .kind {
						margin-inline-start: auto;
					}
				}

				> .name {
					margin: 0.25rem 0 0.5rem;
					font-size: 1.1rem;
					font-weight: 600;
				}

				> .row {
					display: flex;
					align-items: center;
					gap: 0.6rem;
					padding-block: 0.3rem;

					> mitra-icon {
						color: var(--color-text-muted);
					}

					> .end {
						margin-inline-start: auto;
						color: var(--color-text-muted);
					}
				}

				> hr {
					inline-size: 100%;
					margin: 0.25rem 0;
					border: 0;
					border-block-start: var(--border);
				}

				> .year {
					/* A week's column and a day's row are each a cell's step, the gap its own margin inside it. As many of
					   the last weeks as fit are drawn, never a cell smaller. */
					--gap: round(down, 2px, ${devicePixel});
					--labels: 1.75rem;
					--week: ${cellStep};
					display: grid;
					grid-template-columns: var(--labels) max-content;
					gap: 0.25rem 0.5rem;
					margin-block: 0.5rem 0.25rem;
					font-size: 0.625rem;
					color: var(--color-text-muted);

					> .months, > .cells {
						grid-column: 2;
						display: grid;
						grid-template-columns: repeat(var(--weeks), var(--week));
					}

					> .months > span {
						white-space: nowrap;
						overflow: visible;
					}

					> .weekdays {
						display: grid;
						grid-template-rows: repeat(7, var(--week));
						line-height: var(--week);
						white-space: nowrap;
					}

					> .cells {
						grid-template-rows: repeat(7, var(--week));
						grid-auto-flow: column;

						> .routine-cell {
							aspect-ratio: auto;
							margin: 0 var(--gap) var(--gap) 0;
						}
					}
				}

				> .stats {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
					gap: 0.5rem;
					margin-block: 0.5rem 0.25rem;

					> div {
						display: flex;
						flex-direction: column;
						padding: 0.5rem 0.6rem;
						border-radius: var(--border-radius);
						background: color-mix(in srgb, var(--color-text) 5%, transparent);

						> .label, > .sub {
							font-size: 0.7rem;
							color: var(--color-text-muted);
						}

						> .value {
							font-size: 1rem;
							font-weight: 600;
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	/** The days of the last `weeks` weeks, each from the locale's first weekday, through the end of this one. */
	private static daysOf(weeks: number) {
		const today = TimeZone.localOrDefault.dayOf(new Date())
		const first = Temporal.PlainDate.from(new DateTime().dayStart.weekStart.isoDate).subtract({ weeks: weeks - 1 })
		return { first, today, days: Array.from({ length: weeks * 7 }, (_, index) => first.add({ days: index })) }
	}

	private get yearTemplate() {
		const dates = RoutineStore.datesOf(this.routine!)
		if (!dates) {
			return html.nothing
		}
		const { first, today, days } = RoutineDetails.daysOf(this.weeks)
		const byDay = Map.groupBy(dates.last(Infinity), date => String(date.dayIn(TimeZone.localOrDefault)))
		const statusOf = (day: Temporal.PlainDate) => Temporal.PlainDate.compare(day, today) > 0 ? 'future'
			: String(precedence.find(status => byDay.get(day.toString())?.some(date => dates.statusOf(date) === status)) ?? 'none')
		const weekday = (index: number) => dayOf(first.add({ days: index }).toString()).format({ weekday: 'short' })
		return html`
			<div class="year" style="--weeks: ${days.length / 7}">
				<span class="months">
					${days.filter(day => day.day === 1).map(day => html`
						<span style="grid-column: ${Math.floor(first.until(day).days / 7) + 1}">${dayOf(day.toString()).format({ month: 'short' })}</span>
					`)}
				</span>
				<span class="weekdays">${[0, 1, 2, 3, 4, 5, 6].map(index => html`<span>${index % 2 ? '' : weekday(index)}</span>`)}</span>
				<span class="cells">
					${days.map(day => html`<i class="routine-cell" data-state=${statusOf(day)} title=${dayOf(day.toString()).format({ dateStyle: 'medium' })}></i>`)}
				</span>
			</div>
		`
	}

	private get statsTemplate() {
		const routine = this.routine!
		const dates = RoutineStore.datesOf(routine)!
		const { strip } = RoutineStore
		const yearAgo = TimeZone.localOrDefault.dayOf(new Date()).subtract({ years: 1 })
		const settled = dates.last(Infinity).filter(date => dates.statusOf(date)?.settled && Temporal.PlainDate.compare(date.dayIn(TimeZone.localOrDefault)!, yearAgo) > 0)
		const kept = settled.filter(date => dates.statusOf(date) === RoutineEntryOccurrenceStatus.Kept).length
		const slips = dates.slipsAfter(yearAgo)
		const today = RoutineStore.todayOf(routine)
		return html`
			<div class="stats">
				<div>
					<span class="label">${t('Last ${count:number}', { count: dates.last(strip).length })}</span>
					<span class="value">${t('${count:number} of ${total:number}', { count: dates.kept(strip), total: dates.settled(strip) })}</span>
					<span class="sub">${today && dates.statusOf(today) === RoutineEntryOccurrenceStatus.Open ? t('today still open') : t('kept')}</span>
				</div>
				${!settled.length ? html.nothing : html`
					<div>
						<span class="label">${t('Past year')}</span>
						<span class="value">${Math.round(kept / settled.length * 100).formatAsPercent()}</span>
						<span class="sub">${t('${count:number} of ${total:number} kept', { count: kept, total: settled.length })}</span>
					</div>
				`}
				${!slips ? html.nothing : html`
					<div>
						<span class="label">${t('Slips most on')}</span>
						<span class="value">${dayOf(Temporal.PlainDate.from('2026-01-05').add({ days: slips.weekday - 1 }).toString()).format({ weekday: 'long' })}</span>
						<span class="sub">${t('${count:number} of ${total:number}', { count: slips.count, total: slips.of })}</span>
					</div>
				`}
			</div>
		`
	}

	protected override get template() {
		const routine = this.routine
		const dates = routine && RoutineStore.datesOf(routine)
		if (!routine || !dates) {
			return html.nothing
		}
		const source = Calendars.getSource(routine.sourceId)
		const today = RoutineStore.todayOf(routine)
		const task = RoutineStore.isTask(routine)
		const time = RoutineStore.timeOf(routine)
		return html`
			<mitra-popover sheet @openChange=${this.handleOpenChange}>
				<div class="routine-detail">
					<header>
						<span class="dot"></span>
						<span>${source?.name}</span>
						<span class="kind">${task ? t('Task') : t('Event')}</span>
						<mitra-popover-container>
							<mitra-icon-button label=${t('Options')} icon="more-horizontal"></mitra-icon-button>
							<mitra-menu slot="popover">
								${!RoutineStore.ticks(routine) || !today || dates.statusOf(today) !== RoutineEntryOccurrenceStatus.Open ? html.nothing : html`
									<mitra-menu-item icon="check" @click=${this.handleDone}>${t('Done today')}</mitra-menu-item>
								`}
								${!today || !RoutineStore.cancels(routine) || !RoutineStore.occurrenceOf(today) ? html.nothing : html`
									<mitra-menu-item icon=${EntryStatus.Cancelled.iconFor(task ? EntryType.Task : EntryType.Event)} @click=${this.handleCancel}>${t('Cancelled')}</mitra-menu-item>
								`}
								${!today && !dates.next ? html.nothing : html`
									<mitra-menu-item icon="calendar-search" @click=${this.handleShow}>${t('Show in calendar')}</mitra-menu-item>
								`}
							</mitra-menu>
						</mitra-popover-container>
						<mitra-icon-button icon="x" label=${t('Close')} @click=${() => this.hide()}></mitra-icon-button>
					</header>
					<span class="name">${routine.label}</span>
					<div class="row">
						<mitra-icon icon="repeat"></mitra-icon>
						<span>${[routine.frequency(RoutineStore.ruleOf(routine), dates.next?.start), time].filter(Boolean).join(' · ')}</span>
					</div>
					${!routine.since ? html.nothing : html`
						<div class="row">
							<mitra-icon icon="calendar-days"></mitra-icon>
							<span>${t('Since ${date}', { date: dayOf(routine.since).format({ dateStyle: 'long' }) })}</span>
						</div>
					`}
					<hr>
					${this.yearTemplate}
					${this.statsTemplate}
				</div>
			</mitra-popover>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routine-details': RoutineDetails
	}
}
