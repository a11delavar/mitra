import { Component, component, css, event, eventListener, html, property } from '@a11d/lit'
import { Selectability } from '@3mo/selectability'
import { SelectionGroupController, SelectionGroupPattern, type SelectionGroupItem } from '@3mo/selection-group'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'
import { disabled } from './disabled.css.js'
import { selected } from './selected.css.js'

export type SelectionGroupValue = string | undefined | Array<string>

/**
 * A set of `mitra-toggle`s or `mitra-radio`s sharing one selection and one tab stop. Single selection is a radio
 * group; `multiple` or `deselectable` makes it a group of pressed buttons. Children that are not items (a field
 * beside a radio) are laid out with the items but take no part in the selection.
 */
@component('mitra-selection-group')
export class SelectionGroupComponent extends Component {
	@event() readonly change!: EventDispatcher<SelectionGroupValue>

	@property({ type: Object, bindingDefault: true, event: 'change' }) value?: SelectionGroupValue
	@property({ type: Boolean, reflect: true }) multiple = false
	@property({ type: Boolean, reflect: true }) deselectable = false

	readonly controller = new SelectionGroupController<SelectionItem, SelectionGroupComponent>(this, host => ({
		get items() { return host.items },
		get selectability() { return host.multiple ? Selectability.Multiple : Selectability.Single },
		get deselectable() { return host.deselectable },
		get selection() { return host.selection },
		handleChange: selection => {
			const values = selection.map(item => item.value ?? '')
			host.value = host.multiple ? values : values[0]
			host.change.dispatch(host.value)
		},
	}))

	get items() {
		return [...this.children].filter(child => child instanceof SelectionItem)
	}

	private get selection() {
		const values = this.value === undefined ? [] : this.value instanceof Array ? this.value : [this.value]
		return this.items.filter(item => item.value !== undefined && values.includes(item.value))
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
			}
		`
	}

	protected override get template() {
		return html`<slot @slotchange=${() => this.controller.handleItemsChange()}></slot>`
	}
}

/** An item that renders its own state; the group decides it, answering the `requestSelect` a press sends. */
export abstract class SelectionItem extends Component implements SelectionGroupItem {
	@event({ bubbles: true, cancelable: true }) readonly requestSelect!: EventDispatcher<boolean>

	@property({ reflect: true }) value?: string
	@property({ type: Boolean, reflect: true }) selected = false
	@property({ type: Boolean, reflect: true }) disabled = false
	/** Written by the group. */
	@property({ attribute: false }) selectionPattern?: SelectionGroupPattern

	protected override updated() {
		const radio = this.selectionPattern === SelectionGroupPattern.Radio
		this.setAttribute('role', radio ? 'radio' : 'button')
		this.setAttribute(radio ? 'aria-checked' : 'aria-pressed', String(this.selected))
		this.removeAttribute(radio ? 'aria-pressed' : 'aria-checked')
		this.ariaDisabled = this.disabled ? 'true' : null
	}

	@eventListener('click')
	protected handleClick() {
		if (!this.disabled) {
			this.requestSelect.dispatch(!this.selected)
		}
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault()
			this.click()
		}
	}
}

/** A chip in a `mitra-selection-group`. */
@component('mitra-toggle')
export class Toggle extends SelectionItem {
	static override get styles() {
		return css`
			:host {
				${controlHeight};
				box-sizing: border-box;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-inline-size: var(--control-height);
				block-size: var(--control-height);
				padding-inline: 0.625rem;
				border: 1px solid transparent;
				border-radius: var(--border-radius);
				background: transparent;
				color: var(--color-text-muted);
				font-size: 0.75rem;
				font-weight: 500;
				cursor: pointer;
				user-select: none;
				outline: none;
				transition: background 0.15s ease, color 0.15s ease;
			}

			:host(:hover) {
				${activated};
				color: var(--color-text);
			}

			:host([selected]) {
				${selected};
			}

			:host([disabled]) {
				${disabled};
			}

			:host(:focus-visible) {
				${ring};
			}
		`
	}

	protected override get template() {
		return html`<slot></slot>`
	}
}

/** A radio button in a `mitra-selection-group`, labelled by its content. */
@component('mitra-radio')
export class Radio extends SelectionItem {
	static override get styles() {
		return css`
			:host {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				cursor: pointer;
				user-select: none;
				outline: none;
				border-radius: var(--border-radius);
			}

			:host([disabled]) {
				${disabled};
			}

			[part=radio] {
				box-sizing: border-box;
				flex-shrink: 0;
				display: inline-grid;
				place-content: center;
				inline-size: 1.125rem;
				block-size: 1.125rem;
				border: 1px solid transparent;
				border-radius: 50%;
				background: color-mix(in srgb, var(--color-text) 6%, transparent);
				transition: background-color 0.15s ease, box-shadow 0.15s ease;

				&::before {
					content: "";
					inline-size: 0.5rem;
					block-size: 0.5rem;
					border-radius: 50%;
					transform: scale(0);
					transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.4);
					background-color: var(--color-accent-text);
				}
			}

			:host(:hover) [part=radio] {
				${activated};
			}

			:host([selected]) [part=radio] {
				background: var(--color-accent);

				&::before {
					transform: scale(1);
				}
			}

			:host(:focus-visible) [part=radio] {
				${ring};
			}
		`
	}

	protected override get template() {
		return html`
			<span part="radio"></span>
			<slot></slot>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-selection-group': SelectionGroupComponent
		'mitra-toggle': Toggle
		'mitra-radio': Radio
	}
}
