import { component, css, event, html, ifDefined, live, property, query } from '@a11d/lit'
import { controlHeight } from './controlHeight.css.js'
import { fieldChrome } from './fieldChrome.css.js'
import { disabled } from './disabled.css.js'
import { Control } from './Control.js'
import './Icon.js'

/**
 * What every single-line field shares: a `label` above (or the host's `aria-label`, or else the placeholder, as its
 * name), a `hint` or `error` beneath, an optional `icon` inside the box, and the box itself. A subclass says what its
 * value is and how the input's text reads as one.
 */
export abstract class InputField<T> extends Control {
	/** A native `change` stops at the shadow root, so the host fires its own on commit. */
	@event() readonly change!: EventDispatcher<T>

	abstract value: T
	@property() label?: string
	@property() placeholder?: string
	/** A glyph inside the box before the text, as a search box's magnifier. */
	@property() icon?: string
	@property() autocomplete = 'off'
	@property({ type: Boolean, reflect: true }) readonly = false
	@property({ type: Boolean, reflect: true }) disabled = false
	/** A line under the input; an `error` takes its place and marks the input invalid. */
	@property() hint?: string
	@property() error?: string
	/** Without a box of its own, for a field that heads a picker; the picker draws the line beneath it. */
	@property({ type: Boolean, reflect: true }) plain = false

	/** The native input, for what must reach it: a combobox this field is the input of. */
	@query('input') readonly input?: HTMLInputElement

	// The native input's own settings, which only some fields have: a subclass overrides the field, or redeclares it
	// as a public property where its users set it.
	protected type = 'text'
	protected maxLength?: number
	protected min?: number
	protected max?: number
	protected step?: number

	protected abstract parse(text: string): T
	protected abstract format(value: T): string

	/** The value a commit settles on, such as a number within its bounds. */
	protected commit(value: T) {
		return value
	}

	private readonly handleChange = () => {
		this.value = this.commit(this.value)
		this.change.dispatch(this.value)
	}

	static override get styles() {
		return css`
			:host {
				${controlHeight};
				display: flex;
				flex-direction: column;
				gap: 0.3rem;
				min-inline-size: 0;
				font-size: 0.8125rem;
				font-weight: 500;
				color: var(--color-text);
			}

			label {
				font-size: 0.75rem;
				font-weight: 600;
				color: var(--color-text-muted);
			}

			[part=box] {
				${fieldChrome};
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding-inline: var(--mitra-field-padding, 0.75rem);
				cursor: text;

				&[data-invalid] {
					border-color: var(--color-error);
				}

				> mitra-icon {
					flex-shrink: 0;
					font-size: 0.9375rem;
					color: var(--color-text-muted);
				}
			}

			:host([plain]) [part=box] {
				border-color: transparent;
				border-radius: 0;
				background: none;
				box-shadow: none;
			}

			:host([readonly]) [part=box] {
				opacity: var(--mitra-field-readonly-opacity, 0.55);
				cursor: not-allowed;
			}

			:host([disabled]) [part=box] {
				${disabled};
			}

			input {
				all: unset;
				flex: 1;
				min-inline-size: 0;
				block-size: calc(var(--control-height) - 2px);
				font: inherit;
				color: inherit;

				&::placeholder {
					color: var(--color-text-muted);
					font-weight: 400;
				}

				&::-webkit-search-cancel-button {
					display: none;
				}
			}

			p {
				margin: 0;
				font-size: 0.75rem;
				color: var(--color-text-muted);

				&.error {
					color: var(--color-error);
				}
			}
		`
	}

	protected override get template() {
		const note = this.error || this.hint
		return html`
			${!this.label ? html.nothing : html`<label for="input" part="label">${this.label}</label>`}
			<div part="box" ?data-invalid=${!!this.error} @click=${() => this.focus()}>
				${!this.icon ? html.nothing : html`<mitra-icon icon=${this.icon}></mitra-icon>`}
				<input id="input" part="input" type=${this.type} spellcheck="false"
					maxlength=${ifDefined(this.maxLength)}
					min=${ifDefined(this.min)}
					max=${ifDefined(this.max)}
					step=${ifDefined(this.step)}
					autocomplete=${this.autocomplete as AutoFill}
					placeholder=${ifDefined(this.placeholder)}
					aria-label=${ifDefined(this.label ? undefined : this.ariaLabel ?? this.placeholder)}
					?readonly=${this.readonly}
					?disabled=${this.disabled}
					aria-invalid=${!!this.error}
					aria-describedby=${ifDefined(note ? 'note' : undefined)}
					.value=${live(this.format(this.value))}
					@input=${(e: Event) => this.value = this.parse((e.target as HTMLInputElement).value)}
					@change=${this.handleChange}
				>
			</div>
			${!note ? html.nothing : html`<p id="note" part="note" class=${this.error ? 'error' : 'hint'}>${note}</p>`}
		`
	}
}

/** A text field. `value` is current by the time its (native, composed) `input` event arrives, so `bind()` works on it as on an `<input>`. */
@component('mitra-text-field')
export class TextField extends InputField<string> {
	@property({ bindingDefault: true, event: 'input' }) value = ''
	@property() override type: 'text' | 'password' | 'url' | 'email' | 'search' = 'text'
	@property({ type: Number, attribute: 'maxlength' }) override maxLength?: number

	protected parse(text: string) {
		return text
	}

	protected format(value: string) {
		return value
	}
}

/** A search box: a text field that searches, with the magnifier. */
@component('mitra-search-field')
export class SearchField extends TextField {
	override type = 'search' as const
	override icon = 'search'
}

/**
 * A number, committed on `change` and kept within `min`, `max` and `step` then; while it is typed, `value` follows
 * whatever reads as a number.
 */
@component('mitra-number-field')
export class NumberField extends InputField<number> {
	@property({ type: Number, bindingDefault: true, event: 'change' }) value = 0
	@property({ type: Number }) override min?: number
	@property({ type: Number }) override max?: number
	@property({ type: Number }) override step = 1
	protected override type = 'number'

	protected parse(text: string) {
		const number = Number(text)
		return text.trim() === '' || Number.isNaN(number) ? this.value : number
	}

	protected format(value: number) {
		return String(value)
	}

	protected override commit(value: number) {
		const stepped = Math.round(value / this.step) * this.step
		return Math.min(this.max ?? Infinity, Math.max(this.min ?? -Infinity, stepped))
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-text-field': TextField
		'mitra-search-field': SearchField
		'mitra-number-field': NumberField
	}
}
