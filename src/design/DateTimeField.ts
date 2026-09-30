import { component, css, event, html, property, query, type HTMLTemplateResult } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { FieldDateTimeController, FieldTimeController, FieldDateTimePrecision } from '@3mo/date-time-fields/controller'
import { Control } from './Control.js'
import { type Popover } from './Popover.js'
import { type DatePicker } from './DatePicker.js'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'
import './IconButton.js'
import { scrollbar } from './scrollbar.css.js'
import { optionRow, optionRowSelected } from './optionRow.css.js'
import { disabled } from './disabled.css.js'
import { fieldChrome } from './fieldChrome.css.js'

/**
 * What a date and a time field share: typed segments in the language's order, digits and calendar, a button and
 * Alt+ArrowDown for a picker, and `value` as the string of the native input each replaces. A context that
 * wears the box itself (the entry editor's rows) sets `--mitra-field-*`: the box sheds its chrome and its button, and a
 * click on the box stands for the button.
 */
abstract class SegmentedField extends Control {
	/** A native `change` stops at the shadow root; this one carries the value. */
	@event() readonly change!: EventDispatcher<string | undefined>

	@property({ bindingDefault: true, event: 'change' }) value?: string
	@property() label?: string
	@property({ type: Boolean, reflect: true }) readonly = false
	@property({ type: Boolean, reflect: true }) disabled = false

	@query('mitra-popover') protected readonly picker?: Popover

	protected abstract readonly controller: FieldDateTimeController<this> | FieldTimeController<this>
	protected abstract readonly icon: string
	protected abstract readonly pickerLabel: string
	protected abstract get pickerTemplate(): HTMLTemplateResult

	protected commit(value: string | undefined) {
		if (value !== this.value) {
			this.value = value
			this.change.dispatch(value)
		}
	}

	/** Whether the picker opening takes the focus: from the keyboard it does, while a pointer keeps typing in the segments. */
	private focusesPicker = false

	/** Opens the picker, as `showPicker()` does a native input's. */
	showPicker({ focus = false } = {}) {
		if (!this.readonly && !this.disabled) {
			this.focusesPicker = focus
			this.picker?.show(this)
		}
	}

	private readonly handleBoxClick = (e: MouseEvent) => {
		const button = this.renderRoot.querySelector('mitra-icon-button')
		if (button && getComputedStyle(button).display === 'none' && !e.defaultPrevented) {
			this.showPicker()
		}
	}

	protected closePicker() {
		this.picker?.hide()
		this.controller.focus()
	}

	override focus() {
		this.controller.focus()
	}

	static override get styles() {
		return css`
			:host {
				${controlHeight};
				display: inline-flex;
				min-inline-size: 0;
				font-size: 0.8125rem;
				font-weight: 500;
				color: var(--color-text);
			}

			[part=box] {
				${fieldChrome};
				flex: 1;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding-inline: var(--mitra-field-padding, 0.75rem 0.25rem);
			}

			:host([disabled]) [part=box] {
				${disabled};
			}

			:host([readonly]) [part=box] {
				opacity: var(--mitra-field-readonly-opacity, 0.55);
			}

			[part=segments] {
				flex: 1;
				min-inline-size: 0;
				white-space: nowrap;
				font-variant-numeric: tabular-nums;
				cursor: text;

				> * {
					outline: none;
					caret-color: transparent;
					user-select: none;
				}

				> [role] {
					border-radius: 0.2rem;
					padding-inline: 1px;

					&:focus {
						background: color-mix(in srgb, var(--color-accent) 40%, transparent);
					}

					&[data-placeholder] {
						color: var(--color-text-muted);
					}
				}

				> [aria-hidden] {
					color: var(--color-text-muted);
				}
			}

			mitra-icon-button {
				display: var(--mitra-field-button, inline-flex);
				color: var(--color-text-muted);
				margin-inline-end: calc(-1 * var(--mitra-glyph-inset) + 0.125rem);
			}

			mitra-popover {
				padding: 0.5rem;
			}

			.times {
				display: flex;
				flex-direction: column;
				gap: 1px;
				max-block-size: 16rem;
				overflow-y: auto;
				${scrollbar};
				padding: 0;

				/* The selected slot's tick keeps its room on every row, so the times stay in one column. */
				--mitra-option-inset: 1.75rem;

				button {
					all: unset;
					${optionRow};
					font-variant-numeric: tabular-nums;

					&:hover {
						${activated};
					}

					&:focus-visible {
						${ring};
					}

					&[aria-selected=true] {
						${optionRowSelected};
					}
				}
			}
		`
	}

