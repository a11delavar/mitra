import { Component, component, css, eventListener, html, property, type PropertyValues } from '@a11d/lit'
import { MenuController } from '@3mo/menu/controller'
import { Button } from './Button.js'
import { Popover } from './Popover.js'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { checkmark } from './checkmark.css.js'
import { selectedColor } from './selected.css.js'
import './Icon.js'
import { scrollbar } from './scrollbar.css.js'
import { optionRow, optionRowSelected } from './optionRow.css.js'
import { disabled } from './disabled.css.js'

/**
 * A popover of `mitra-menu-item`s, with the menu's keys and roles. Other children (a separator, a colour row)
 * sit between the items and take no part in the navigation.
 */
@component('mitra-menu')
export class Menu extends Popover {
	readonly controller = new MenuController(this, element => {
		const host = element as Menu
		return {
			get items() { return host.items },
			get expanded() { return host.open },
			handleExpandedChange: open => open ? host.show() : host.hide(),
		}
	})

	get items() {
		return [...this.children].filter(child => child instanceof MenuItem)
	}

	// The trigger is known before the menu first opens, so the keys that open a menu from it work at once.
	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		if (changed.has('trigger')) {
			this.controller.trigger.value = this.trigger
		}
	}

	protected override opened(source?: HTMLElement) {
		if (source) {
			this.controller.trigger.value = source instanceof Button ? source.control : source
		}
	}

	static override get styles() {
		return css`
			${super.styles}

			:host {
				padding: 0.25rem;
				min-inline-size: 10rem;
				max-block-size: min(32rem, 80dvh);
				overflow-y: auto;
				${scrollbar};
				position-area: block-end span-inline-start;
				position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline, --centered;
			}

			:host(:popover-open) {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			::slotted(hr) {
				flex-shrink: 0;
				inline-size: 100%;
				margin: 0.25rem 0;
				border: none;
				border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
			}
		`
	}

	protected override get template() {
		return html`<slot @slotchange=${() => this.controller.handleItemsChange()}></slot>`
	}
}

/**
 * A row of a `mitra-menu`. `type` makes it a radio or a checkbox of the menu, `selected` its state; a checkbox
 * keeps the menu open, so several can be toggled in one go. With `href` it is a link.
 */
@component('mitra-menu-item')
export class MenuItem extends Component {
	@property() icon?: string
	@property({ reflect: true }) type?: 'radio' | 'checkbox'
	@property({ type: Boolean, reflect: true }) selected = false
	@property({ type: Boolean, reflect: true }) disabled = false
	@property({ reflect: true }) variant?: 'danger'
	@property() href?: string
	@property() target?: string

	protected override updated() {
		this.setAttribute('role', this.type === 'radio' ? 'menuitemradio' : this.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem')
		if (this.type) {
			this.setAttribute('aria-checked', String(this.selected))
		} else {
			this.removeAttribute('aria-checked')
		}
		this.ariaDisabled = this.disabled ? 'true' : null
	}

	@eventListener('click')
	protected handleClick(e: MouseEvent & { [MenuController.preventClose]?: boolean }) {
		if (this.disabled) {
			e.stopImmediatePropagation()
			e[MenuController.preventClose] = true
			return
		}
		if (this.type === 'checkbox') {
			e[MenuController.preventClose] = true
		}
		if (this.href) {
			window.open(this.href, this.target ?? '_self', 'noopener')
		}
	}

	static override get styles() {
		return css`
			:host {
				${optionRow};
				font-weight: 500;
				color: var(--color-text);
				white-space: nowrap;
				outline: none;
			}

			:host(:is(:hover, :focus)) {
				${activated};
			}

			:host(:focus-visible) {
				${ring};
			}

			:host([variant=danger]) {
				color: var(--color-error);
			}

			:host([disabled]) {
				${disabled};
				background: transparent;
			}

			:host([type]) {
				--mitra-option-inset: 2rem;
			}

			:host([type=checkbox][selected])::before {
				${checkmark};
				background-color: ${selectedColor};
			}

			/* The one selected of a set is the selected row; ticked checkboxes stand side by side and only tick. */
			:host([type=radio][selected]) {
				${optionRowSelected};
			}

			mitra-icon {
				font-size: 1rem;
				flex-shrink: 0;
			}

			::slotted(kbd) {
				margin-inline-start: auto;
			}
		`
	}

	protected override get template() {
		return html`
			${!this.icon ? html.nothing : html`<mitra-icon part="icon" icon=${this.icon}></mitra-icon>`}
			<slot></slot>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-menu': Menu
		'mitra-menu-item': MenuItem
	}
}
