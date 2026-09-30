import { Component, component, css, html, property, state, type PropertyValues } from '@a11d/lit'
import './Icon.js'

/**
 * A round face: the picture at `src`, else `initial` tinted by `color`, else `icon`. A picture that fails to load
 * falls back as if there were none. `--mitra-avatar-size` sizes it.
 */
@component('mitra-avatar')
export class Avatar extends Component {
	@property() src?: string
	@property() initial?: string
	@property() color?: string
	@property() icon = 'user'

	@state() private broken = false

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		if (changed.has('src')) {
			this.broken = false
		}
	}

	static override get styles() {
		return css`
			:host {
				--_size: var(--mitra-avatar-size, 1.5rem);
				--_color: var(--mitra-avatar-color, var(--color-text));
				flex-shrink: 0;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				inline-size: var(--_size);
				block-size: var(--_size);
				border-radius: 50%;
				overflow: clip;
				font-size: calc(var(--_size) * 0.46);
				font-weight: 650;
				background: color-mix(in srgb, var(--_color) 12%, var(--color-surface));
				color: var(--color-text-muted);
			}

			:host([data-tinted]) {
				background: color-mix(in srgb, var(--_color) 35%, var(--color-surface));
				color: color-mix(in srgb, var(--_color) 60%, var(--color-text));
			}

			img {
				inline-size: 100%;
				block-size: 100%;
				object-fit: cover;
			}

			mitra-icon {
				font-size: calc(var(--_size) * 0.5);
			}
		`
	}

	protected override updated() {
		this.toggleAttribute('data-tinted', !!this.color && !this.showsPicture)
		this.style.setProperty('--mitra-avatar-color', this.color ?? null)
	}

	private get showsPicture() {
		return !!this.src && !this.broken
	}

	protected override get template() {
		return this.showsPicture
			? html`<img src=${this.src!} alt="" referrerpolicy="no-referrer" @error=${() => this.broken = true}>`
			: this.initial
				? html`${this.initial}`
				: html`<mitra-icon icon=${this.icon}></mitra-icon>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-avatar': Avatar
	}
}
