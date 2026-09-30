import { Component, component, css, event, eventListener, html, property } from '@a11d/lit'
import { ComboboxController } from '@3mo/list/controller'
import { Popover } from './Popover.js'
import { activated } from './activated.css.js'
import { scrollbar } from './scrollbar.css.js'
import { optionRow, optionRowSelected } from './optionRow.css.js'
import { disabled } from './disabled.css.js'
import { InputField } from './TextField.js'

/**
 * An input over a list of `mitra-option`s: the ARIA combobox, with the arrows walking the options while the input
 * keeps focus. The input is the consumer's own, slotted as `input`; the options sit in a `mitra-listbox`, which
 * floats from the input as a popover, or with `inline` stays in the flow, as in a picker that is a popover already.
 * Choosing an option, by a click or by Enter, fires `pick` with its value.
 */
@component('mitra-combobox')
export class Combobox<T = unknown> extends Component {
	@event() readonly pick!: EventDispatcher<T>
	@event() readonly openChange!: EventDispatcher<boolean>
	/** An inline one's Escape, which the combobox keeps from the popover or dialog around it, so that one closes itself. */
	@event() readonly dismiss!: EventDispatcher

	/** Whether the floating listbox shows. An inline one always does. */
	@property({ type: Boolean, reflect: true }) open = false
	@property({ type: Boolean, reflect: true }) inline = false
	/** The option in force, which is marked and where the list opens. */
	@property({ type: Object }) selected?: T
	/** Enter takes the first option while none is active, as the top match of what was typed. */
	@property({ type: Boolean }) activateFirst = false

	readonly controller = new ComboboxController<T, Combobox<T>>(this, host => ({
		get expanded() { return host.inline || host.open },
		handleExpandedChange: open => host.setOpen(open),
		get selection() { return host.selected === undefined ? [] : [host.selected] },
		get activateFirst() { return host.activateFirst },
		autocomplete: true,
	}))

	get listbox() {
		return this.querySelector<Listbox>(':scope > mitra-listbox') ?? undefined
	}

	/** The slotted input, or the one inside what was slotted as `input`, such as a header around it. A button is a
	 * select's input: the select-only combobox, which opens on Space and Enter and finds options by typeahead. */
	get input() {
		const slotted = this.querySelector<HTMLElement>(':scope > [slot=input]')
		return (slotted instanceof InputField ? slotted.input
			: slotted?.matches('input, textarea, button') ? slotted : slotted?.querySelector<HTMLElement>('input, textarea')) ?? undefined
	}

	// A text field renders its input after it is slotted.
	private readonly handleInputSlotChange = async () => {
		const slotted = this.querySelector(':scope > [slot=input]')
		if (slotted instanceof InputField) {
			await slotted.updateComplete
		}
		this.requestUpdate()
	}

	private setOpen(open: boolean) {
		if (!this.inline && open !== this.open) {
			this.open = open
			this.openChange.dispatch(open)
		}
	}

	/** The options, however deep in the listbox, registered with the controller as they come and go. */
	private readonly syncOptions = () => {
		const options = this.listbox?.options ?? []
		this.controller.indexability.setItems(options, (option: Option, index: number) => ({ index, data: option.value as T, disabled: option.disabled }))
		this.requestUpdate()
	}

	protected override updated() {
		this.controller.input.value = this.input
		this.controller.listbox.value = this.listbox
		const listbox = this.listbox
		if (listbox && !this.inline) {
			if (this.open && (listbox.options.length || listbox.querySelector('[data-hint]'))) {
				listbox.show(this.input)
			} else {
				listbox.hide()
			}
		}
	}

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		const option = e.composedPath().find(target => target instanceof Option)
		if (option && !option.disabled) {
			this.pick.dispatch(option.value as T)
		}
	}

	@eventListener({ type: 'keydown', options: { capture: true } })
	protected handleKeyDown(e: KeyboardEvent) {
		if (this.inline && e.key === 'Escape' && !e.defaultPrevented) {
			this.dismiss.dispatch()
		}
	}

	@eventListener('focusout')
	protected handleFocusOut(e: FocusEvent) {
		if (!(e.relatedTarget instanceof Node) || !this.contains(e.relatedTarget)) {
			this.setOpen(false)
		}
	}

	static override get styles() {
		return css`
			:host {
				display: contents;
			}
		`
	}

	protected override get template() {
		return html`
			<slot name="input" @slotchange=${this.handleInputSlotChange}></slot>
			<slot @slotchange=${this.syncOptions} @optionschange=${this.syncOptions}></slot>
		`
	}
}

