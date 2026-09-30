import { component, html, property, Component, css, event } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import './IconButton.js'

/** A row of colour swatches, with a reset back to `resetValue` once another colour is chosen. */
@component('mitra-color-picker')
export class ColorPickerComponent extends Component {
	@event() readonly change!: EventDispatcher<string | undefined>

	@property({ type: String, bindingDefault: true }) value?: string
	@property({ type: Array }) palette = new Array<string>()

	@property({ type: String }) resetValue?: string
	@property({ type: String }) resetLabel = t('Reset to default color')

	static override get styles() {
		return css`
			:host {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}

			.swatch {
				all: unset;
				box-sizing: border-box;
				width: 0.875rem;
				height: 0.875rem;
				border-radius: var(--border-radius);
				position: relative;
				flex-shrink: 0;
				cursor: pointer;
				transition: transform 0.1s;
				${focusRing};

				&:hover {
					transform: scale(1.15);
				}

				&[aria-pressed=true]::after {
					content: '';
					position: absolute;
					inset: -3px;
					border: 2px solid var(--color-text);
					border-radius: calc(var(--border-radius) + 2px);
				}
			}

			mitra-icon-button {
				color: var(--color-text-muted);
			}
		`
	}

	protected override get template() {
		return html`
			${this.palette.map(color => html`
				<button class="swatch" aria-label=${color} aria-pressed=${this.value === color}
					style="background: ${color}"
					@click=${() => this.setColor(color)}
				></button>
			`)}
			${this.value && this.value !== this.resetValue ? html`
				<mitra-icon-button size="small" icon="rotate-ccw" label=${this.resetLabel} @click=${() => this.setColor(this.resetValue)}></mitra-icon-button>
			` : html.nothing}
		`
	}

	private setColor(color: string | undefined) {
		this.value = color
		this.change.dispatch(color)
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-color-picker': ColorPickerComponent
	}
}
