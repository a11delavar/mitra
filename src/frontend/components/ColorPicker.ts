import { component, html, property, Component, css, event } from '@a11d/lit'
import { Color } from 'shared'

@component('mitra-color-picker')
export class ColorPickerComponent extends Component {
	@event() readonly change!: EventDispatcher<string | undefined>

	@property({ type: String, bindingDefault: true }) value?: string

	@property({ type: String }) resetValue?: string
	@property({ type: String }) resetLabel = 'Reset to default color'

	static override get styles() {
		return css`
			:host {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}

			.swatch {
				width: 0.875rem;
				height: 0.875rem;
				border-radius: var(--border-radius);
				border: none;
				cursor: pointer;
				padding: 0;
				position: relative;
				transition: transform 0.1s;
				flex-shrink: 0;

				&:hover {
					transform: scale(1.15);
				}
				&.selected::after {
					content: '';
					position: absolute;
					inset: -3px;
					border: 2px solid var(--color-text);
					border-radius: calc(var(--border-radius) + 2px);
				}
			}

			.reset {
				background: none;
				border: none;
				color: var(--color-text-muted);
				cursor: pointer;
				padding: 0.125rem;
				margin-inline-start: 0.25rem;
				border-radius: var(--border-radius);
				display: flex;
				align-items: center;
				justify-content: center;

				&:hover {
					color: var(--color-text);
					background: rgba(255, 255, 255, 0.08);
				}

				mitra-icon {
					font-size: 0.875rem;
				}
			}
		`
	}

	protected override get template() {
		return html`
			${Color.palette.map(color => html`
				<button
					class="swatch ${this.value === color ? 'selected' : ''}"
					style="background: ${color}"
					@click=${() => this.setColor(color)}
				></button>
			`)}
			${this.value && this.value !== this.resetValue ? html`
				<button class="reset" title=${this.resetLabel} @click=${() => this.setColor(this.resetValue)}>
					<mitra-icon icon="rotate-ccw"></mitra-icon>
				</button>
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
