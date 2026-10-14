import { Component, component, html, css, property, event } from '@a11d/lit'
import { type Entry } from '../Entry.js'
import { Transparency } from '../Transparency.js'
import { Visibility } from '../Visibility.js'
import { Calendars } from '../../sources/client/Calendars.js'
import { EntryStore } from './EntryStore.js'

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
		return Calendars.capabilitiesOf(this.entry.sourceId)
	}

	private get ownership() {
		return Calendars.ownershipOf(this.entry.sourceId)
	}

	private get showsTransparency() {
		return EntryDetailsSharing.showsTransparency(this.entry)
	}

	private static showsTransparency(entry: Entry) {
		return !entry.type.isTask && Calendars.ownershipOf(entry.sourceId).holds('transparency')
	}

	static applies(entry: Entry) {
		return EntryDetailsSharing.showsTransparency(entry) || !!Calendars.ownershipOf(entry.sourceId).holds('visibility')
	}

	private commit() {
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly handleTransparencyChange = (e: CustomEvent<Transparency>) => {
		this.entry.transparency = e.detail
		this.commit()
	}

	private readonly handleVisibilityChange = (e: CustomEvent<Visibility | null>) => {
		this.entry.visibility = e.detail ?? undefined
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
						&:last-child { margin-inline-end: -0.5rem; }

						mitra-select {
							flex: 1;
							min-width: 0;
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
		const transparency = this.entry.showAs
		return html`
			<mitra-icon icon="eye"></mitra-icon>
			<div class="choices">
				${!this.showsTransparency ? html.nothing : html`
					<span class="transparency field">
						<mitra-select label=${t('Show as busy or free')} title=${t('Show as busy or free')} ?disabled=${!this.capabilities.entries.edit}
							.value=${transparency} @change=${this.handleTransparencyChange}
						>
							${Transparency.all.map(value => html`<mitra-option .value=${value}>${value.format()}</mitra-option>`)}
						</mitra-select>
					</span>
				`}
				${!this.ownership.holds('visibility') ? html.nothing : html`
					<span class="visibility field">
						<mitra-select label=${t('Visibility')} title=${t('Visibility')} ?disabled=${!this.capabilities.entries.edit} .placeholder=${!this.entry.visibility}
							.value=${this.entry.visibility ?? null} @change=${this.handleVisibilityChange}
						>
							${[null, ...Visibility.all].map(value => html`<mitra-option .value=${value}>${value?.format() ?? t('Default visibility')}</mitra-option>`)}
						</mitra-select>
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
