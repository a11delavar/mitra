import { component, css, eventListener, html, property, query, state } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { FieldDateTimePrecision } from '@3mo/date-time-fields/controller'
import { DateField } from './DateField.js'
import { type TimePicker } from './TimePicker.js'

/**
 * A date and time field: `value` is a moment, read in `timeZone`, while the segments follow the language. Its picker holds both, the days of a month beside the times of a day, and edits a draft: a day picked
 * waits there for a time, which completes the moment. Closing the picker keeps what was picked, Escape drops it.
 */
@component('mitra-date-time-field')
export class DateTimeField extends DateField {
	/** The time a day takes while the field has none, `HH:mm`: one picked, or typed without a time. */
	@property() defaultTime?: string

	/** The moment being picked while the picker is open. */
	@state() private draft?: DateTime
	private dropsDraft = false

	protected override get precision() { return FieldDateTimePrecision.Minute }
	protected override get shown() { return this.draft ?? this.value }

	protected override get referenceDate() {
		const { hour, minute } = this.defaultPlainTime
		return !this.defaultTime ? super.referenceDate : super.referenceDate.dayStart.with({ hour, minute })
	}

	private get defaultPlainTime() {
		return Temporal.PlainTime.from(this.defaultTime ?? '00:00')
	}

	protected override commit(value: DateTime | undefined) {
		this.draft = undefined
		super.commit(value)
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			this.dropsDraft = true
		}
	}

	/** A day keeps the time, or takes the default one. */
	private pickDay(day: DateTime) {
		const { hour, minute } = this.shown ? this.zoned(this.shown) : this.defaultPlainTime
		this.draft = day.with({ hour, minute })
	}

	/** A time keeps the day: the one picked, the value's, or today's while there is none. */
	private pickTime(time: string) {
		const { hour, minute } = Temporal.PlainTime.from(time)
		this.commit(this.zoned(this.shown ?? new DateTime()).dayStart.with({ hour, minute }))
		this.closePicker()
	}

	@query('mitra-time-picker') private readonly timePicker?: TimePicker

	/** Opened from the keyboard, the focus lands on the part it came from: the time from a time segment, else the day. */
	protected override pickerOpened(focus: boolean) {
		this.dropsDraft = false
		const segment = (this.renderRoot as ShadowRoot).activeElement?.getAttribute('data-segment') ?? ''
		const time = DateTimeField.timeUnits.has(segment)
		if (focus && time) {
			this.timePicker?.focus()
		}
		super.pickerOpened(focus && !time)
	}

	protected override pickerClosed() {
		const { draft } = this
		this.draft = undefined
		if (draft !== undefined && !this.dropsDraft) {
			this.commit(draft)
		}
	}

	static override get styles() {
		return css`
			${super.styles}

			/* Never narrower than both parts: short of room, it moves rather than squeezes the times. */
			mitra-popover:popover-open {
				display: grid;
				grid-template-columns: auto auto;
				column-gap: 0.5rem;
				min-inline-size: max-content;
				overflow: clip;
			}

			/* As tall as the month beside it however many times it holds, and out to the popover's edges, so that its
			   scrollbar runs along the edge. */
			mitra-time-picker {
				box-sizing: border-box;
				block-size: 0;
				min-block-size: calc(100% + 1rem);
				max-block-size: none;
				margin-block: -0.5rem;
				margin-inline-end: -0.5rem;
				padding-block: 0.5rem;
				padding-inline: 0.5rem 0.125rem;
				border-inline-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
			}
		`
	}

	protected override get pickerTemplate() {
		return html`
			<mitra-date-picker .value=${this.controller.selectedDate} .navigationDate=${this.controller.navigationDate}
				@pick=${(e: CustomEvent<DateTime>) => this.pickDay(e.detail)}
			></mitra-date-picker>
			<mitra-time-picker .value=${this.shown ? this.zoned(this.shown).zonedDateTime.toPlainTime().toString({ smallestUnit: 'minute' }) : this.defaultTime}
				@pick=${(e: CustomEvent<string>) => this.pickTime(e.detail)}
			></mitra-time-picker>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-date-time-field': DateTimeField
	}
}
