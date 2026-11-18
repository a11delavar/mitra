import { Component, component, css, event, html, property, query, state } from '@a11d/lit'
import { ResizeController } from '@3mo/resize-observer'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { DissolveRoutine, MergeRoutines, RenameRoutine, TrackRoutine } from '#operations'
import { centered, devicePixel, type Popover } from '#design'
import '#features/calendar/client/DateTime.calendar.js'
import { EntryStatus, EntryType } from '#features/entries'
import { reportSaveError } from '#features/entries/client/EntryStore.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { entryColors } from '#features/entries/client/entryColors.css.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { type Routine } from '../Routine.js'
import { RoutineEntryOccurrenceStatus } from '../RoutineEntryOccurrenceStatus.js'
import { RoutineStore } from './RoutineStore.js'
import { cellStep } from './cellStep.css.js'
import { DialogDissolveRoutine } from './DialogDissolveRoutine.js'

/** Which status a day of the year grid shows when several dates fall on it: the one that asks most of the reader. */
const precedence: ReadonlyArray<RoutineEntryOccurrenceStatus> = [
	RoutineEntryOccurrenceStatus.Missed, RoutineEntryOccurrenceStatus.Cancelled, RoutineEntryOccurrenceStatus.Open,
	RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Upcoming,
]

/** An ISO day as the start of that day here. */
const dayOf = (day: string) => new DateTime(TimeZone.device.midnightOf(Temporal.PlainDate.from(day)).getTime())

/**
 * A routine's detail, beside its row or as a sheet on a phone: how often it comes and since when, its recent occurrences
 * as a grid of days, and, while it is tracked, its streak and how it goes, how often it was kept in the past year and where
 * it slips; and what today's can still become.
 */
@component('mitra-routine-details')
export class RoutineDetails extends Component {
	@event() readonly close!: EventDispatcher

	@property({ type: Object }) routine?: Routine

	@query('mitra-popover') private readonly popoverElement?: Popover
	@query('.name') private readonly nameInput?: HTMLInputElement

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

	/** The other routines of its calendar, which it can merge into. */
	private get others() {
		return [...RoutineStore.routines.values()].filter(routine => routine.sourceId === this.routine?.sourceId && routine.id !== this.routine.id)
	}

	private readonly handleRename = async () => {
		const name = this.nameInput?.value.trim() ?? ''
		if (name === this.routine?.label) {
			return
		}
		await this.rename(name || null)
	}

	private async rename(name: string | null) {
		await RenameRoutine.call({ id: this.routine!.id, name }).catch(reportSaveError)
		await RoutineStore.refresh()
	}

	private readonly startRename = () => {
		requestAnimationFrame(() => this.nameInput?.select())
	}

	private async mergeInto(into: Routine) {
		this.hide()
		await MergeRoutines.call({ id: this.routine!.id, into: into.id }).catch(reportSaveError)
		await RoutineStore.refresh()
	}

	/** Tracks how it goes, or stops for a routine that is only a schedule; the menu stays open on its checkbox. */
	private readonly handleTrack = async () => {
		await TrackRoutine.call({ id: this.routine!.id, tracked: !this.routine!.tracked }).catch(reportSaveError)
		await RoutineStore.refresh()
	}

	// Ctrl or ⌘ skips the question, as it skips the scope one for a recurring entry.
	private readonly handleDissolve = async (e: MouseEvent) => {
		const routine = this.routine!
		if (!(e.ctrlKey || e.metaKey) && !await new DialogDissolveRoutine({ name: routine.label }).confirm().catch(() => false)) {
			return
		}
		this.hide()
		await DissolveRoutine.call({ id: routine.id }).catch(reportSaveError)
		await RoutineStore.refresh()
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

			/* Tinted by its calendar's colour, its selection too, as an entry's editor is (entryColors). */
			mitra-routine-details {
				${entryColors};
				display: contents;
				cursor: default;

				& ::selection {
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 40%, transparent);
				}
			}

