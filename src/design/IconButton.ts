import { component, css, html, property } from '@a11d/lit'
import { Button, type ButtonVariant } from './Button.js'

/**
 * A square button showing only a glyph; `label` names it and is its tooltip. It sizes its glyph itself, so
 * every icon button in the app is one of two sizes: the control height, or `small` for actions inside dense rows.
 * `--mitra-glyph-inset` reads how far the glyph sits inside the box, for rows aligning glyphs rather than boxes.
 */
@component('mitra-icon-button')
export class IconButton extends Button {
	@property() icon!: string
	@property({ reflect: true }) override variant: ButtonVariant = 'plain'
	@property({ reflect: true }) size?: 'small'

	static override get styles() {
		return css`
			${super.styles}

			:host {
				--_size: var(--control-height);
				--_glyph: 1.125rem;
				--mitra-glyph-inset: calc((var(--_size) - var(--_glyph)) / 2);
				color: inherit;
			}

			:host([size=small]) {
				--_size: 1.5rem;
				--_glyph: 0.9375rem;

				@media (pointer: coarse) {
					--_size: 2rem;
				}
			}

			[part=button] {
				flex: none;
				inline-size: var(--_size);
				block-size: var(--_size);
				min-block-size: 0;
				padding: 0;
			}

			:host([variant=plain]) [part=button] {
				opacity: 0.85;

				&:is(:hover, :focus-visible) {
					opacity: 1;
				}
			}

			mitra-icon {
				font-size: var(--_glyph);
			}
		`
	}

	protected override get content() {
		return html`<mitra-icon part="icon" icon=${this.icon}></mitra-icon>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-icon-button': IconButton
	}
}
