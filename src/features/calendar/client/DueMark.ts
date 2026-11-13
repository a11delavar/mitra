import { Component, component, css, eventListener, html, keyed, property, state, styleMap, type StyleInfo } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import type { EntryOccurrence } from '#features/recurrence'
import { type EntrySegmentComponent } from '#features/entries/client/EventSegment.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'

/**
 * The way from the task under the pointer, else the one open, to its due date: a tint that grows out of the task and runs
 * to the due, and on the hours a line at the due time. The view hands itself in and draws the pieces in its own layer
 * (`draw`), placing them in its stylesheet; the mark gives them their look. One task at a time, so a day many tasks are
 * owed on never stacks.
 */
@component('mitra-due-mark')
export class DueMark extends Component {
	readonly store = new EntryStore(this)

	/** The view whose chips the mark follows, which hands itself in. */
	@property({ type: Object }) view?: HTMLElement

	/** The pieces this layer of the view shows for a task with a due date, as `.gap`s (each with its `--_step`) and a `.line`. */
	@property({ attribute: false }) draw?: (occurrence: EntryOccurrence) => unknown

	/** The chip pointed at last, not its segment: a chip is handed a new segment when its entry changes, and the mark follows it. */
	@state() private pointed?: EntrySegmentComponent

	/** Whether a press is under way: it captures the pointer, which the browser then reports over the capturing element. */
	private pressed = false

	@eventListener({ type: 'pointerdown', target(this: DueMark) { return this.view ?? [] } })
	@eventListener({ type: 'pointerup', target: window, options: { capture: true } })
	@eventListener({ type: 'pointercancel', target: window, options: { capture: true } })
	handlePress(e: PointerEvent) {
		return this.pressed = e.type === 'pointerdown'
	}

	@eventListener({ type: 'pointerover', target(this: DueMark) { return this.view ?? [] } })
	@eventListener({ type: 'pointerleave', target(this: DueMark) { return this.view ?? [] } })
	/** The chip pressed stays the one pointed at. The editor lies within its chip but is not the chip, so closing it lets go. */
	handlePointer(e: PointerEvent) {
		if (!this.pressed) {
			const target = e.type === 'pointerover' ? e.target as Element : undefined
			this.pointed = target?.closest('mitra-entry-details') ? undefined : target?.closest('mitra-entry-segment') ?? undefined
		}
	}

	/**
	 * The open task's chip, which holds the mark while the pointer passes other chips on its way to the editor, else the one
	 * pointed at. Read as the mark renders, which an editor opening or closing makes it do.
	 */
	private get chip() {
		// Its `selected` before the attribute, which the chip reflects a moment later.
		const open = this.view?.querySelector<EntrySegmentComponent>('mitra-entry-segment[selected]')
		return open?.selected ? open : this.pointed
	}

	/** Which of `days` the way `gap` reaches into. */
	static daysIn({ start, end }: DateTimeRange, days: ReadonlyArray<DateTime>) {
		return days.filter(day => day.dayStart.isBefore(end!) && day.dayStart.add({ days: 1 }).isAfter(start!))
	}

	/**
	 * A piece of the way that runs across columns, along a `row` (the all-day lane, a timeline row) or, without one, over the
	 * whole height (a month's days), with the flag where it is due.
	 */
	static across({ row, columns: [first, last], step = 0, flag = false, style = {} }: {
		readonly row?: number
		readonly columns: readonly [first: number, last: number]
		readonly step?: number
		readonly flag?: boolean
		readonly style?: StyleInfo
	}) {
		return html`
			<div class="gap" data-across ?data-due=${flag} style=${styleMap({
				gridRow: row === undefined ? '1 / -1' : `${row + 1}`,
				gridColumn: `${first + 1} / span ${last - first + 1}`,
				'--_step': `${step}`,
				...style,
			})}>
				${!flag ? html.nothing : html`<mitra-icon icon="flag" fill></mitra-icon>`}
			</div>
		`
	}

	/** The way along one `row` of `days`, from the first day it reaches to the last, the flag at its due end: for a due without a time. */
	static along(occurrence: EntryOccurrence, row: number, days: ReadonlyArray<DateTime>, columnOf: (day: DateTime) => number | undefined) {
		const gap = occurrence.dueGap
		const reached = !gap ? [] : DueMark.daysIn(gap, days)
		const first = reached[0] && columnOf(reached[0])
		const last = reached.at(-1) && columnOf(reached.at(-1)!)
		return first === undefined || last === undefined ? html.nothing : DueMark.across({ row, columns: [first, last], flag: true })
	}

