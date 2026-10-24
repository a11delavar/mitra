import { Component, component, css, event, html, property, state, type PropertyValues } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Selectability, SelectabilityController, SelectabilityStrategy } from '@3mo/selectability'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { selected } from './selected.css.js'
import { disabled } from './disabled.css.js'
import './IconButton.js'

/**
 * A month of days to pick one from, in the language's calendar and with its first day of the week. The arrows
 * move by a day, up and down by a week, Page Up and Page Down by a month, Home and End to the week's ends.
 *
 * With `months` it shows that many months in a row, wrapping where there is no room, with one cursor across them: the
 * keys move by date, from one grid into the next, and the months shown move on only once the cursor leaves them.
 *
 * With `multiple` it chooses several: a press, Space or Enter adds or removes a day, and Shift with a press or an
 * arrow extends a run from the last day pressed.
 */
@component('mitra-date-picker')
export class DatePicker extends Component {
	@event() readonly pick!: EventDispatcher<DateTime>
	@event() readonly change!: EventDispatcher<ReadonlyArray<DateTime>>

	/** The day picked, or with `multiple` the days chosen, each the start of its day in the picker's zone. */
	@property({ type: Object }) value?: DateTime | ReadonlyArray<DateTime>

	/** Where the picker stands until it is moved: a field's own, which counts the days in its zone. Else the value, else today. */
	@property({ type: Object }) navigationDate?: DateTime

	@property({ type: Boolean }) multiple = false

	/** How many months show at once, each in a grid of its own. */
	@property({ type: Number }) months = 1

	/** The days that can't be picked, drawn as disabled. */
	@property({ attribute: false }) isDisabled?: (day: DateTime) => boolean

	/** The day the keyboard stands on, which the months shown always hold. */
	@state() private cursor = new DateTime().dayStart

	/** The first month shown. */
	@state() private view = this.cursor.monthStart

	private readonly selectability = DatePicker.selectabilityOf(this)

	private static selectabilityOf(picker: DatePicker) {
		return new SelectabilityController<DateTime>(picker, {
			get selectability() { return picker.multiple ? Selectability.Multiple : undefined },
			get items() { return picker.reach },
			key: day => day.valueOf(),
			isSelectable: day => !picker.isDisabled?.(day),
			get selection() { return picker.chosen },
			handleChange: ({ selection }) => {
				picker.value = selection
				picker.change.dispatch(selection)
			},
			strategy: SelectabilityStrategy.Toggle,
			// The template states the selection, as it does the single mode's.
			stamping: false,
		})
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		// Choosing days is no navigation: only a single value, a field's, moves the picker to it.
		if (changed.has('navigationDate') || (changed.has('value') && !this.multiple)) {
			this.cursor = (this.navigationDate ?? this.chosen[0] ?? new DateTime()).dayStart
			this.view = this.cursor.monthStart
		}
	}

	/** The value as days: none, the one picked, or those chosen. */
	private get chosen() {
		return this.value instanceof DateTime ? [this.value] : this.value ?? []
	}

	/** The months shown as they are while they hold `day`, else moved just far enough to. */
	private viewHolding(day: DateTime) {
		return day.isBefore(this.view) ? day.monthStart
			: !day.isBefore(this.view.add({ months: this.months })) ? day.monthStart.subtract({ months: this.months - 1 }).monthStart
				: this.view
	}

	/** The arrows beside the titles: the months shown and the cursor with them, so that it stays in view. */
	private page(months: number) {
		this.view = this.view.add({ months }).monthStart
		this.cursor = this.cursor.add({ months }).dayStart
	}

