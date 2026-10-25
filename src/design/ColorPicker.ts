import { component, html, property, Component, css, event, query } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import './Icon.js'

/** Swatches of the presets and one for any other colour, with a reset back to `resetValue`, where one is given, once another colour is chosen. */
@component('mitra-color-picker')
export class ColorPickerComponent extends Component {
	@event() readonly change!: EventDispatcher<string | undefined>

	@property({ type: String, bindingDefault: true }) value?: string
	@property({ type: Array }) palette = new Array<string>()

	@property({ type: String }) resetValue?: string
	@property({ type: String }) resetLabel = t('Reset to default color')

	@query('input[type=color]') private readonly customInput!: HTMLInputElement

	static override get styles() {
		return css`
			/* Six columns whether or not the reset shows, so it takes the second row's free end and nothing moves. */
			:host {
				display: grid;
				grid-template-columns: repeat(6, auto);
				justify-content: start;
				gap: 0.375rem;
			}

			.swatch {
				all: unset;
				box-sizing: border-box;
				width: 0.875rem;
				height: 0.875rem;
				border-radius: var(--border-radius);
				position: relative;
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

				&.custom:not([data-chosen]) {
					background: conic-gradient(in oklch longer hue, oklch(0.75 0.14 0), oklch(0.75 0.14 360));
				}

				&.reset {
					display: grid;
					place-items: center;
					font-size: 0.75rem;
					color: var(--color-text-muted);

					&:hover {
						color: var(--color-text);
					}
				}
			}

			/* Sized outright: an input keeps its own size inside an inset, and overflowed whatever held the picker. */
			input[type=color] {
				position: absolute;
				inset: 0;
				inline-size: 100%;
				block-size: 100%;
				padding: 0;
				border: 0;
				opacity: 0;
				pointer-events: none;
			}
		`
	}

	/** The colour chosen outside the presets, which the custom swatch then wears. */
	private get customValue() {
		return this.value && !this.palette.includes(this.value) ? this.value : undefined
	}

	protected override get template() {
		return html`
			${this.palette.map(color => html`
				<button class="swatch" aria-label=${color} aria-pressed=${this.value === color}
					style="background: ${color}"
					@click=${() => this.setColor(color)}
				></button>
			`)}
			<button class="swatch custom" aria-label=${t('Custom color')} title=${t('Custom color')}
				aria-pressed=${!!this.customValue} ?data-chosen=${!!this.customValue}
				style=${this.customValue ? `background: ${this.customValue}` : ''}
				@click=${this.openCustom}
			>
				<input type="color" tabindex="-1" .value=${this.customValue ?? this.value ?? '#808080'}
					@input=${() => this.value = this.customInput.value}
					@change=${this.handleCustomChange}
				>
			</button>
			${this.resetValue && this.value && this.value !== this.resetValue ? html`
				<button class="swatch reset" aria-label=${this.resetLabel} title=${this.resetLabel} @click=${() => this.setColor(this.resetValue)}>
					<mitra-icon icon="rotate-ccw"></mitra-icon>
				</button>
			` : html.nothing}
		`
	}

	private readonly openCustom = () => {
		this.customInput.showPicker?.() ?? this.customInput.click()
	}

	private customChangeTimer?: ReturnType<typeof setTimeout>

	/** Chromium fires change for every move in its dialog, so the colour is sent once the moves pause. */
	private readonly handleCustomChange = () => {
		clearTimeout(this.customChangeTimer)
		this.customChangeTimer = setTimeout(() => this.setColor(this.customInput.value), 300)
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
