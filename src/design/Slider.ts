import { component, css, event, html, ifDefined, live, property, unsafeCSS } from '@a11d/lit'
import { ring } from './focusRing.css.js'
import { Control } from './Control.js'

/** A plain accent knob; a halo of its own colour grows on hover and while dragging. */
const thumb = unsafeCSS`
	box-sizing: border-box;
	inline-size: 0.875rem;
	block-size: 0.875rem;
	border: none;
	border-radius: 50%;
	background: var(--color-accent);
	box-shadow: 0 0 0 var(--_halo, 0) color-mix(in srgb, var(--color-accent) 22%, transparent);
	cursor: grab;
	transition: box-shadow 0.15s ease;
`

/** A range slider. `input` fires while dragging with `value` already current; `change` on release. */
@component('mitra-slider')
export class Slider extends Control {
	/** A native `change` stops at the shadow root, so the host fires its own. */
	@event() readonly change!: EventDispatcher<number>

	@property({ type: Number, bindingDefault: true, event: 'change' }) value = 0
	@property({ type: Number }) min = 0
	@property({ type: Number }) max = 100
	@property({ type: Number }) step = 1
	@property() label?: string

	private get percent() {
		return this.max === this.min ? 0 : (this.value - this.min) / (this.max - this.min) * 100
	}

	static override get styles() {
		return css`
			:host {
				display: block;
			}

			input {
				appearance: none;
				display: block;
				inline-size: 100%;
				block-size: 1.25rem;
				margin: 0;
				padding: 0;
				background: transparent;
				border: 1px solid transparent;
				border-radius: 999px;
				cursor: pointer;
				outline: none;
				--_track: linear-gradient(to right,
					var(--color-accent) var(--_percent),
					color-mix(in srgb, var(--color-text) 15%, transparent) var(--_percent));

				&:dir(rtl) {
					--_track: linear-gradient(to left,
						var(--color-accent) var(--_percent),
						color-mix(in srgb, var(--color-text) 15%, transparent) var(--_percent));
				}

				&::-webkit-slider-runnable-track {
					block-size: 0.25rem;
					border-radius: 999px;
					background: var(--_track);
				}

				&::-moz-range-track {
					block-size: 0.25rem;
					border-radius: 999px;
					background: var(--_track);
				}

				/* The two engines' thumbs cannot share a selector list: one unknown pseudo-element drops the whole rule. */
				&::-webkit-slider-thumb {
					${thumb};
					appearance: none;
					margin-block-start: calc((0.25rem - 0.875rem) / 2);
				}

				&::-moz-range-thumb {
					${thumb};
				}

				&:hover::-webkit-slider-thumb { --_halo: 0.25rem; }
				&:hover::-moz-range-thumb { --_halo: 0.25rem; }
				&:active::-webkit-slider-thumb { --_halo: 0.375rem; cursor: grabbing; }
				&:active::-moz-range-thumb { --_halo: 0.375rem; cursor: grabbing; }
				&:focus-visible::-webkit-slider-thumb { ${ring}; }
				&:focus-visible::-moz-range-thumb { ${ring}; }
			}
		`
	}

	protected override get template() {
		return html`
			<input type="range" part="slider" aria-label=${ifDefined(this.label)}
				min=${this.min} max=${this.max} step=${this.step} .value=${live(String(this.value))}
				style="--_percent: ${this.percent}%"
				@input=${(e: Event) => this.value = Number((e.target as HTMLInputElement).value)}
				@change=${() => this.change.dispatch(this.value)}
			>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-slider': Slider
	}
}
