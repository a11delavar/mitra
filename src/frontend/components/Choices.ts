import { Component, component, css, html, property, eventListener } from '@a11d/lit'
import { activated } from './activated.css.js'
import { focusRing } from './focusRing.css.js'

/**
 * A row of decision cards — one centred glyph over a short label per behaviour — for the dialogs that
 * ask WHICH WAY to carry an action out. Picking a card IS the answer, so such a dialog carries no
 * confirm button. Never write a single card: the narrow way is always spelled out beside the wide one
 * rather than left as an unticked box. Mark the likeliest card `autofocus` — it takes focus when the
 * row appears, and is therefore what Enter picks.
 *
 * ```html
 * <mitra-choices>
 *     <mitra-choice autofocus icon="calendar" @click=${…}>${t('This entry')}</mitra-choice>
 *     <mitra-choice icon="repeat" @click=${…}>${t('All entries')}</mitra-choice>
 * </mitra-choices>
 * ```
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
 * One card in a {@link Choices} row: the caller's own children are its label, so the element IS the
 * control rather than wrapping one — a light-DOM component cannot slot, and a label sitting outside
 * the button it belongs to is neither hoverable as one piece nor readable as one to a screen reader.
 * Hence the button semantics by hand: the role, the tab stop, and Enter/Space.
 */
@component('mitra-choice')
export class Choice extends Component {
	@property() icon!: string

	protected override createRenderRoot() { return this }

	protected override connected() {
		this.setAttribute('role', 'button')
		this.tabIndex = 0
	}

	/** The default card claims focus as soon as its row renders — including the second question of a
	 * two-step dialog, which no dialog-opening focus step would reach. */
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
				/* Equal columns while they fit on one line, whole rows once they don't. */
				flex: 1 1 7.5rem;
				min-inline-size: 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				/* Content starts at the top, so the glyphs stay on one line across the row however many
				   lines each label takes. The cards themselves stretch to the tallest one. */
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
					/* The label is the caller's, so it is already in the element when this renders its
					   glyph after it — the visual order is the layout's business, not the DOM's. */
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

				/* The ring withholds its colour until a key is pressed (focusRing.css.ts) and paints the
				   border with it — which would rub the card's own edge out while it merely holds focus,
				   as the default card does from the moment the dialog opens. */
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
