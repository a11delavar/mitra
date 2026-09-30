import { component, css, event, html, ifDefined, live, property, query, unsafeCSS } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { Control } from './Control.js'
import { disabled } from './disabled.css.js'

const tick = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'3.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'20 6 9 17 4 12\'/%3E%3C/svg%3E") center / contain no-repeat'
const dash = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'3.5\' stroke-linecap=\'round\'%3E%3Cline x1=\'6\' y1=\'12\' x2=\'18\' y2=\'12\'/%3E%3C/svg%3E") center / contain no-repeat'

/** A checkbox, labelled by its content or by `label`. */
@component('mitra-checkbox')
export class Checkbox extends Control {
	/** A native `change` stops at the shadow root, so the host fires its own, carrying the new state. */
	@event() readonly change!: EventDispatcher<boolean>

	@property({ type: Boolean, reflect: true, bindingDefault: true, event: 'change' }) checked = false
	@property({ type: Boolean }) indeterminate = false
	@property({ type: Boolean, reflect: true }) disabled = false
	@property() label?: string

	@query('input') private readonly input?: HTMLInputElement

	override click() {
		this.input?.click()
	}

	// The box has already flipped when its click is dispatched, so a listener on the host reads the new state.
	private readonly sync = () => {
		this.checked = this.input?.checked ?? this.checked
		this.indeterminate = false
	}

	static override get styles() {
		return css`
			:host {
				display: inline-flex;
				vertical-align: middle;
			}

			label {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				cursor: pointer;
			}

			input {
				display: inline-grid;
				appearance: none;
				box-sizing: border-box;
				flex-shrink: 0;
				inline-size: 1.125rem;
				block-size: 1.125rem;
				margin: 0;
				padding: 0;
				border: 1px solid transparent;
				border-radius: var(--border-radius);
				background: color-mix(in srgb, var(--color-text) 6%, transparent);
				place-content: center;
				cursor: pointer;
				outline: none;
				transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

				&::before {
					content: "";
					inline-size: 0.8rem;
					block-size: 0.8rem;
					transform: scale(0);
					transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.4);
					background-color: var(--color-accent-text);
					-webkit-mask: ${unsafeCSS(tick)};
					mask: ${unsafeCSS(tick)};
				}

				&:is(:checked, :indeterminate) {
					background: var(--color-accent);
					border-color: var(--color-accent);

					&::before {
						transform: scale(1.1);
					}
				}

				&:indeterminate::before {
					-webkit-mask: ${unsafeCSS(dash)};
					mask: ${unsafeCSS(dash)};
				}

				${focusRing};

				&:disabled {
					${disabled};
				}
			}
		`
	}

	protected override get template() {
		return html`
			<label part="label">
				<input type="checkbox" part="checkbox" aria-label=${ifDefined(this.label)} ?disabled=${this.disabled}
					.checked=${live(this.checked)} .indeterminate=${live(this.indeterminate)}
					@click=${this.sync}
					@change=${() => this.change.dispatch(this.checked)}
				>
				<slot></slot>
			</label>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-checkbox': Checkbox
	}
}