	/** Puts the focus on the cursor's day, for a picker the keyboard opened. */
	override focus() {
		void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('[tabindex="0"]')?.focus())
	}

	private get shownMonths() {
		return Array.from({ length: this.months }, (_, index) => this.view.add({ months: index }).monthStart)
	}

	private weeksOf(month: DateTime) {
		const first = month.weekStart
		const last = month.monthEnd
		const weeks = new Array<Array<DateTime>>()
		for (let day = first; !day.isAfter(last); day = day.add({ days: 7 })) {
			weeks.push(Array.from({ length: day.daysInWeek }, (_, index) => day.add({ days: index }).dayStart))
		}
		return weeks
	}

	/** The days a run can cover: the months shown, and on to where it starts once paging has left that behind. Read on a press only. */
	private get reach() {
		const anchor = this.selectability.anchor?.item
		const months = this.shownMonths
		const first = anchor?.isBefore(months[0]!) ? anchor : months[0]!
		const last = anchor?.isAfter(months.at(-1)!.monthEnd) ? anchor : months.at(-1)!.monthEnd.dayStart
		const days = new Array<DateTime>()
		for (let day = first; !day.isAfter(last); day = day.add({ days: 1 }).dayStart) {
			days.push(day)
		}
		return days
	}

	private isSelected(day: DateTime) {
		return this.multiple ? this.selectability.isSelected(day) : this.chosen.some(chosen => day.equals(chosen.dayStart))
	}

	private move(to: DateTime, e: KeyboardEvent) {
		this.cursor = to.dayStart
		this.view = this.viewHolding(this.cursor)
		this.selectability.follow(this.cursor, e)
		this.focus()
	}

	/** Select-all means the months shown, or none of them while all of them are chosen. */
	private toggleShown() {
		const shown = this.shownMonths.flatMap(month => this.weeksOf(month).flat().filter(day => day.month === month.month && !this.isDisabled?.(day)))
		const all = shown.every(day => this.selectability.isSelected(day))
		this.selectability.selection = all
			? this.chosen.filter(day => !shown.some(other => other.equals(day)))
			: [...this.chosen, ...shown]
	}

	private readonly handleKeyDown = (e: KeyboardEvent) => {
		// The keys the controller answers by selecting every day in play, which here would be days nobody sees.
		if (this.multiple && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			e.preventDefault()
			e.stopPropagation()
			this.toggleShown()
			return
		}
		const rtl = this.matches(':dir(rtl)')
		const steps: Record<string, () => DateTime> = {
			ArrowLeft: () => this.cursor.add({ days: rtl ? 1 : -1 }),
			ArrowRight: () => this.cursor.add({ days: rtl ? -1 : 1 }),
			ArrowUp: () => this.cursor.subtract({ days: 7 }),
			ArrowDown: () => this.cursor.add({ days: 7 }),
			PageUp: () => this.cursor.subtract({ months: 1 }),
			PageDown: () => this.cursor.add({ months: 1 }),
			Home: () => this.cursor.weekStart,
			End: () => this.cursor.weekStart.add({ days: this.cursor.daysInWeek - 1 }),
		}
		const step = steps[e.key]
		if (step) {
			e.preventDefault()
			this.move(step(), e)
		}
	}

	private press(day: DateTime) {
		this.cursor = day
		if (!this.multiple && !this.isDisabled?.(day)) {
			this.pick.dispatch(day)
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				gap: 0.75rem 1.5rem;
				font-size: 0.8125rem;
				color: var(--color-text);
				/* A Shift-press extends a run of days, which would otherwise also select the text between. */
				user-select: none;
			}

			.month {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}

			/* The title stays centred over its grid, whichever of the arrows a month carries. */
			header {
				display: grid;
				grid-template-columns: 1fr auto 1fr;
				align-items: center;
				gap: 0.25rem;

				> span {
					grid-column: 2;
					font-weight: 600;
				}

				> .previous {
					grid-column: 1;
					justify-self: start;
				}

				> .next {
					grid-column: 3;
					justify-self: end;
				}

				mitra-icon-button:dir(rtl)::part(icon) {
					scale: -1 1;
				}
			}

			/* Six weeks always, the most a month spans: a shorter one leaves rows empty, so paging never moves the arrows. */
			[role=grid] {
				display: grid;
				grid-template-columns: repeat(7, 2rem);
				grid-template-rows: 1.5rem repeat(6, 2rem);
				gap: 1px;
			}

			[role=row] {
				display: contents;
			}

			[role=columnheader] {
				display: grid;
				place-items: center;
				block-size: 1.5rem;
				font-size: 0.6875rem;
				font-weight: 600;
				color: var(--color-text-muted);
			}

			button {
				all: unset;
				box-sizing: border-box;
				display: grid;
				place-items: center;
				block-size: 2rem;
				border: 1px solid transparent;
				border-radius: var(--border-radius);
				font-variant-numeric: tabular-nums;
				cursor: pointer;

				&:hover {
					${activated};
				}

				&:focus-visible {
					${ring};
				}

				&[data-outside] {
					color: var(--color-text-muted);
				}

				&[aria-current=date] {
					font-weight: 700;
					color: var(--color-accent);
				}

				&[aria-selected=true] {
					${selected};
				}

				&[aria-disabled=true] {
					${disabled};

					&:hover {
						background: none;
					}
				}
			}
		`
	}

	protected override get template() {
		// The days are counted in the zone of the value given, today among them.
		const today = DateTime.from(Date.now(), undefined, this.cursor.timeZoneId).dayStart
		const months = this.shownMonths
		return html`${months.map((month, index) => this.monthTemplate(month, index, months.length, today))}`
	}

	private monthTemplate(month: DateTime, index: number, count: number, today: DateTime) {
		const weeks = this.weeksOf(month)
		const title = month.format({ month: 'long', year: 'numeric' })
		return html`
			<div class="month">
				<header>
					${index > 0 ? html.nothing : html`
						<mitra-icon-button class="previous" size="small" icon="chevron-left" label=${t('Previous month')} @click=${() => this.page(-1)}></mitra-icon-button>
					`}
					<span aria-live="polite">${title}</span>
					${index < count - 1 ? html.nothing : html`
						<mitra-icon-button class="next" size="small" icon="chevron-right" label=${t('Next month')} @click=${() => this.page(1)}></mitra-icon-button>
					`}
				</header>
				<div role="grid" aria-label=${title} aria-multiselectable=${this.multiple} @keydown=${this.handleKeyDown}>
					<div role="row">
						${weeks[0]!.map(day => html`<span role="columnheader" aria-label=${day.format({ weekday: 'long' })}>${day.format({ weekday: 'narrow' })}</span>`)}
					</div>
					<!-- The day's number alone: Chinese and Japanese write 日 after it, which crowds a grid of days. -->
					${weeks.map((week, row) => html`
						<div role="row">
							${week.map((day, column) => day.month !== month.month && count > 1
								// A neighbour's day belongs to the grid beside, or lies outside the months shown: one cell for each day.
								? html`<span role="gridcell"></span>`
								// A month spans at most six weeks, so each month's indices follow the one before.
								: this.dayTemplate(day, month, today, (index * 6 + row) * week.length + column))}
						</div>
					`)}
				</div>
			</div>
		`
	}

	private dayTemplate(day: DateTime, month: DateTime, today: DateTime, index: number) {
		return html`
			<button role="gridcell" tabindex=${day.equals(this.cursor) ? 0 : -1}
				${this.selectability.item({ index, data: day })}
				aria-selected=${this.isSelected(day)}
				aria-disabled=${!!this.isDisabled?.(day)}
				aria-current=${day.equals(today) ? 'date' : 'false'}
				aria-label=${day.format({ dateStyle: 'full' })}
				?data-outside=${day.month !== month.month}
				@click=${() => this.press(day)}
			>${day.formatToParts({ day: 'numeric' }).find(part => part.type === 'day')?.value}</button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-date-picker': DatePicker
	}
}
