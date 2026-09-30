import { Component, component, css, html, property, styleMap } from '@a11d/lit'

/** A progress bar: `value` between 0 and 1, or no value while the amount is unknown. */
@component('mitra-progress')
export class Progress extends Component {
	@property({ type: Number }) value?: number

	override role = 'progressbar'

	protected override updated() {
		this.ariaValueMin = '0'
		this.ariaValueMax = '100'
		this.ariaValueNow = this.value === undefined ? null : String(Math.round(this.value * 100))
	}

	static override get styles() {
		return css`
			@keyframes indeterminate {
				from { translate: -100%; }
				to { translate: 400%; }
			}

			:host {
				display: block;
				block-size: 0.25rem;
				border-radius: 999px;
				background: color-mix(in srgb, var(--color-text) 12%, transparent);
				overflow: clip;
			}

			[part=bar] {
				block-size: 100%;
				border-radius: inherit;
				background: var(--color-accent);
				transition: inline-size 0.2s ease;

				&[data-indeterminate] {
					inline-size: 25%;
					animation: indeterminate 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite;

					@media (prefers-reduced-motion: reduce) {
						inline-size: 100%;
						opacity: 0.35;
						animation: none;
					}
				}
			}
		`
	}

	protected override get template() {
		const indeterminate = this.value === undefined
		return html`
			<div part="bar" ?data-indeterminate=${indeterminate}
				style=${styleMap({ inlineSize: indeterminate ? undefined : `${Math.min(1, Math.max(0, this.value!)) * 100}%` })}
			></div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-progress': Progress
	}
}
