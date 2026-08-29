import { Component, component, html, css, property, event } from '@a11d/lit'
import { Transparency, Visibility, type Entry } from '../Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'

function transparencyLabel(transparency: Transparency): string {
	switch (transparency) {
		case Transparency.Busy: return t('Busy')
		case Transparency.Free: return t('Free')
	}
}

function visibilityLabel(visibility: Visibility | null): string {
	switch (visibility) {
		case Visibility.Public: return t('Public')
		case Visibility.Private: return t('Private')
		case Visibility.Confidential: return t('Confidential')
		default: return t('Default visibility')
	}
}

/**
 * Entry sharing and availability editor (RFC 5545 TRANSP and CLASS).
 */
@component('mitra-entry-details-sharing')
export class EntryDetailsSharing extends Component {
	@property({ type: Object }) entry!: Entry

	override role = 'listitem'

	@event() readonly change!: EventDispatcher

	readonly store = new EntryStore(this)

	protected override createRenderRoot() { return this }

	private get capabilities() {
		return getCapabilities(this.entry.sourceId)
	}

	private get showsTransparency() {
		return EntryDetailsSharing.showsTransparency(this.entry)
	}

	private static showsTransparency(entry: Entry) {
		return !entry.type.isTask && getCapabilities(entry.sourceId).transparency
	}

	static applies(entry: Entry) {
		return EntryDetailsSharing.showsTransparency(entry) || !!getCapabilities(entry.sourceId).visibility
	}

	private commit() {
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly handleTransparencyChange = (e: Event) => {
		this.entry.transparency = (e.target as HTMLSelectElement).value as Transparency
		this.commit()
	}

	private readonly handleVisibilityChange = (e: Event) => {
		this.entry.visibility = ((e.target as HTMLSelectElement).value || null) as Visibility | null
		this.commit()
	}

	static override get styles() {
		return css`
			mitra-entry-details-sharing {
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				align-items: center;

				> mitra-icon {
					grid-column: 1;
					font-size: 0.87rem;
					color: var(--color-text-muted);
					flex-shrink: 0;
				}

				> .choices {
					grid-column: 2 / -1;
					display: flex;
					align-items: center;
					gap: 0.25rem;
					min-width: 0;

					> .field {
						flex: 1 1 0;
						--field-padding-inline: 0.25rem;
						display: flex;
						align-items: center;
						min-width: 0;

						&:first-child { margin-inline-start: calc(-1 * var(--field-padding-inline)); }
						&:last-child { margin-inline-end: -0.25rem; }

						> select {
							flex: 1;
							min-width: 0;

							selectedcontent {
								overflow: hidden;
								text-overflow: ellipsis;
								white-space: nowrap;
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		if (!EntryDetailsSharing.applies(this.entry)) {
			return html.nothing
		}
		const transparency = this.entry.transparency ?? Transparency.Busy
		return html`
			<mitra-icon icon="eye"></mitra-icon>
			<div class="choices">
				${!this.showsTransparency ? html.nothing : html`
					<span class="transparency field">
						<select aria-label=${t('Show as busy or free')} title=${t('Show as busy or free')} ?disabled=${!this.capabilities.editEntries} @change=${this.handleTransparencyChange}>
							<button>
								<selectedcontent></selectedcontent>
							</button>
							${/* Mapped options prevent Chromium duplicate marker bug with <selectedcontent> */''}
							${Object.values(Transparency).map(value => html`
								<option value=${value} ?selected=${value === transparency}>${transparencyLabel(value)}</option>
							`)}
						</select>
					</span>
				`}
				${!this.capabilities.visibility ? html.nothing : html`
					<span class="visibility field">
						<select ?data-placeholder=${!this.entry.visibility} aria-label=${t('Visibility')} title=${t('Visibility')} ?disabled=${!this.capabilities.editEntries} @change=${this.handleVisibilityChange}>
							<button>
								<selectedcontent></selectedcontent>
							</button>
							${[null, ...Object.values(Visibility)].map(value => html`
								<option value=${value ?? ''} ?selected=${value === this.entry.visibility}>${visibilityLabel(value)}</option>
							`)}
						</select>
					</span>
				`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-sharing': EntryDetailsSharing
	}
}
