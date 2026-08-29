import { Component, component, css, html, property, eventListener } from '@a11d/lit'
import { activated } from './activated.css.js'
import { focusRing } from './focusRing.css.js'

/**
 * Container component for interactive decision cards.
 */
@component('mitra-choices')
export class Choices extends Component {
	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-choices {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
			}
		`
	}
}

/**
 * Individual decision card with icon and label for choice dialogs.
 */
@component('mitra-choice')
export class Choice extends Component {
	@property() icon!: string

	protected override createRenderRoot() { return this }

	protected override connected() {
		this.setAttribute('role', 'button')
		this.tabIndex = 0
	}

	protected override initialized() {
		if (this.autofocus) {
			this.focus()
		}
	}

	@eventListener('keydown')
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			this.click()
		}
	}

	protected override get template() {
		return html`<mitra-icon icon=${this.icon}></mitra-icon>`
	}

	static override get styles() {
		return css`
			mitra-choice {
				box-sizing: border-box;
				flex: 1 1 7.5rem;
				min-inline-size: 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: flex-start;
				gap: 0.625rem;
				padding: 1rem 0.75rem;
				--choice-border: color-mix(in srgb, var(--color-text) 8%, transparent);
				border: 1px solid var(--choice-border);
				border-radius: var(--border-radius);
				font-size: 0.8125rem;
				font-weight: 500;
				line-height: 1.35;
				text-align: center;
				text-wrap: balance;
				color: var(--color-text);
				cursor: pointer;
				user-select: none;
				transition: all 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);

				> mitra-icon {
					order: -1;
					font-size: 1.375rem;
				}

				&:hover {
					${activated};
					border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);

					> mitra-icon {
						color: var(--color-text);
					}
				}

				&:active {
					background: color-mix(in srgb, var(--color-text) 14%, transparent);
					transition-duration: 0.05s;
				}

				${focusRing};

				&:focus-visible {
					border-color: var(--focus-ring-color, var(--choice-border));
				}
			}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-choices': Choices
		'mitra-choice': Choice
	}
}