	protected override get template() {
		const { controller } = this
		return html`
			<div part="box" @click=${this.handleBoxClick}>
				<div part="segments" ${controller.group.ref()}>
					${controller.segments.segments.map(segment => html`<span ${controller.segment.ref(segment)}></span>`)}
				</div>
				${this.readonly || this.disabled ? html.nothing : html`
					<mitra-icon-button size="small" tabindex="-1" icon=${this.icon} label=${this.pickerLabel} @click=${() => this.showPicker({ focus: true })}></mitra-icon-button>
				`}
			</div>
			<mitra-popover @openChange=${(e: CustomEvent<boolean>) => e.detail && this.pickerOpened(this.focusesPicker)}>${this.pickerTemplate}</mitra-popover>
		`
	}

	protected pickerOpened(_focus: boolean) { }
}

/** A date field; `value` is the `YYYY-MM-DD` of a native date input, while the segments follow the language. */
@component('mitra-date-field')
export class DateField extends SegmentedField {
	protected readonly icon = 'calendar'
	protected override get pickerLabel() { return t('Choose a date') }

	protected readonly controller = new FieldDateTimeController(this, host => ({
		get value() { return DateField.dateOf(host.value) },
		precision: FieldDateTimePrecision.Day,
		get label() { return host.label },
		get readonly() { return host.readonly },
		get disabled() { return host.disabled },
		handleChange: date => host.commit(DateField.stringOf(date)),
		get handlePickerOpen() { return host.readonly || host.disabled ? undefined : () => host.showPicker({ focus: true }) },
	}))

	/** A plain date is the local midnight of that day, which the segments read in the language's calendar. */
	private static dateOf(value?: string) {
		return value ? new DateTime(`${value}T00:00:00`) : undefined
	}

	private static stringOf(date?: Date) {
		const pad = (value: number) => String(value).padStart(2, '0')
		return date ? `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : undefined
	}

	@query('mitra-date-picker') private readonly datePicker?: DatePicker

	protected override pickerOpened(focus: boolean) {
		if (focus) {
			this.datePicker?.focus()
		}
	}

	protected get pickerTemplate() {
		return html`
			<mitra-date-picker .value=${this.controller.selectedDate}
				@pick=${(e: CustomEvent<DateTime>) => { this.controller.pick(e.detail); this.closePicker() }}
			></mitra-date-picker>
		`
	}
}

/** A time field; `value` is the `HH:mm` of a native time input, while the segments follow the language's clock. */
@component('mitra-time-field')
export class TimeField extends SegmentedField {
	private static readonly step = 30

	protected readonly icon = 'clock'
	protected override get pickerLabel() { return t('Choose a time') }

	protected readonly controller = new FieldTimeController(this, host => ({
		get value() { return host.value || undefined },
		get label() { return host.label },
		get readonly() { return host.readonly },
		get disabled() { return host.disabled },
		handleChange: value => host.commit(value),
		get handlePickerOpen() { return host.readonly || host.disabled ? undefined : () => host.showPicker({ focus: true }) },
	}))

	private get slots() {
		const day = new DateTime().dayStart
		return Array.from({ length: 24 * 60 / TimeField.step }, (_, index) => day.add({ minutes: index * TimeField.step }))
	}

	/** Opens on the slot at or just before the time in force. */
	protected override pickerOpened(focus: boolean) {
		void this.updateComplete.then(() => {
			const slots = [...this.renderRoot.querySelectorAll<HTMLElement>('.times button')]
			const [hour, minute] = (this.value ?? '').split(':').map(Number)
			const index = hour === undefined || Number.isNaN(hour) ? 0 : Math.floor((hour * 60 + (minute ?? 0)) / TimeField.step)
			slots[index]?.scrollIntoView({ block: 'center' })
			if (focus) {
				slots[index]?.focus()
			}
		})
	}

	private readonly handleKeyDown = (e: KeyboardEvent) => {
		const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
		if (step) {
			e.preventDefault()
			const buttons = [...this.renderRoot.querySelectorAll<HTMLElement>('.times button')]
			const next = buttons[buttons.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLElement) + step]
			next?.focus()
		}
	}

	protected get pickerTemplate() {
		const selected = this.value?.slice(0, 5)
		return html`
			<div class="times" role="listbox" aria-label=${this.pickerLabel} @keydown=${this.handleKeyDown}>
				${this.slots.map(slot => {
					const value = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
					return html`
						<button role="option" tabindex="-1" aria-selected=${value === selected}
							@click=${() => { this.controller.pick(slot); this.closePicker() }}
						>${slot.format({ hour: 'numeric', minute: '2-digit' })}</button>
					`
				})}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-date-field': DateField
		'mitra-time-field': TimeField
	}
}