	/**
	 * The way on the hours of `days`: a piece in each day it crosses, cut to the minutes it covers there and growing away from
	 * the task, then the line at the due time.
	 */
	static down(occurrence: EntryOccurrence, days: ReadonlyArray<DateTime>, columnOf: (day: DateTime) => number | undefined) {
		const gap = occurrence.dueGap
		const crossed = !gap ? [] : DueMark.daysIn(gap, days)
		const minuteOf = (date: DateTime) => date.hour * 60 + date.minute
		const due = occurrence.due!
		const dueColumn = columnOf(due)
		return html`
			${crossed.map((day, index) => html`
				<div class="gap" style=${styleMap({
					gridColumn: `${columnOf(day)! + 1}`,
					'--_from': `${gap!.start!.isAfter(day.dayStart) ? minuteOf(gap!.start!) : 0}`,
					'--_to': `${gap!.end!.isBefore(day.dayStart.add({ days: 1 })) ? minuteOf(gap!.end!) : 1440}`,
					// Away from the task: forwards to a due ahead, backwards to one it missed.
					'--_step': `${occurrence.scheduledPastDue ? crossed.length - 1 - index : index}`,
				})}></div>
			`)}
			${dueColumn === undefined ? html.nothing : html`
				<div class="line" style=${styleMap({ gridColumn: `${dueColumn + 1}`, '--_at': `${minuteOf(due)}`, '--_step': `${crossed.length}` })}>
					<mitra-icon icon="flag" fill></mitra-icon>
				</div>
			`}
		`
	}

	static override get styles() {
		return css`
			mitra-due-mark {
				display: contents;
				--_tint: var(--_color);
				/* One edge for the outline and the due line that closes it, so the two read as one shape. */
				--_edge: 1px dashed color-mix(in srgb, var(--_tint) 75%, transparent);

				&[data-late] { --_tint: var(--color-error); }

				/*
				 * An outline beneath the chips, growing out of the task one piece after another (back to the due once it has
				 * passed). It is open towards the task, so the two read as one, and closed only where it is due.
				 */
				> .gap {
					position: relative;
					z-index: 1;
					pointer-events: none;
					box-sizing: border-box;
					display: flex;
					align-items: center;
					justify-content: flex-end;
					color: var(--_tint);
					transform-origin: top;
					animation: due-gap-down 0.22s ease-out calc(var(--_step, 0) * 0.12s) both;

					/* On the hours, rails down either side: the due line closes them. */
					&:not([data-across]) {
						border-inline: var(--_edge);
					}

					/* Along a row, rails above and below, closed at the due end. */
					&[data-across] {
						border-block: var(--_edge);
						transform-origin: left;
						animation-name: due-gap-across;
						&:dir(rtl) { transform-origin: right; }

						&[data-due] {
							border-inline-end: var(--_edge);
							border-start-end-radius: var(--border-radius);
							border-end-end-radius: var(--border-radius);
						}
					}

					> mitra-icon {
						font-size: 0.75rem;
						margin-inline: 0.125rem;
					}
				}

				&[data-late] > .gap {
					justify-content: flex-start;
					transform-origin: bottom;

					&[data-across] {
						transform-origin: right;
						&:dir(rtl) { transform-origin: left; }

						&[data-due] {
							border-inline-end: none;
							border-inline-start: var(--_edge);
							border-radius: 0;
							border-start-start-radius: var(--border-radius);
							border-end-start-radius: var(--border-radius);
						}
					}
				}

				> .line {
					position: relative;
					z-index: 10;
					pointer-events: none;
					border-block-start: var(--_edge);
					color: var(--_tint);
					animation: due-line-in 0.15s ease-out calc(var(--_step, 0) * 0.12s) both;

					> mitra-icon {
						position: absolute;
						inset-block-end: 0.125rem;
						inset-inline-start: 0.125rem;
						font-size: 0.75rem;
					}
				}

				@media (prefers-reduced-motion: reduce) {
					> :is(.gap, .line) { animation: none; }
				}
			}

			@keyframes due-gap-down { from { transform: scaleY(0); } }
			@keyframes due-gap-across { from { transform: scaleX(0); } }
			@keyframes due-line-in { from { opacity: 0; } }
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const { chip } = this
		const occurrence = chip?.isConnected ? chip.segment?.occurrence : undefined
		if (!occurrence?.due || !this.draw) {
			return html.nothing
		}
		this.style.setProperty('--_color', String(occurrence.entry.effectiveColor ?? ''))
		this.toggleAttribute('data-late', occurrence.scheduledPastDue)
		// New pieces for every task, so the tint grows again from each one pointed at.
		return html`${keyed(EntryStore.identityOf(occurrence), this.draw(occurrence))}`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-due-mark': DueMark
	}
}
