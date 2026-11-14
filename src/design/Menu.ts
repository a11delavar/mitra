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

			/* Laid out while closed too, so that it keeps its column as it fades away. */
			:host {
				flex-direction: column;
				gap: 2px;
			}

			:host(:popover-open) {
				display: flex;
			}

			/* A submenu, beside the item that opens it, its first item level with that one. */
			:host([slot=submenu]) {
				margin: -0.25rem 0.25rem;
				position-area: inline-end span-block-end;
				position-try-fallbacks: flip-inline, flip-block, flip-block flip-inline, --centered;
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
 * keeps the menu open, so several can be toggled in one go. With `href` it is a link. A `mitra-menu` in its `submenu`
 * slot opens beside it, on a click, a hover or the arrow towards it, and keeps the menu around it open.
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

	/** The menu it opens beside itself, from its `submenu` slot. */
	get submenu() {
		return this.querySelector<Menu>(':scope > mitra-menu[slot=submenu]') ?? undefined
	}

	/** Opens its submenu under the pointer, and closes a sibling's it left. */
	@eventListener('pointerenter')
	protected handlePointerEnter() {
		for (const sibling of this.parentElement?.children ?? []) {
			if (sibling !== this && sibling instanceof MenuItem) {
				sibling.submenu?.hide()
			}
		}
		if (!this.disabled) {
			this.submenu?.show(this)
		}
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		const towards = this.matches(':dir(rtl)') ? 'ArrowLeft' : 'ArrowRight'
		if (e.target === this && e.key === towards && this.submenu && !this.disabled) {
			e.preventDefault()
			this.submenu.show(this)
		}
	}

	protected override updated() {
		this.setAttribute('role', this.type === 'radio' ? 'menuitemradio' : this.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem')
		// An item with a submenu says so, and whether it is open, before it was ever opened.
		if (this.submenu) {
			this.setAttribute('aria-haspopup', 'menu')
			this.setAttribute('aria-expanded', String(this.submenu.matches(':popover-open')))
		} else {
			this.removeAttribute('aria-haspopup')
			this.removeAttribute('aria-expanded')
		}
		if (this.type) {
			this.setAttribute('aria-checked', String(this.selected))
		} else {
			this.removeAttribute('aria-checked')
		}
		this.ariaDisabled = this.disabled ? 'true' : null
	}

	@eventListener('click')
	protected handleClick(e: MouseEvent & { [MenuController.preventClose]?: boolean }) {
		// A choice in its submenu is the menu's to close on; a click on the item itself only opens the submenu.
		if (this.submenu?.contains(e.target as Node)) {
			return
		}
		if (this.submenu && !this.disabled) {
			e[MenuController.preventClose] = true
			this.submenu.show(this)
			return
		}
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

	/** Its submenu opening or closing, which `aria-expanded` follows: a toggle does not bubble, so it is caught on its way down. */
	@eventListener({ type: 'toggle', options: { capture: true } })
	protected handleSubmenuToggle(e: Event) {
		if (e.target === this.submenu) {
			this.requestUpdate()
		}
	}

	/**
	 * Focus landing in its submenu is the submenu's alone: the menu around it would take it for focus on this item,
	 * focus the item, and so close the submenu it had just opened.
	 */
	private readonly handleSubmenuFocusIn = (e: FocusEvent) => e.stopPropagation()

	/**
	 * Keys in its submenu are the submenu's alone, or the menu around it would move or close too. The arrow away from
	 * it closes it and returns to this item.
	 */
	private readonly handleSubmenuKeyDown = (e: KeyboardEvent) => {
		e.stopPropagation()
		const away = this.matches(':dir(rtl)') ? 'ArrowRight' : 'ArrowLeft'
		if (e.key === away && !e.defaultPrevented) {
			e.preventDefault()
			this.submenu?.hide()
			this.focus()
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

			/* Under the pointer, or current for the keyboard: focus handed back after a pointer, as a submenu closing
			   does, leaves no row lit where the pointer is not. */
			:host(:is(:hover, :focus-visible)) {
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

			[part=chevron] {
				margin-inline: auto -0.25rem;

				&:dir(rtl) {
					transform: scaleX(-1);
				}
			}
		`
	}

	protected override get template() {
		return html`
			${!this.icon ? html.nothing : html`<mitra-icon part="icon" icon=${this.icon}></mitra-icon>`}
			<slot></slot>
			${!this.submenu ? html.nothing : html`<mitra-icon part="chevron" icon="chevron-right"></mitra-icon>`}
			<slot name="submenu" @slotchange=${() => this.requestUpdate()} @focusin=${this.handleSubmenuFocusIn} @keydown=${this.handleSubmenuKeyDown}></slot>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-menu': Menu
		'mitra-menu-item': MenuItem
	}
}
