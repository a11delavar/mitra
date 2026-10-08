import { component, css, html, query } from '@a11d/lit'
import { FieldTimeController, type DateTimeSegment } from '@3mo/date-time-fields/controller'
import { SegmentedField } from './SegmentedField.js'
import { type TimePicker } from './TimePicker.js'

/** A time field; `value` is the `HH:mm` of a native time input, while the segments follow the language's clock. */
@component('mitra-time-field')
export class TimeField extends SegmentedField<string, DateTimeSegment> {
	protected readonly icon = 'clock'
	protected get segments() { return this.controller.segments.segments }
	protected override get pickerLabel() { return t('Choose a time') }

	protected readonly controller = new FieldTimeController(this, host => ({
		get value() { return host.value || undefined },
		get label() { return host.label },
		get readonly() { return host.readonly },
		get disabled() { return host.disabled },
		handleChange: value => host.commit(value),
		get handlePickerOpen() { return host.readonly || host.disabled ? undefined : () => host.showPicker({ focus: true }) },
	}))

	@query('mitra-time-picker') private readonly timePicker?: TimePicker

	static override get styles() {
		return css`
			${super.styles}

			/* The list reaches the popover's edges, so that its scrollbar runs along the edge. */
			mitra-popover {
				padding: 0;
				overflow: clip;
			}

			mitra-time-picker {
				padding-block: 0.5rem;
				padding-inline: 0.5rem 0.125rem;
			}
		`
	}

	protected override pickerOpened(focus: boolean) {
		if (focus) {
			this.timePicker?.focus()
		}
	}

	protected get pickerTemplate() {
		return html`
			<mitra-time-picker .value=${this.value?.slice(0, 5)}
				@pick=${(e: CustomEvent<string>) => { this.commit(e.detail); this.closePicker() }}
			></mitra-time-picker>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-field': TimeField
	}
}
