import { Component, component, html, css, property, ifDefined } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'

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

				/* On a touch screen an icon button is a TARGET, not just a glyph, so it takes a floor size
				   there — its natural box is ~26px, which is nothing to hit with a finger. Zero on a precise
				   pointer, where the glyph's own box is target enough, and zero wherever an icon button is
				   embedded in dense content a square that size would burst (see the task checkbox inside a
				   grid segment, which opts out). Deliberately smaller than the shared control height
				   (controlHeight.css.ts) — mix that in and read var(--control-height) here to make icon
				   buttons exactly as tall as every other control on touch. */
				--icon-button-size: 0;
				@media (pointer: coarse) {
					--icon-button-size: 2rem;
				}

				> button {
					all: unset;
					display: flex;
					align-items: center;
					justify-content: center;
					box-sizing: border-box;
					min-inline-size: var(--icon-button-size);
					min-block-size: var(--icon-button-size);
					padding: 0.25rem;
					border-radius: var(--border-radius);
					color: currentColor;
					opacity: 0.9;
					font-size: inherit;
					cursor: pointer;
					transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
					border: 1px solid transparent;

					&:hover {
						opacity: 1;
						${activated};
					}

					/* The shared ring (focusRing.css.ts) plus this button's own hover surface, so a
					   keyboard-focused icon button reads exactly like a focused field. */
					&:focus-visible {
						opacity: 1;
						${activated};
					}

					${focusRing};
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
