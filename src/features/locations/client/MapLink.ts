import { Component, component, html, css, property, type PropertyValues } from '@a11d/lit'

/** Opens a location in Google Maps. Without a location it keeps its place but shows nothing. */
@component('mitra-map-link')
export class MapLink extends Component {
	@property() location = ''

	protected override createRenderRoot() { return this }

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		this.toggleAttribute('data-empty', !this.location.trim())
	}

	static override get styles() {
		return css`
			mitra-map-link {
				display: inline-flex;
				align-self: center;
				color: var(--color-text-muted);

				&[data-empty] {
					visibility: hidden;
					pointer-events: none;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-icon-button size="small" icon="map" label=${t('Open in Google Maps')} target="_blank"
				href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.location)}"
			></mitra-icon-button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-map-link': MapLink
	}
}
