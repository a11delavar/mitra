import { Component, component, html, css, property } from '@a11d/lit'
import { type Source } from '../Source.js'
import { EntryType } from '../../entries/EntryType.js'
import { getIntegrationFor } from '../../../infrastructure/http/Api.js'
import { contrastColor } from '../../../design/contrastColor.js'

/**
 * Renders the domain icon for a source in its assigned color.
 * Displays calendar/task icons based on supported entry types, or a custom provider icon.
 */
@component('mitra-source-icon')
export class SourceIcon extends Component {
	/** Source model instance for type-based icon resolution. */
	@property({ type: Object }) source?: Source

	/** Outline the icon in full color (used for default source selection). */
	@property({ type: Boolean, reflect: true }) selected = false

	/** Provider icon override for unpersisted source rows in connect dialogs. */
	@property({ type: String }) icon?: string

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-source-icon {
				--mitra-source-icon-color: var(--color-text);
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				justify-self: start;
				font-size: 1rem;
				color: var(--mitra-source-icon-color);
				border-radius: var(--border-radius);
				padding: 0.2rem;

				&[selected] {
					background: var(--mitra-source-icon-color);
					color: ${contrastColor('var(--mitra-source-icon-color)')};

					mitra-icon {
						transform: scale(0.9);
					}
				}

				&[importing] mitra-icon {
					animation: mitra-source-icon-spin 1.1s linear infinite;

					@media (prefers-reduced-motion: reduce) {
						animation: none;
						opacity: 0.6;
					}
				}
			}

			@keyframes mitra-source-icon-spin {
				to { rotate: 1turn }
			}
		`
	}

	protected override get template() {
		this.style.setProperty('--mitra-source-icon-color', this.source?.color ?? '')
		this.toggleAttribute('importing', !!this.source?.importing)
		const getIcon = () => {
			const provider = this.icon ?? (this.source && getIntegrationFor(this.source.id)?.sourceIcon)
			switch (true) {
				case !!this.source?.importing:
					return 'loader-circle'
				case !!provider:
					return provider
				case this.source?.readOnly === true:
					return 'rss'
				case this.source?.supportsEntryType(EntryType.Event) && this.source?.supportsEntryType(EntryType.Task):
					return 'calendar-check'
				case this.source?.supportsEntryType(EntryType.Task):
					return 'list-todo'
				default:
					return 'calendar'
			}
		}
		return html`<mitra-icon icon=${getIcon()}></mitra-icon>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-source-icon': SourceIcon
	}
}
