import { component, css, html, property, query, state, type PropertyValues } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { FieldDateTimeController, FieldDateTimePrecision, type DateTimeSegment } from '@3mo/date-time-fields/controller'
import { SegmentedField } from './SegmentedField.js'
import { type DatePicker } from './DatePicker.js'

/**
 * A date field: `value` is the start of a day in `timeZone`, while the segments follow the language. Its units are the
 * parts `date` and `time`; while it shows the day of `impliedDate`, its date units recede (state `implied`).
 */
@component('mitra-date-field')
export class DateField extends SegmentedField<DateTime, DateTimeSegment> {
	protected static readonly timeUnits = new Set(['hour', 'minute', 'second', 'dayPeriod'])

	/** Where the field reads and writes its moments: the system's zone unless given. */
	@property() timeZone?: string

	/** A moment whose day goes without saying where the field stands (an end's, the start's). */
	@property({ type: Object }) impliedDate?: DateTime

	/** What the segments hold while they are typed into, once every unit is. */
	@state() private typed?: DateTime

	protected readonly icon = 'calendar'
	protected get segments() { return this.controller.segments.segments }
	protected override segmentPart(segment: DateTimeSegment) {
		return !segment.editable ? undefined : DateField.timeUnits.has(segment.type) ? 'time' : 'date'
	}
	protected override get pickerLabel() { return t('Choose a date') }
	protected get precision() { return FieldDateTimePrecision.Day }
	/** What the segments and the picker show. */
	protected get shown() { return this.value }
	/** Where the units the user leaves out are taken from: now, unless a subclass knows better. */
	protected get referenceDate() { return this.zoned(new DateTime()) }

	protected readonly controller = new FieldDateTimeController(this, host => ({
		get value() { return host.shown },
		get timeZone() { return host.timeZone },
		get precision() { return host.precision },
		get referenceDate() { return host.referenceDate },
		get label() { return host.label },
		get readonly() { return host.readonly },
		get disabled() { return host.disabled },
		handleInput: date => host.typed = date && host.zoned(date),
		handleChange: date => host.commit(date && host.zoned(date)),
		get handlePickerOpen() { return host.readonly || host.disabled ? undefined : () => host.showPicker({ focus: true }) },
	}))

	/** A moment as the field reads it, in its zone. */
	protected zoned(date: Date) {
		return DateTime.from(date.valueOf(), undefined, this.timeZone)
	}

	protected override commit(value: DateTime | undefined) {
		this.typed = undefined
		if (value?.valueOf() !== this.value?.valueOf()) {
			super.commit(value)
		}
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		if (changed.has('value')) {
			this.typed = undefined
		}
	}

	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		const shown = this.typed ?? this.shown
		const implied = !!shown && !!this.impliedDate && this.zoned(shown).dayStart.equals(this.zoned(this.impliedDate).dayStart)
		this.internals.states[implied ? 'add' : 'delete']('implied')
	}

	static override get styles() {
		return css`
			${super.styles}

			/* A date that goes without saying recedes like the separators between its units. */
			:host(:state(implied)) [part=date] {
				color: var(--color-text-muted);
			}
		`
	}

	@query('mitra-date-picker') protected readonly datePicker?: DatePicker

	protected override pickerOpened(focus: boolean) {
		if (focus) {
			this.datePicker?.focus()
		}
	}

	protected get pickerTemplate() {
		return html`
			<mitra-date-picker .value=${this.controller.selectedDate} .navigationDate=${this.controller.navigationDate}
				@pick=${(e: CustomEvent<DateTime>) => { this.controller.pick(e.detail); this.closePicker() }}
			></mitra-date-picker>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-date-field': DateField
	}
}
