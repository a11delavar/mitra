import { Component, component, html, css, property, ifDefined } from '@a11d/lit'
import { outlineStyles } from './outlineStyles.js'

@component('mitra-icon-button')
export class IconButton extends Component {
	@property() icon!: string
	@property() label?: string

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-icon-button {
				display: inline-flex;
				font-size: 1rem;

				> button {
					all: unset;
					display: flex;
					align-items: center;
					justify-content: center;
					box-sizing: border-box;
					padding: 0.25rem;
					border-radius: var(--border-radius);
					color: var(--color-text-muted);
					font-size: inherit;
					cursor: pointer;
					transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
					border: 1px solid transparent;

					&:hover {
						color: var(--color-text);
						background: color-mix(in srgb, var(--color-text) 8%, transparent);
					}

					${outlineStyles}

					&:focus-visible {
						outline: none;
						color: var(--color-text);
						background: color-mix(in srgb, var(--color-text) 8%, transparent);
						box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 45%, transparent);
						border: 1px solid var(--color-accent);
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<button aria-label=${ifDefined(this.label)} title=${ifDefined(this.label)}>
				<mitra-icon icon=${this.icon}></mitra-icon>
			</button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-icon-button': IconButton
	}
}
