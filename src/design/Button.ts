import { component, css, html, ifDefined, property, query, type HTMLTemplateResult } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'
import { Control } from './Control.js'
import { disabled } from './disabled.css.js'
import { selected } from './selected.css.js'

export type ButtonVariant = 'default' | 'primary' | 'plain' | 'danger'

/**
 * A button, or with `href` a link that looks like one. `popoverTarget` makes it the popover's invoker,
 * so the popover anchors to it implicitly and a press while open closes it rather than reopening it;
 * `mitra-popover-container` sets it.
 */
@component('mitra-button')
export class Button extends Control {
	@property({ reflect: true }) variant: ButtonVariant = 'default'
	@property({ type: Boolean, reflect: true }) disabled = false
	@property() href?: string
	@property() target?: string
	/** The accessible name, and the tooltip unless the host carries a `title` of its own. */
	@property() label?: string
	/** Makes it a toggle, announced as pressed or not and tinted while pressed; left out, it is a plain button. */
	@property({ type: Boolean, reflect: true }) pressed?: boolean
	/** The popover this button toggles: the element, or its id in this button's tree. */
	@property({ type: Object }) popoverTarget?: HTMLElement | string
	@property() popoverTargetAction?: 'toggle' | 'show' | 'hide'

	/** The native control inside, for what must point at it: a popover's anchor, a menu's trigger. */
	@query('[part=button]') readonly control?: HTMLButtonElement | HTMLAnchorElement

	/** Forwards to the rendered control, so its own activation (a link, a popover) runs too. */
	override click() {
		this.control?.click()
	}

	/** Resolved at press time: an id may name an element rendered after this button, or one that was replaced since. */
	private readonly invoke = (event: Event) => {
		if (this.disabled) {
			event.stopImmediatePropagation()
			event.preventDefault()
			return
		}
		const target = typeof this.popoverTarget === 'string'
			? (this.getRootNode() as Document | ShadowRoot).getElementById(this.popoverTarget)
			: this.popoverTarget
		if (this.control instanceof HTMLButtonElement) {
			this.control.popoverTargetElement = target ?? null
			this.control.popoverTargetAction = this.popoverTargetAction ?? 'toggle'
		}
	}

	static override get styles() {
		return css`
			:host {
				display: inline-flex;
				vertical-align: middle;
				${controlHeight};
				font-size: 0.8125rem;
				font-weight: 500;
				color: var(--color-text);
			}

			:host([hidden]) {
				display: none;
			}

			[part=button] {
				all: unset;
				box-sizing: border-box;
				flex: 1;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 0.375rem;
				min-block-size: var(--control-height);
				padding-block: 0;
				padding-inline: 0.75rem;
				border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
				border-radius: var(--border-radius);
				background: color-mix(in srgb, var(--color-text) 5%, transparent);
				color: inherit;
				font: inherit;
				white-space: nowrap;
				cursor: pointer;
				transition: background 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;

				&:hover {
					background: color-mix(in srgb, var(--color-text) 9%, transparent);
				}

				&:active {
					background: color-mix(in srgb, var(--color-text) 14%, transparent);
					transition-duration: 0.05s;
				}

				${focusRing};

				&:disabled {
					${disabled};
					background: color-mix(in srgb, var(--color-text) 5%, transparent);
				}
			}

			::slotted(mitra-icon) {
				font-size: 1rem;
			}

			:host([variant=primary]) [part=button] {
				border-color: transparent;
				background: var(--color-accent);
				color: var(--color-accent-text);
				font-weight: 600;

				&:hover {
					background: color-mix(in srgb, var(--color-accent) 88%, var(--color-background));
				}

				&:active {
					background: color-mix(in srgb, var(--color-accent) 78%, var(--color-background));
				}

				&:disabled {
					background: var(--color-accent);
				}
			}

			:host([variant=plain]) [part=button] {
				border-color: transparent;
				background: transparent;

				&:hover {
					${activated};
				}

				&:active {
					background: color-mix(in srgb, var(--color-text) 10%, transparent);
				}

				&:disabled {
					background: transparent;
				}
			}

			:host([pressed]) [part=button] {
				&, &:hover {
					${selected};
				}
			}

			:host([variant=danger]) {
				color: var(--color-error);
			}
		`
	}

	/** What the control holds. */
	protected get content(): HTMLTemplateResult {
		return html`<slot></slot>`
	}

	protected get tooltip() {
		return this.title || this.label
	}

	protected override get template() {
		return this.href && !this.disabled ? html`
			<a part="button" href=${this.href} target=${ifDefined(this.target)} rel=${ifDefined(this.target === '_blank' ? 'noopener noreferrer' : undefined)}
				aria-label=${ifDefined(this.label)} title=${ifDefined(this.tooltip)}
			>${this.content}</a>
		` : html`
			<button part="button" ?disabled=${this.disabled} aria-label=${ifDefined(this.label)} title=${ifDefined(this.tooltip)}
				aria-pressed=${ifDefined(this.pressed === undefined ? undefined : String(this.pressed))}
				@click=${{ handleEvent: this.invoke, capture: true }}
			>${this.content}</button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-button': Button
	}
}
