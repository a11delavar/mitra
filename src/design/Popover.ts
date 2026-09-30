import { Component, component, css, event, eventListener, html, property, type PropertyValues } from '@a11d/lit'
import { MediaQueryController } from '@3mo/media-query-observer'
import { Button } from './Button.js'
import { surface, surfaceColor } from './surface.css.js'
import { fieldChromeRestored } from './fieldChrome.css.js'
import './ModalSheet.js'

/**
 * The last rung of an anchored popover with no room around its anchor: the middle of the viewport, anchored to
 * nothing, as a dialog would be. A tree-scoped name, so every stylesheet naming it declares it.
 */
export const centered = css`
	@position-try --centered {
		position-anchor: none;
		position-area: none;
		inset: 0.75rem;
		margin: 0;
		place-self: center;
	}
`

/**
 * A floating panel, and its own popover. In a `mitra-popover-container` its trigger opens it; elsewhere
 * `show(anchor)` opens it at any element. Being the popover itself, a context places it with plain CSS on the
 * element, as a field does to open its pickers beside the row. Anchored where there is room, centered where there is
 * none (`--centered`, which a context's fallbacks end on too), and with `sheet` a modal sheet on a narrow screen: its
 * content is slotted, so it moves between the two without being rebuilt.
 */
@component('mitra-popover')
export class Popover extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>

	@property({ type: Boolean, reflect: true }) open = false
	/** The control that opens it, as its container pairs them: where it anchors, and where focus returns. */
	@property({ type: Object }) trigger?: HTMLElement
	/** Presents it as a modal sheet on the block-end edge where the screen is narrow. */
	@property({ type: Boolean }) sheet = false

	private readonly narrow = new MediaQueryController(this, '(width < 40rem)', () => this.present())
	private anchor?: HTMLElement

	/** Whether it shows as a sheet: opted in, on a narrow screen. */
	get sheeted() {
		return this.sheet && this.narrow.matches
	}

	/** Its `popover` attribute: light-dismissed by default; `null` for one that lies in flow. */
	protected get popoverType(): 'auto' | 'manual' | null {
		return 'auto'
	}

	protected override connected() {
		this.present()
		// A view that moves the popover in the document (a month view re-parenting a segment) closes it without a
		// toggle event; it is still meant to be open.
		requestAnimationFrame(() => this.reshow())
	}

	private reshow() {
		if (this.isConnected && this.open && this.popover && !this.matches(':popover-open')) {
			this.showPopover({ source: this.anchor ?? this.trigger })
		}
	}

	// The popover role is given up while it is a sheet, whose dialog carries the content instead; switching while
	// open carries the openness over.
	private present() {
		const type = this.sheeted ? null : this.popoverType
		this.toggleAttribute('data-sheet', this.sheeted)
		if (this.popover !== type) {
			if (this.popover && this.matches(':popover-open')) {
				this.hidePopover()
			}
			this.popover = type
			requestAnimationFrame(() => this.reshow())
		}
		this.requestUpdate()
	}

	// A press on the trigger of an open popover can close it before its click toggles it: focus leaving a menu
	// closes it, and the invoker's click then opened it again. That click's reopening is cancelled.
	private pressedOpen = false

	private readonly handleTriggerPointerDown = () => {
		this.pressedOpen = this.matches(':popover-open')
		addEventListener('click', () => setTimeout(() => this.pressedOpen = false), { capture: true, once: true })
	}

	protected override updated(changed: PropertyValues<this>) {
		if (changed.has('trigger')) {
			(changed.get('trigger') as HTMLElement | undefined)?.removeEventListener('pointerdown', this.handleTriggerPointerDown)
			this.trigger?.addEventListener('pointerdown', this.handleTriggerPointerDown)
		}
	}

	@eventListener('beforetoggle')
	protected handleBeforeToggle(e: ToggleEvent) {
		if (e.newState === 'open' && this.pressedOpen) {
			this.pressedOpen = false
			e.preventDefault()
		}
	}

	show(anchor?: HTMLElement) {
		this.anchor = anchor ?? this.anchor
		if (this.sheeted) {
			this.setOpen(true)
		} else if (!this.matches(':popover-open')) {
			this.showPopover({ source: anchor ?? this.trigger })
		}
	}

	hide() {
		if (this.sheeted) {
			this.setOpen(false)
		} else if (this.matches(':popover-open')) {
			this.hidePopover()
		}
	}

	toggle(anchor?: HTMLElement) {
		if (this.open) {
			this.hide()
		} else {
			this.show(anchor)
		}
	}

	private setOpen(open: boolean) {
		if (open !== this.open) {
			this.open = open
			if (open) {
				this.opened(this.anchor)
			}
			this.openChange.dispatch(open)
		}
	}

	/** The element that opened it: its invoker, or the anchor it was shown at. */
	protected opened(_source?: HTMLElement) { }

	@eventListener('toggle')
	protected handleToggle(e: ToggleEvent) {
		// A popover turning into a sheet hides itself; the sheet, not that toggle, now says whether it is open.
		if (!this.popover) {
			return
		}
		const open = e.newState === 'open'
		if (open) {
			this.opened(e.source instanceof HTMLElement ? e.source : undefined)
		}
		if (open !== this.open) {
			this.open = open
			this.openChange.dispatch(open)
		}
	}

	static override get styles() {
		return css`
			${centered}

			:host {
				${surface};
				${fieldChromeRestored};
				box-sizing: border-box;
				margin: 0.25rem 0;
				padding: 0.5rem;
				inset: auto;
				position-area: block-end span-inline-end;
				position-try-fallbacks: flip-block, flip-inline, --centered;
				outline: none;
			}

			/* A sheet's dialog carries the content; the host adds nothing where it stands. */
			:host([data-sheet]) {
				display: contents;
			}

			/* The sheet wears the popover's glass over the page's ground, its handle included. */
			mitra-modal-sheet::part(panel) {
				background: linear-gradient(${surfaceColor}, ${surfaceColor}) var(--color-background);
			}
		`
	}

	protected override get template() {
		return !this.sheeted ? html`<slot></slot>` : html`
			<mitra-modal-sheet placement="block-end" ?open=${this.open}
				@openChange=${(e: CustomEvent<boolean>) => this.setOpen(e.detail)}
			>
				<slot></slot>
			</mitra-modal-sheet>
		`
	}
}

/**
 * A trigger and the popover it opens: the first element in it, and the popover (a `mitra-popover`, a
 * `mitra-menu`) slotted as `popover`. It makes the trigger the popover's invoker, so the popover anchors to it
 * and a press while open closes it, and it adds nothing to the layout: the trigger stays where it was.
 */
@component('mitra-popover-container')
export class PopoverContainer extends Component {
	private get trigger() {
		return [...this.children].find(child => !child.slot) as HTMLElement | undefined
	}

	private get panel() {
		return [...this.children].find(child => child.slot === 'popover' && child instanceof Popover) as Popover | undefined
	}

	private readonly pair = async () => {
		const { trigger, panel: popover } = this
		if (!trigger || !popover) {
			return
		}
		if (trigger instanceof Button) {
			trigger.popoverTarget = popover
			await trigger.updateComplete
			popover.trigger = trigger.control
		} else {
			if (trigger instanceof HTMLButtonElement) {
				trigger.popoverTargetElement = popover
			}
			popover.trigger = trigger
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
			<slot @slotchange=${this.pair}></slot>
			<slot name="popover" @slotchange=${this.pair}></slot>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-popover': Popover
		'mitra-popover-container': PopoverContainer
	}
}
