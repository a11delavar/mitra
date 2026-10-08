import { component, css, event, html, ifDefined, property, query, Component } from '@a11d/lit'
import { Control } from './Control.js'
import { controlHeight } from './controlHeight.css.js'
import type { Listbox } from './Combobox.js'
import './Icon.js'
import { disabled } from './disabled.css.js'
import { fieldChrome } from './fieldChrome.css.js'

/**
 * A select of the `mitra-option`s inside it (grouped by `mitra-option-group`), any values among them: the ARIA
 * select-only combobox, a button over a listbox. The button shows the selected option's `label` or text, or what is
 * slotted as `value` where that is more than words. Like a native one it takes the value selected; a consumer that
 * may refuse it binds `value` with `live()`.
 */
@component('mitra-select')
export class Select<T = unknown> extends Control {
	@event() readonly change!: EventDispatcher<T>
	@event() readonly openChange!: EventDispatcher<boolean>

	@property({ type: Object, bindingDefault: true, event: 'change' }) value?: T
	@property() label?: string
	@property({ type: Boolean, reflect: true }) disabled = false
	/** Shown before the selected option in the button. */
	@property() icon?: string
	/** The value in force is no choice at all, and reads like a placeholder. */
	@property({ type: Boolean, reflect: true, attribute: 'data-placeholder' }) placeholder = false

	@property({ type: Boolean, reflect: true }) open = false

	@query('mitra-listbox') private readonly listbox?: Listbox

	private get selectedOption() {
		return this.listbox?.options.find(option => Object.is(option.value, this.value))
	}

	private setOpen(open: boolean) {
		if (open !== this.open) {
			this.open = open
			this.openChange.dispatch(open)
		}
	}

	private readonly choose = (e: CustomEvent<T>) => {
		this.value = e.detail
		this.change.dispatch(e.detail)
	}

	// Options come and go, or change their words, without the select rendering; the button has to follow.
	private readonly observer = new MutationObserver(() => {
		this.listbox?.announce()
		this.requestUpdate()
	})

	protected override connected() {
		this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['label', 'disabled'] })
	}

	protected override disconnected() {
		this.observer.disconnect()
	}

	static override get styles() {
		return css`
			:host {
				${controlHeight};
				display: inline-flex;
				min-inline-size: 0;
				vertical-align: middle;
				font-size: 0.8125rem;
				font-weight: 500;
				color: var(--color-text);
			}

			:host([hidden]) {
				display: none;
			}

			button {
				all: unset;
				${fieldChrome};
				flex: 1;
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				min-inline-size: 0;
				padding-inline: var(--mitra-field-padding, 0.75rem 0.5rem);
				cursor: pointer;

				&:disabled {
					cursor: default;
				}
			}

			/* A context that wears the box itself (the entry editor's rows) reads a disabled select as plain text. */
			:host([disabled]) button {
				${disabled};
				opacity: var(--mitra-field-readonly-opacity, 0.5);
			}

			[part=value] {
				flex: 1;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-inline-size: 0;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}

			:host([data-placeholder]) [part=value] {
				color: var(--color-text-muted);
				font-weight: 400;
			}

			mitra-icon {
				flex-shrink: 0;
				font-size: 1rem;
			}

			[part=indicator] {
				color: color-mix(in srgb, var(--color-text) 60%, transparent);
				opacity: var(--mitra-select-indicator-opacity, 1);
				transition: opacity 0.15s ease, rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
			}

			:host(:hover) [part=indicator], button:focus-visible [part=indicator] {
				opacity: 1;
			}

			mitra-combobox[open] [part=indicator] {
				opacity: 1;
				rotate: 180deg;
			}

			mitra-listbox {
				/* Every row leaves the selected one's tick its room, so the words stay in one column. */
				--mitra-option-inset: 1.75rem;
				min-inline-size: max(10rem, anchor-size(inline));
				max-block-size: min(32rem, 80dvh);
				position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline, --centered;
			}
		`
	}

	protected override get template() {
		const option = this.selectedOption
		return html`
			<mitra-combobox ?open=${this.open} .selected=${this.value}
				@openChange=${(e: CustomEvent<boolean>) => this.setOpen(e.detail)}
				@pick=${this.choose}
			>
				<button slot="input" part="button" ?disabled=${this.disabled} aria-label=${ifDefined(this.label)}
					@click=${() => this.setOpen(!this.open)}
				>
					${!this.icon ? html.nothing : html`<mitra-icon part="icon" icon=${this.icon}></mitra-icon>`}
					<span part="value">
						<slot name="value">${option?.label ?? option?.textContent?.trim() ?? ''}</slot>
					</span>
					<mitra-icon part="indicator" icon="chevron-down"></mitra-icon>
				</button>
				<mitra-listbox part="listbox">
					<slot @slotchange=${() => { this.listbox?.announce(); this.requestUpdate() }}></slot>
				</mitra-listbox>
			</mitra-combobox>
		`
	}
}

/** Options under a heading, as a select's calendars under their account. */
@component('mitra-option-group')
export class OptionGroup extends Component {
	@property() label = ''

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 1px;
			}

			[role=group] {
				display: contents;
			}

			[part=label] {
				padding: 0.375rem 0.625rem 0.125rem;
				font-size: 0.6875rem;
				font-weight: 600;
				color: var(--color-text-muted);
			}
		`
	}

	protected override get template() {
		return html`
			<span part="label" id="label">${this.label}</span>
			<div role="group" aria-labelledby="label">
				<slot></slot>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-select': Select
		'mitra-option-group': OptionGroup
	}
}
