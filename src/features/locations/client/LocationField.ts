import { Component, component, html, css, property, state, event, query, bind } from '@a11d/lit'
import { type Entry } from '../../entries/Entry.js'
import { searchLocations, getCapabilities, type LocationSuggestion } from '../../../infrastructure/http/Api.js'
import { LatestSearch } from '../../../design/Combobox.js'
import './MapLink.js'

// Cached user coordinates for geocoding bias.
let position: { lat: number, lon: number } | undefined
let positionRequested = false
function requestPosition() {
	if (positionRequested || !navigator.geolocation) {
		return
	}
	positionRequested = true
	navigator.geolocation.getCurrentPosition(
		p => position = { lat: p.coords.latitude, lon: p.coords.longitude },
		() => void 0,
		{ maximumAge: 10 * 60_000 },
	)
}

const PLACE_ICONS: Record<string, string> = {
	restaurant: 'utensils', food_court: 'utensils', fast_food: 'hamburger',
	cafe: 'coffee', bar: 'beer', pub: 'beer', biergarten: 'beer',
	hotel: 'bed', hostel: 'bed', guest_house: 'bed', motel: 'bed', camp_site: 'tent',
	supermarket: 'shopping-cart', mall: 'store', department_store: 'store', convenience: 'store',
	museum: 'landmark', gallery: 'landmark', attraction: 'landmark', memorial: 'landmark', monument: 'landmark', castle: 'landmark',
	station: 'train-front', halt: 'train-front', tram_stop: 'train-front', aerodrome: 'plane',
	hospital: 'hospital', clinic: 'hospital', doctors: 'hospital', pharmacy: 'hospital',
	school: 'graduation-cap', university: 'graduation-cap', college: 'graduation-cap', library: 'library',
	cinema: 'clapperboard', theatre: 'theater',
	park: 'trees', garden: 'trees', playground: 'trees', nature_reserve: 'trees',
	sports_centre: 'dumbbell', fitness_centre: 'dumbbell', stadium: 'dumbbell', pitch: 'dumbbell',
	place_of_worship: 'church', bank: 'banknote',
}

function placeIcon(suggestion: LocationSuggestion): string {
	return suggestion.recent ? 'history' : PLACE_ICONS[suggestion.type ?? ''] ?? 'map-pin'
}

function placeLabel(type: string): string {
	return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** The location field, suggesting places as it is typed into, with a link to the place on a map. */
@component('mitra-location-field')
export class LocationField extends Component {
	@property({
		type: Object,
		updated(this: LocationField) { this.close() },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() private suggestions = new Array<LocationSuggestion>()
	@state() open = false

	private readonly search = new LatestSearch((query: string) => searchLocations(query, position).catch(() => new Array<LocationSuggestion>()), 250)

	protected override createRenderRoot() { return this }

	@query('textarea') private readonly field?: HTMLTextAreaElement

	private async suggest(query: string, immediately = false) {
		const suggestions = await this.search.run(query, { immediately })
		if (this.isConnected) {
			this.suggestions = suggestions
			this.open = suggestions.length > 0
		}
	}

	private readonly handleFocus = () => {
		requestPosition()
		void this.suggest(this.entry.location.trim(), true)
	}

	private readonly handleInput = (e: Event) => {
		const field = e.target as HTMLTextAreaElement
		if (field.value.includes('\n')) {
			field.value = field.value.replace(/\s*\n+\s*/g, ' ')
		}
		this.entry.location = field.value
		void this.suggest(this.entry.location.trim())
	}

	private close() {
		this.search.cancel()
		this.suggestions = []
		this.open = false
	}

	private pick(suggestion: LocationSuggestion) {
		this.entry.location = suggestion.detail ? `${suggestion.name}, ${suggestion.detail}` : suggestion.name
		if (this.field) {
			this.field.value = this.entry.location
		}
		this.close()
		this.change.dispatch()
	}

	/** Enter that chose no suggestion keeps what was typed. */
	private readonly handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.defaultPrevented) {
			e.preventDefault()
			this.field?.blur()
		}
	}

	static override get styles() {
		return css`
			mitra-location-field {
				grid-column: 2;
				min-width: 0;
				display: flex;
				gap: 0.25rem;

				textarea {
					flex: 1;
					min-width: 0;
				}

				mitra-listbox {
					max-inline-size: 280px;
				}

				mitra-option {
					> .glyph {
						color: var(--color-text-muted);
					}

					> .text {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 1px;

						> .name {
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;

							> .kind {
								font-weight: 400;
								color: var(--color-text-muted);
							}
						}

						> .detail {
							font-size: 0.6875rem;
							color: var(--color-text-muted);
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-combobox ?open=${bind(this, 'open')}
				@pick=${(e: CustomEvent<LocationSuggestion>) => this.pick(e.detail)} @keydown=${this.handleKeyDown}>
				<textarea slot="input" rows="1" placeholder=${t('Location')} aria-label=${t('Location')} autocomplete="off" spellcheck="false"
					?readonly=${!getCapabilities(this.entry?.sourceId ?? '').editEntries}
					.value=${this.entry?.location ?? ''}
					@focus=${this.handleFocus}
					@input=${this.handleInput}
				></textarea>
				<mitra-listbox aria-label=${t('Location')}>
					${this.suggestions.map(suggestion => html`
						<mitra-option .value=${suggestion}>
							<mitra-icon class="glyph" icon=${placeIcon(suggestion)}></mitra-icon>
							<span class="text">
								<span class="name">
									${suggestion.name}
									${!suggestion.type ? html.nothing : html`<span class="kind">· ${placeLabel(suggestion.type)}</span>`}
								</span>
								${!suggestion.detail ? html.nothing : html`<span class="detail">${suggestion.detail}</span>`}
							</span>
						</mitra-option>
					`)}
				</mitra-listbox>
			</mitra-combobox>
			<mitra-map-link location=${this.entry?.location ?? ''}></mitra-map-link>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-location-field': LocationField
	}
}
