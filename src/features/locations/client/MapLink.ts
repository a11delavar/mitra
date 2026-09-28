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

				&[data-empty] {
					visibility: hidden;
					pointer-events: none;
				}

				> a {
					display: inline-flex;
					padding: 2px;
					border-radius: var(--border-radius);
					color: var(--color-text-muted);
					font-size: 0.87rem;
					transition: color 0.15s ease, background 0.15s ease;

					&:hover {
						color: var(--color-text);
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.location)}"
				target="_blank" rel="noopener noreferrer" title=${t('Open in Google Maps')} aria-label=${t('Open in Google Maps')}>
				<mitra-icon icon="map"></mitra-icon>
			</a>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-map-link': MapLink
	}
}
