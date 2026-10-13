import { Component, component, css, event, eventListener, html, property, state } from '@a11d/lit'
import { ComboboxController } from '@3mo/list/controller'
import { Selectability } from '@3mo/selectability'
import { Popover } from './Popover.js'
import { activated } from './activated.css.js'
import { scrollbar } from './scrollbar.css.js'
import { optionRow, optionRowSelected } from './optionRow.css.js'
import { disabled } from './disabled.css.js'
import { InputField } from './TextField.js'
import './Icon.js'

/**
 * The ARIA combobox: the arrows walk the options while the slotted `input` keeps focus. The listbox floats as a
 * popover, or with `inline` stays in the flow, as in a picker that is a popover already.
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
	/** The option in force, marked and where the list opens; several make the selection multiple, which a pick toggles one of. */
	@property({ type: Object }) selected?: T | ReadonlyArray<T>
	/** Enter takes the first option while none is active, as the top match of what was typed. */
	@property({ type: Boolean }) activateFirst = false

	readonly controller = new ComboboxController<T, Combobox<T>>(this, host => ({
		get expanded() { return host.inline || host.open },
		handleExpandedChange: open => host.setOpen(open),
		get selection() { return host.chosen },
		get selectability() { return Array.isArray(host.selected) ? Selectability.Multiple : Selectability.Single },
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

	private readonly syncOptions = () => {
		const options = this.listbox?.options ?? []
		// A folded option is not disabled, or it could not be the selected one: the controller steps over what is not shown.
		this.controller.indexability.setItems(options, (option: Option, index: number) => ({ index, data: option.value as T, disabled: option.disabled }))
		this.reveal()
		this.requestUpdate()
	}

	private get chosen(): ReadonlyArray<T> {
		return this.selected === undefined ? [] : Array.isArray(this.selected) ? this.selected : [this.selected as T]
	}

	private readonly revealed = new Set<unknown>()
	/** Unfolds the trees a selected option sits in, once per value, so a later fold by hand stays folded. */
	private reveal() {
		for (const value of this.chosen) {
			const option = this.revealed.has(value) ? undefined : this.listbox?.options.find(option => Object.is(option.value, value))
			if (!option) {
				continue
			}
			this.revealed.add(value)
			for (let element: Element = option, parent = option.parentElement; parent; element = parent, parent = parent.parentElement) {
				if (parent instanceof OptionTree && element.slot !== 'header') {
					parent.toggle(true, false)
				}
			}
		}
	}

	protected override updated() {
		this.reveal()
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
		if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.defaultPrevented && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
			this.handleTreeKey(e)
		}
	}

	/**
	 * The tree's horizontal keys: towards the reading direction unfolds a header or steps into it, back folds it or
	 * returns to it. A field keeps them for its caret while it holds text.
	 */
	private handleTreeKey(e: KeyboardEvent) {
		const input = this.input
		if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) && input.value) {
			return
		}
		const active = this.listbox?.options.find(option => option.dataset.navigability === 'current')
		const tree = active?.parentElement
		if (!active || !(tree instanceof OptionTree)) {
			return
		}
		const forward = e.key === (this.matches(':dir(rtl)') ? 'ArrowLeft' : 'ArrowRight')
		const header = active.slot === 'header'
		if (header && forward && tree.options.length) {
			if (tree.open) {
				this.controller.goTo(tree.options[0]!.value as T)
			} else {
				tree.toggle(true)
			}
		} else if (header && !forward && tree.open) {
			tree.toggle(false)
		} else if (!header && !forward && tree.header) {
			this.controller.goTo(tree.header.value as T)
		} else {
			return
		}
		e.preventDefault()
		e.stopPropagation()
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

	readonly announce = () => {
		this.toggleAttribute('data-tree', this.options.some(option => option.disclosure !== undefined || option.parentElement instanceof OptionTree))
		this.dispatchEvent(new Event('optionschange', { bubbles: true }))
	}

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

			/* Only a listbox holding an option tree lays its rows on shared columns, which groups, trees and options take up as
			   subgrids; a component lists its own (--mitra-tree-columns) between the tick and the chevron. */
			:host([data-tree]:popover-open), :host([data-tree]:not([popover])) {
				display: grid;
				grid-template-columns: [tick] 1.5rem var(--mitra-tree-columns, [words] auto [detail] auto) [end] 1.5rem;
				align-content: start;
				row-gap: 1px;
			}

			/* A floating one is as wide as its widest row, so words never run under a detail: a flexible column would come out empty. */
			:host([data-tree]:popover-open) {
				inline-size: max-content;
				max-inline-size: calc(100dvw - 1rem);
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

@component('mitra-option')
export class Option extends Component {
	@property({ type: Object }) value?: unknown
	@property({ type: Boolean, reflect: true }) disabled = false
	/** What a select shows for it when selected, where its content is more than words; its text otherwise. */
	@property() label?: string
	/**
	 * Its chevron, which a `mitra-option-tree` sets on its header (`open` or `closed`); `none` marks a row of a tree
	 * without one, which takes the tree's columns all the same.
	 */
	@property({ reflect: true }) disclosure?: 'open' | 'closed' | 'none'
	/** An icon in the tick's place, for an option that is more than selected (home, in the time zone picker). */
	@property({ reflect: true }) marker?: string

	@state() private detailed = false

	/** The input keeps focus, or the list would close before the press became a click. */
	@eventListener('pointerdown')
	protected handlePointerDown(e: PointerEvent) {
		e.preventDefault()
	}

	/** Folds or unfolds without choosing: the chevron is a button, which the combobox does not read as a choice. */
	private readonly disclose = (e: MouseEvent) => {
		e.stopPropagation()
		this.dispatchEvent(new Event('disclose', { bubbles: true, composed: true }))
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

			:host([marker])::before {
				display: none;
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

			/* Faded from the row's own colour, so it reads on a selected or tinted row too. */
			::slotted([slot=detail]) {
				color: color-mix(in srgb, currentColor 55%, transparent);
				font-weight: 400;
			}

			/* A row of a tree takes the listbox's columns (see Listbox), so a level's indent is the only offset left to choose. */
			:host([disclosure]) {
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				gap: 0;
				padding-inline: 0;

				&::before, [part=marker] {
					position: static;
					translate: none;
					grid-column: tick;
					grid-row: 1;
					justify-self: center;
				}

				[part=marker] {
					font-size: 0.875rem;
				}

				/* The row's tail, its whole height: the chevron is a section to press, not a small icon to aim at. */
				[part=indicator] {
					grid-column: end;
					grid-row: 1;
					align-self: stretch;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					margin-block: -0.25rem;
					/* Its tint keeps clear of the words before it. */
					margin-inline-start: 0.25rem;
					border-start-end-radius: var(--border-radius);
					border-end-end-radius: var(--border-radius);
					color: color-mix(in srgb, currentColor 55%, transparent);
					cursor: pointer;

					&:hover {
						color: currentColor;
						background: color-mix(in srgb, currentColor 12%, transparent);
					}

					&:dir(rtl) {
						scale: -1 1;
					}

					mitra-icon {
						font-size: 0.875rem;
						transition: rotate 0.2s ease;
					}

					&[data-open] mitra-icon {
						rotate: 90deg;
					}
				}

				/* The words take the detail's column too where the row has none. */
				[part=content] {
					grid-column: words / end;
					grid-row: 1;
					padding-inline-start: var(--mitra-option-nesting, 0rem);
					white-space: nowrap;
					overflow: hidden;

					&[data-detailed] {
						grid-column: words;
					}
				}

				::slotted([slot=detail]) {
					grid-column: detail;
					grid-row: 1;
					justify-self: end;
					padding-inline: 0.75rem 0.5rem;
				}
			}

		`
	}

	protected override get template() {
		return html`
			${this.disclosure !== 'open' && this.disclosure !== 'closed' ? html.nothing : html`
				<span part="indicator" role="button" ?data-open=${this.disclosure === 'open'}
					aria-expanded=${String(this.disclosure === 'open')}
					aria-label=${this.disclosure === 'open' ? t('Collapse') : t('Expand')}
					@click=${this.disclose}
				>
					<mitra-icon icon="chevron-right"></mitra-icon>
				</span>
			`}
			${!this.marker ? html.nothing : html`<mitra-icon part="marker" icon=${this.marker}></mitra-icon>`}
			<span part="content" ?data-detailed=${this.detailed}>
				<slot></slot>
			</span>
			<slot name="detail" @slotchange=${(e: Event) => this.detailed = (e.target as HTMLSlotElement).assignedNodes().length > 0}></slot>
		`
	}
}

/** Its header (`slot="header"`) is an option like any other, standing for the tree's default; the chevron folds the rest. */
@component('mitra-option-tree')
export class OptionTree extends Component {
	@property({ type: Boolean, reflect: true }) open = false
	get header() {
		return this.querySelector<Option>(':scope > mitra-option[slot=header]') ?? undefined
	}

	get options() {
		return [...this.querySelectorAll<Option>(':scope > mitra-option:not([slot=header])')]
	}

	/** Animates only a fold by hand, never the trees a list opens around its value as it shows. */
	@state() private animated = false

	toggle(open = !this.open, animate = true) {
		if (open !== this.open) {
			this.animated = animate
			this.open = open
		}
	}

	private readonly stamp = () => {
		const header = this.header
		if (header) {
			header.disclosure = !this.options.length ? 'none' : this.open ? 'open' : 'closed'
		}
		// A leaf is a row of the tree too, on its columns, with nothing in the chevron's.
		for (const option of this.options) {
			option.disclosure ??= 'none'
		}
	}

	protected override updated(changed: Map<PropertyKey, unknown>) {
		this.stamp()
		if (changed.has('open')) {
			// The combobox registers its options again, which steps over the folded ones.
			this.dispatchEvent(new Event('optionschange', { bubbles: true, composed: true }))
		}
	}

	static override get styles() {
		return css`
			:host {
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				row-gap: 1px;
			}

			/* Its rows on the same columns, in a box whose height can animate, which grows the list around it with it. */
			[part=options] {
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				row-gap: 1px;
				overflow: clip;
				interpolate-size: allow-keywords;

				&[hidden] {
					display: none;
				}

				&[data-animated] {
					transition: block-size 0.2s ease, display 0.2s allow-discrete;

					&[hidden] {
						block-size: 0;
					}

					@starting-style {
						block-size: 0;
					}
				}
			}

			::slotted(mitra-option:not([slot=header])) {
				--mitra-option-nesting: 1.25rem;
			}
		`
	}

	protected override get template() {
		return html`
			<slot name="header" @slotchange=${this.stamp} @disclose=${() => this.toggle()}></slot>
			<div part="options" role="group" ?hidden=${!this.open} ?data-animated=${this.animated}>
				<slot @slotchange=${this.stamp}></slot>
			</div>
		`
	}
}

/** Searches after a typing pause and keeps only the latest query's answer, since an earlier one may arrive after it. */
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
		'mitra-option-tree': OptionTree
	}
}
