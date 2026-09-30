import { component, css, event, html, ifDefined, property } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { Control } from './Control.js'
import { disabled } from './disabled.css.js'

/** An on/off switch named by `label`. `--switch-block-size` scales it. */
@component('mitra-switch')
export class Switch extends Control {
	@event() readonly change!: EventDispatcher<boolean>

	@property({ type: Boolean, reflect: true, bindingDefault: true, event: 'change' }) checked = false
	@property({ type: Boolean, reflect: true }) disabled = false
	@property() label?: string

	private toggle() {
		this.checked = !this.checked
		this.change.dispatch(this.checked)
	}

	static override get styles() {
		return css`
			:host {
				--switch-block-size: 1rem;
				display: inline-flex;
				flex-shrink: 0;
				vertical-align: middle;
			}

			:host([hidden]) {
				display: none;
			}

			button {
				all: unset;
				box-sizing: border-box;
				flex-shrink: 0;
				position: relative;
				inline-size: calc(var(--switch-block-size) * 1.75);
				block-size: var(--switch-block-size);
				border: 1px solid transparent;
				border-radius: 1rem;
				background: color-mix(in srgb, currentColor 20%, transparent);
				cursor: pointer;
				transition: background 0.15s ease;

				&::before {
					content: "";
					position: absolute;
					inset-block-start: 1px;
					inset-inline-start: 1px;
					inline-size: calc(var(--switch-block-size) - 4px);
					block-size: calc(var(--switch-block-size) - 4px);
					border-radius: 50%;
					background: currentColor;
					transition: translate 0.15s ease;
				}

				&[aria-checked=true] {
					background: var(--color-accent);

					&::before {
						translate: calc(var(--switch-block-size) * 0.75) 0;
						background: var(--color-accent-text);
					}
				}

				&:dir(rtl)[aria-checked=true]::before {
					translate: calc(var(--switch-block-size) * -0.75) 0;
				}

				&:disabled {
					${disabled};
				}

				${focusRing};
			}
		`
	}

	protected override get template() {
		return html`
			<button part="switch" role="switch" aria-checked=${this.checked} aria-label=${ifDefined(this.label)} ?disabled=${this.disabled}
				@click=${() => this.toggle()}
			></button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-switch': Switch
	}
}