/** The options of a `mitra-combobox`, and between them what is not an option: a group's heading, a hint. */
@component('mitra-listbox')
export class Listbox extends Popover {
	protected override get popoverType() {
		return this.inline ? null : 'manual' as const
	}

	private get inline() {
		return this.parentElement instanceof Combobox && this.parentElement.inline
	}

	/** Its options in document order, however deep, including those a host slots into it, as `mitra-select` does. */
	get options() {
		return [...this.children].flatMap(function optionsIn(element): Array<Option> {
			return element instanceof Option ? [element]
				: element instanceof HTMLSlotElement ? element.assignedElements({ flatten: true }).flatMap(optionsIn)
					: [...element.children].flatMap(optionsIn)
		})
	}

	readonly announce = () => this.dispatchEvent(new Event('optionschange', { bubbles: true }))

	static override get styles() {
		return css`
			${super.styles}

			:host {
				padding: 0.25rem;
				min-inline-size: 12rem;
				max-block-size: min(24rem, 60dvh);
				overflow-y: auto;
				${scrollbar};
				position-area: block-end span-inline-end;
			}

			:host(:popover-open), :host(:not([popover])) {
				display: flex;
				flex-direction: column;
				gap: 1px;
			}

			:host(:not([popover])) {
				all: unset;
				box-sizing: border-box;
				display: flex;
				flex-direction: column;
				gap: 1px;
				overflow-y: auto;
				${scrollbar};
				min-block-size: 0;
			}
		`
	}

	protected override get template() {
		return html`<slot @slotchange=${this.announce}></slot>`
	}

	// Options rendered inside wrappers never reach the slot's own slotchange.
	private readonly observer = new MutationObserver(this.announce)

	protected override initialized() {
		this.observer.observe(this, { childList: true, subtree: true })
	}

	protected override disconnected() {
		this.observer.disconnect()
	}
}

/** An option of a `mitra-listbox`, showing its content and standing for its `value`. */
@component('mitra-option')
export class Option extends Component {
	@property({ type: Object }) value?: unknown
	@property({ type: Boolean, reflect: true }) disabled = false
	/** What a select shows for it when selected, where its content is more than words; its text otherwise. */
	@property() label?: string

	/** The input keeps focus, or the list would close before the press became a click. */
	@eventListener('pointerdown')
	protected handlePointerDown(e: PointerEvent) {
		e.preventDefault()
	}

	static override get styles() {
		return css`
			:host {
				${optionRow};
				color: color-mix(in srgb, var(--color-text) 85%, transparent);
				transition: background 0.15s ease, color 0.15s ease;
			}

			:host(:hover), :host([data-navigability=current]) {
				${activated};
				color: var(--color-text);
			}

			:host([aria-selected=true]) {
				${optionRowSelected};
			}

			:host([disabled]) {
				${disabled};
			}

			/* Reads as an action rather than a value, such as "Custom…". */
			:host([data-muted]) {
				color: var(--color-text-muted);
			}

			[part=content] {
				flex: 1;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-inline-size: 0;
			}

			::slotted([slot=detail]), ::slotted(kbd) {
				flex-shrink: 0;
				white-space: nowrap;
			}

			::slotted([slot=detail]) {
				color: var(--color-text-muted);
				font-weight: 400;
			}
		`
	}

	protected override get template() {
		return html`
			<span part="content">
				<slot></slot>
			</span>
			<slot name="detail"></slot>
		`
	}
}

/**
 * Runs a search as the user types: after a pause, and keeping only the answer to the latest query, since an
 * earlier one may arrive after it.
 */
export class LatestSearch<T> {
	private sequence = 0
	private timer?: ReturnType<typeof setTimeout>

	constructor(private readonly search: (query: string) => Promise<T>, private readonly delay = 200) { }

	/** Resolves with the results, or never, when a later query overtook this one. */
	run(query: string, { immediately = false } = {}) {
		clearTimeout(this.timer)
		const sequence = ++this.sequence
		return new Promise<T>(resolve => {
			this.timer = setTimeout(async () => {
				const results = await this.search(query)
				if (sequence === this.sequence) {
					resolve(results)
				}
			}, immediately ? 0 : this.delay)
		})
	}

	/** Drops whatever is on its way. */
	cancel() {
		clearTimeout(this.timer)
		this.sequence++
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-combobox': Combobox
		'mitra-listbox': Listbox
		'mitra-option': Option
	}
}
