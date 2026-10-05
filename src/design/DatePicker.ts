import { Component, component, css, event, html, property, state, type PropertyValues } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { selected } from './selected.css.js'
import './IconButton.js'

/**
 * A month of days to pick one from, in the language's calendar and with its first day of the week. The arrows
 * move by a day, up and down by a week, Page Up and Page Down by a month, Home and End to the week's ends.
 */
@component('mitra-date-picker')
export class DatePicker extends Component {
	@event() readonly pick!: EventDispatcher<DateTime>

	@property({ type: Object }) value?: DateTime

	/** The day the keyboard stands on, which also decides the month shown. */
	@state() private cursor = new DateTime().dayStart

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		if (changed.has('value')) {
			this.cursor = (this.value ?? new DateTime()).dayStart
		}
	}

	/** Puts the focus on the cursor's day, for a picker the keyboard opened. */
	override focus() {
		void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('[tabindex="0"]')?.focus())
	}

	private get weeks() {
		const first = this.cursor.monthStart.weekStart
		const last = this.cursor.monthEnd
		const weeks = new Array<Array<DateTime>>()
		for (let day = first; !day.isAfter(last); day = day.add({ days: 7 })) {
			weeks.push(Array.from({ length: day.daysInWeek }, (_, index) => day.add({ days: index }).dayStart))
		}
		return weeks
	}

	private move(to: DateTime) {
		this.cursor = to.dayStart
		this.focus()
	}

	private readonly handleKeyDown = (e: KeyboardEvent) => {
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
			this.move(step())
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				font-size: 0.8125rem;
				color: var(--color-text);
			}

			header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.25rem;

				> span {
					font-weight: 600;
				}

				mitra-icon-button:dir(rtl)::part(icon) {
					scale: -1 1;
				}
			}

			[role=grid] {
				display: grid;
				grid-template-columns: repeat(7, 2rem);
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
			}
		`
	}

	protected override get template() {
		// The days are counted in the zone of the value given, today among them.
		const today = DateTime.from(Date.now(), undefined, this.cursor.timeZoneId).dayStart
		const month = this.cursor.monthStart
		const weeks = this.weeks
		return html`
			<header>
				<mitra-icon-button size="small" icon="chevron-left" label=${t('Previous month')} @click=${() => this.cursor = this.cursor.subtract({ months: 1 })}></mitra-icon-button>
				<span aria-live="polite">${month.format({ month: 'long', year: 'numeric' })}</span>
				<mitra-icon-button size="small" icon="chevron-right" label=${t('Next month')} @click=${() => this.cursor = this.cursor.add({ months: 1 })}></mitra-icon-button>
			</header>
			<div role="grid" aria-label=${month.format({ month: 'long', year: 'numeric' })} @keydown=${this.handleKeyDown}>
				<div role="row">
					${weeks[0]!.map(day => html`<span role="columnheader" aria-label=${day.format({ weekday: 'long' })}>${day.format({ weekday: 'narrow' })}</span>`)}
				</div>
				${weeks.map(week => html`
					<div role="row">
						${week.map(day => html`
							<button role="gridcell" tabindex=${day.equals(this.cursor) ? 0 : -1}
								aria-selected=${!!this.value && day.equals(this.value.dayStart)}
								aria-current=${day.equals(today) ? 'date' : 'false'}
								aria-label=${day.format({ dateStyle: 'full' })}
								?data-outside=${day.month !== month.month}
								@click=${() => this.pick.dispatch(day)}
							>${day.format({ day: 'numeric' })}</button>
						`)}
					</div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-date-picker': DatePicker
	}
}