			/* Always beside its row where it fits: from the row's top down, else up from its bottom (a row low in the list),
			   else centred on it; only where no side has room, in the middle of the viewport. It hangs from the row's named
			   anchor rather than the one show() gives, which hiding takes away while it fades out. */
			@position-try --mitra-routine-details-beside {
				position-area: inline-end span-all;
				align-self: anchor-center;
			}

			mitra-routine-details > mitra-popover:not([data-sheet]) {
				inline-size: 25rem;
				max-inline-size: calc(100dvw - 1.5rem);
				max-block-size: 85dvh;
				overflow-y: auto;
				margin: 0 0.5rem;
				position-anchor: --mitra-routine-details;
				position-area: inline-end span-block-end;
				position-try-fallbacks: flip-block, --mitra-routine-details-beside, flip-inline, flip-block flip-inline, --centered;
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

					/* The calendar's name takes the room between, so the menu and closing sit at the end. */
					> .calendar {
						flex: 1;
					}
				}

				/* The name, an editor's field (editorFields.css.ts) as an entry's title is, and beside a name of the person's own
				   the way back to its entries' titles. */
				> .title {
					display: flex;
					align-items: center;
					gap: 0.25rem;
					margin-block: 0.25rem 0.5rem;
				}

				> .title > .name {
					flex: 1;
					min-inline-size: 0;
					/* Overhangs at the start by its padding, so its words line up with the rows'. */
					margin-inline-start: calc(-1 * var(--field-padding-inline));
					font-size: 1.1rem;
					font-weight: 600;
					color: var(--color-text);
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

					/* A month's name keeps to its own weeks, so a long one ("Tháng 4") wraps rather than run into the next. */
					> .months > span {
						align-self: end;
						padding-inline-end: var(--gap);
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

				/* The tiles take what their words need; the streak's takes the rest, room for its flame. They wrap where even
				   that is too wide, as in a phone's sheet. */
				> .stats {
					display: flex;
					flex-wrap: wrap;
					gap: 0.5rem;
					margin-block: 0.5rem 0.25rem;

					> div {
						flex: none;
						display: flex;
						flex-direction: column;
						padding: 0.5rem 0.6rem;
						border-radius: var(--border-radius);
						background: color-mix(in srgb, var(--color-text) 5%, transparent);

						/* The text's own colour, see-through, so a tinted tile shows through it as a grey would not. */
						> .label, > .sub {
							font-size: 0.7rem;
							color: color-mix(in srgb, var(--color-text) 62%, transparent);
						}

						> .value {
							font-size: 1rem;
							font-weight: 600;
						}
					}

					/* The streak, first and in its calendar's colour: the word its label, the count its value, and a large flame
					   behind them at its end, cut by its edges. Grey once it ended. */
					> .streak {
						flex: 1 1 8rem;
						position: relative;
						overflow: clip;
						isolation: isolate;
						background: color-mix(in srgb, var(--mitra-entry-segment-color) 14%, transparent);

						> mitra-icon {
							position: absolute;
							z-index: -1;
							inset-inline-end: -0.9rem;
							inset-block-end: -0.9rem;
							font-size: 4.5rem;
							color: color-mix(in srgb, var(--mitra-entry-segment-color) 45%, transparent);
							--mitra-icon-fill: color-mix(in srgb, var(--mitra-entry-segment-color) 18%, transparent);
							--mitra-icon-stroke-width: 1.5;
						}

						&[data-out] {
							background: color-mix(in srgb, var(--color-text) 5%, transparent);

							> mitra-icon {
								color: color-mix(in srgb, var(--color-text-muted) 45%, transparent);
								--mitra-icon-fill: none;
							}
						}
					}
				}
			}

			/* One date: solid kept, hollow missed, a dash cancelled, ringed while today's is open, faint where there is none.
			   Square and never smaller than 8px, so it reads as a cell rather than a smudge. */
			.routine-cell {
				display: block;
				aspect-ratio: 1;
				/* Radius and ring in whole screen pixels too, or their edges fall between pixels and soften. */
				--ring: round(1.5px, ${devicePixel});
				border-radius: round(2px, ${devicePixel});
				background: var(--mitra-entry-segment-color);

				&[data-state=missed] {
					background: none;
					box-shadow: inset 0 0 0 var(--ring) color-mix(in srgb, var(--mitra-entry-segment-color) 70%, transparent);
				}

				&[data-state=cancelled] {
					position: relative;
					background: none;

					&::after {
						content: '';
						position: absolute;
						inset: 40% 15%;
						border-radius: 1px;
						background: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, transparent);
					}
				}

				&[data-state=open] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, transparent);
					box-shadow: inset 0 0 0 var(--ring) var(--mitra-entry-segment-color);
				}

				&[data-state=upcoming] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 12%, transparent);
				}

				&[data-state=none] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 10%, transparent);
				}

				&[data-state=future] {
					visibility: hidden;
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
		const statusOn = (day: Temporal.PlainDate) => precedence.find(status => byDay.get(day.toString())?.some(date => dates.statusOf(date) === status))
		const stateOf = (day: Temporal.PlainDate) => Temporal.PlainDate.compare(day, today) > 0 ? 'future' : String(statusOn(day) ?? 'none')
		// Its date, and what became of it where it had one.
		const titleOf = (day: Temporal.PlainDate) => [dayOf(day.toString()).format({ dateStyle: 'medium' }), statusOn(day)?.format()].filter(Boolean).join(' · ')
		const weekday = (index: number) => dayOf(first.add({ days: index }).toString()).format({ weekday: 'short' })
		// The grid column of the week a day falls in.
		const column = (day: Temporal.PlainDate) => Math.floor(first.until(day).days / 7) + 1
		return html`
			<div class="year" style="--weeks: ${days.length / 7}">
				<span class="months">
					${days.filter(day => day.day === 1).map((day, index, months) => html`
						<span style="grid-column: ${column(day)} / ${months[index + 1] ? column(months[index + 1]!) : -1}">${dayOf(day.toString()).format({ month: 'short' })}</span>
					`)}
				</span>
				<span class="weekdays">${[0, 1, 2, 3, 4, 5, 6].map(index => html`<span>${index % 2 ? '' : weekday(index)}</span>`)}</span>
				<span class="cells">
					${days.map(day => html`<i class="routine-cell" data-state=${stateOf(day)} title=${titleOf(day)}></i>`)}
				</span>
			</div>
		`
	}

	/** The day an ended routine last came, which closes its span. */
	private get ended() {
		const last = RoutineStore.ended(this.routine!) ? RoutineStore.datesOf(this.routine!)?.last(1)[0] : undefined
		const at = last?.start ?? last?.due
		return at ? new DateTime(at.valueOf()) : undefined
	}

	/** The streak's tile: how it goes in a word, how many dates in a row, since when and the best, a flame behind. */
	private get streakTemplate() {
		const dates = RoutineStore.datesOf(this.routine!)!
		const { streaks } = dates
		const streak = streaks.at(-1)
		if (!streak) {
			return html.nothing
		}
		const best = Math.max(...streaks.map(({ length }) => length))
		const since = streak.since?.dayIn(TimeZone.localOrDefault)
		const until = this.ended
		return html`
			<div class="streak" ?data-out=${streak.out}>
				<mitra-icon icon=${until ? 'flag' : 'flame'}></mitra-icon>
				<span class="label">${until ? t('Ended') : !dates.next ? t('Nothing ahead') : dates.standing.format()}</span>
				<span class="value">${streak.out || !since ? t('Ended') : t('${count:number} in a row', { count: streak.length })}</span>
				<span class="sub">
					${streak.out || !since ? t('best ${count:number} in a row', { count: best }) : html`
						${until
							? new DateTimeRange(dayOf(since.toString()), until).format({ month: 'short', day: 'numeric' })
							: t('since ${date}', { date: dayOf(since.toString()).format({ month: 'short', day: 'numeric' }) })}<br>
						${t('best ${count:number}', { count: best })}
					`}
				</span>
			</div>
		`
	}

	/** The streak, how it went over the past year, and where it slips. */
	private get statsTemplate() {
		const routine = this.routine!
		const dates = RoutineStore.datesOf(routine)!
		const yearAgo = TimeZone.localOrDefault.dayOf(new Date()).subtract({ years: 1 })
		const settled = dates.last(Infinity).filter(date => dates.statusOf(date)?.settled && Temporal.PlainDate.compare(date.dayIn(TimeZone.localOrDefault)!, yearAgo) > 0)
		const kept = settled.filter(date => dates.statusOf(date) === RoutineEntryOccurrenceStatus.Kept).length
		const slips = dates.slipsAfter(yearAgo)
		return html`
			<div class="stats">
				${this.streakTemplate}
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
		const done = RoutineStore.ticks(routine) && !!today && dates.statusOf(today) === RoutineEntryOccurrenceStatus.Open
		const cancel = !!today && RoutineStore.cancels(routine) && !!RoutineStore.occurrenceOf(today)
		const show = !!today || !!dates.next
		return html`
			<mitra-popover sheet @openChange=${this.handleOpenChange}>
				<div class="routine-detail">
					<header>
						<span class="dot"></span>
						<span class="calendar">${source?.name}</span>
						<mitra-popover-container>
							<mitra-icon-button label=${t('Options')} icon="more-horizontal"></mitra-icon-button>
							<mitra-menu slot="popover">
								${!done ? html.nothing : html`
									<mitra-menu-item icon="check" @click=${this.handleDone}>${t('Done today')}</mitra-menu-item>
								`}
								${!cancel ? html.nothing : html`
									<mitra-menu-item icon=${EntryStatus.Cancelled.iconFor(task ? EntryType.Task : EntryType.Event)} @click=${this.handleCancel}>${t('Cancelled')}</mitra-menu-item>
								`}
								${!show ? html.nothing : html`
									<mitra-menu-item icon="calendar-search" @click=${this.handleShow}>${t('Show in calendar')}</mitra-menu-item>
								`}
								${!done && !cancel && !show ? html.nothing : html`<hr>`}
								<mitra-menu-item icon="pencil" @click=${this.startRename}>${t('Rename…')}</mitra-menu-item>
								${!this.others.length ? html.nothing : html`
									<mitra-menu-item icon="merge">
										${t('Merge into')}
										<mitra-menu slot="submenu">
											${this.others.map(other => html`<mitra-menu-item @click=${() => this.mergeInto(other)}>${other.label}</mitra-menu-item>`)}
										</mitra-menu>
									</mitra-menu-item>
								`}
								<hr>
								<mitra-menu-item type="checkbox" ?selected=${routine.tracked} @click=${this.handleTrack}>${t('Track how it goes')}</mitra-menu-item>
								<mitra-menu-item icon="circle-off" @click=${this.handleDissolve}>${t('Not a routine')}</mitra-menu-item>
							</mitra-menu>
						</mitra-popover-container>
						<mitra-icon-button icon="x" label=${t('Close')} @click=${() => this.hide()}></mitra-icon-button>
					</header>
					<div class="title">
						<input class="name field" aria-label=${t('Name')} .value=${routine.label} @change=${this.handleRename}
							@keydown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}>
						${!routine.name ? html.nothing : html`
							<mitra-icon-button icon="undo-2" label=${t('Name after its entries')} title=${routine.titled} @click=${() => this.rename(null)}></mitra-icon-button>
						`}
					</div>
					<div class="row">
						<mitra-icon icon="repeat"></mitra-icon>
						<span>${[routine.frequency(RoutineStore.ruleOf(routine), dates.next?.start), time].filter(Boolean).join(' · ')}</span>
					</div>
					${!routine.since ? html.nothing : html`
						<div class="row">
							<mitra-icon icon="calendar-days"></mitra-icon>
							<span>${this.ended
								? new DateTimeRange(dayOf(routine.since), this.ended).format({ dateStyle: 'long' })
								: t('Since ${date}', { date: dayOf(routine.since).format({ dateStyle: 'long' }) })}</span>
						</div>
					`}
					${this.yearTemplate}
					${!routine.tracked ? html.nothing : this.statsTemplate}
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
