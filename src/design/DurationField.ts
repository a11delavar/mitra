import { component, eventListener, html, property, state } from '@a11d/lit'
import { TimeSpan } from '@3mo/date-time'
import { SegmentedInputController, type EditableSegment, type InputSegment, type SegmentedInputStep } from '@3mo/segmented-input'
import { SegmentedField } from './DateTimeField.js'

type Unit = 'hour' | 'minute'

/**
 * A length in minutes, typed as hours and minutes in the language's digits and units ("1 hr 30 min"), or picked
 * from `presets`. Emptied, it is `undefined`.
 */
@component('mitra-duration-field')
export class DurationField extends SegmentedField<number, InputSegment> {
	@property({ type: Array }) presets: ReadonlyArray<number> = []

	/** What is typed into each unit while the field is in use; the value only changes on a commit. */
	@state() private typed?: Record<Unit, string>

	protected readonly icon = 'hourglass'
	protected override get pickerLabel() { return t('Choose a length') }

	protected readonly controller = new SegmentedInputController<InputSegment, this>(this, host => ({
		get segments() { return host.segments },
		get label() { return host.label },
		get readonly() { return host.readonly },
		get disabled() { return host.disabled },
		get direction() { return host.matches(':dir(rtl)') ? 'rtl' as const : 'ltr' as const },
		accept: (segment, typed, character) => host.accept(segment, typed, character),
		isComplete: (segment, text) => segment.key === 'minute' && (text.length === 2 || Number(text) > 5),
		handleSegmentInput: (segment, text) => host.typed = { ...host.units, [segment.key]: text },
		handleStep: (segment, step) => host.step(segment.key as Unit, step),
		handleCommit: () => host.settle(),
	}))

	private get language() {
		return Localizer.languages.current
	}

	/** The units as typed, or as the value reads. */
	private get units(): Record<Unit, string> {
		return this.typed ?? (this.value === undefined ? { hour: '', minute: '' }
			: { hour: String(Math.floor(this.value / 60)), minute: String(this.value % 60) })
	}

	protected get segments(): ReadonlyArray<InputSegment> {
		const numbers = new Intl.NumberFormat(this.language, { useGrouping: false })
		const names = new Intl.DisplayNames(this.language, { type: 'dateTimeField' })
		return (['hour', 'minute'] as const).flatMap((unit, index) => {
			const text = this.units[unit]
			// The language places and spells the unit around the number: "1 hr", "1 Std.", "۱ ساعت".
			const parts = new Intl.NumberFormat(this.language, { style: 'unit', unit, unitDisplay: 'short' }).formatToParts(1)
			const at = parts.findIndex(part => part.type === 'integer')
			const literal = (key: string, value: string): Array<InputSegment> => value ? [{ key, editable: false, text: value }] : []
			return [
				...literal(`${unit}-before`, (index ? ' ' : '') + parts.slice(0, at).map(part => part.value).join('')),
				{ key: unit, editable: true, filled: !!text, text: text ? numbers.format(Number(text)) : '––', label: names.of(unit), capacity: unit === 'hour' ? 3 : 2, inputMode: 'numeric' },
				...literal(`${unit}-after`, parts.slice(at + 1).map(part => part.value).join('')),
			]
		})
	}

	/** A digit in the language's numbering or ASCII; minutes restart past 59. */
	private accept(segment: EditableSegment, typed: string, character: string) {
		const numbers = new Intl.NumberFormat(this.language, { useGrouping: false })
		const digit = Array.from({ length: 10 }, (_, digit) => digit).find(digit => numbers.format(digit) === character || String(digit) === character)
		if (digit === undefined) {
			return undefined
		}
		const text = typed + digit
		return segment.key === 'minute' && Number(text) > 59 ? String(digit) : text
	}

	private step(unit: Unit, step: SegmentedInputStep) {
		const units = this.units
		const value = Number(units[unit] || 0)
		const [size, limit] = unit === 'hour' ? [1, 999] : [5, 59]
		const next = {
			increment: value + size, decrement: value - size,
			incrementPage: value + size * 3, decrementPage: value - size * 3,
			min: 0, max: limit,
		}[step]
		this.typed = { ...units, [unit]: String(Math.min(limit, Math.max(0, next))) }
	}

	private settle() {
		const { hour, minute } = this.units
		this.typed = undefined
		this.commit(hour || minute ? Number(hour || 0) * 60 + Number(minute || 0) || undefined : undefined)
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.altKey && e.key === 'ArrowDown') {
			e.preventDefault()
			this.showPicker({ focus: true })
		}
	}

	protected override pickerOpened(focus: boolean) {
		void this.updateComplete.then(() => {
			const slots = [...this.renderRoot.querySelectorAll<HTMLElement>('.slots button')]
			const slot = slots.find(slot => slot.ariaSelected === 'true') ?? slots[0]
			slot?.scrollIntoView({ block: 'nearest' })
			if (focus) {
				slot?.focus()
			}
		})
	}

	protected get pickerTemplate() {
		const format = new Intl.DurationFormat(this.language, { style: 'short' })
		const day = TimeSpan.fromDays(1).minutes
		return html`
			<div class="slots" role="listbox" aria-label=${this.pickerLabel} @keydown=${this.handleSlotsKeyDown}>
				${this.presets.map(minutes => html`
					<button role="option" tabindex="-1" aria-selected=${minutes === this.value}
						@click=${() => { this.typed = undefined; this.commit(minutes); this.closePicker() }}
					>${format.format({ days: Math.floor(minutes / day), hours: Math.floor(minutes % day / 60), minutes: minutes % 60 })}</button>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-duration-field': DurationField
	}
}
