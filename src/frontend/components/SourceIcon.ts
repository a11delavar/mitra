import { Component, component, html, css, property } from '@a11d/lit'
import { SourceType, type Source } from 'shared'
import { colorContrast } from './colorContrast.js'

/**
 * The one icon that stands for a source, wherever a source is named: its KIND — events or tasks — drawn
 * in the source's own colour. There is deliberately no separate colour chip beside it. Two icons for one
 * thing made them compete for the same rail, pushed every label deep to the right, and — because each
 * place that named a source paired them its own way — had already drifted into two different-looking
 * versions of the same idea. Anything that names a source uses THIS, so that can't happen again.
 *
 * One place can't: `<selectedcontent>`, which draws a customizable `<select>`'s chosen option by CLONING
 * that option's DOM — and a clone carries no JS properties, so an icon inside an `<option>` renders
 * kindless and colourless there. Whoever needs a closed picker to show the icon renders its own instead
 * of relying on the clone (see the entry popover's source row).
 */
@component('mitra-source-icon')
export class SourceIcon extends Component {
	@property({ type: Object }) source?: Source

	/**
	 * Outline the icon and keep its glyph in full colour. Reserved for standing FOR the source — the
	 * sidebar's default for new entries. A picker's current option is already marked as chosen by the
	 * picker itself, so marking it here too would say the same thing twice.
	 */
	@property({ type: Boolean, reflect: true }) selected = false

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-source-icon {
				--mitra-source-icon-color: var(--color-text);
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				/* Never stretch to a shared column: the entry popover's icon gutter is as wide as the widest
				   thing in it (a toggle switch), and a stretched mark would centre its glyph in that width
				   instead of starting where the row's other glyphs start. */
				justify-self: start;
				font-size: 1rem;
				color: var(--mitra-source-icon-color);
				border-radius: var(--border-radius);
				padding: 0.2rem;

				&[selected] {
					background: var(--mitra-source-icon-color);
					color: ${colorContrast('var(--mitra-source-icon-color)')};

					mitra-icon {
						transform: scale(0.9);
					}
				}
			}
		`
	}

	protected override get template() {
		// The colour reaches CSS as a custom property so the glyph and the outline read from one value,
		// rather than each caller styling the icon itself.
		this.style.setProperty('--mitra-source-icon-color', this.source?.color ?? '')
		return html`<mitra-icon icon=${this.source?.type === SourceType.Task ? 'list-todo' : 'calendar'}></mitra-icon>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-source-icon': SourceIcon
	}
}
