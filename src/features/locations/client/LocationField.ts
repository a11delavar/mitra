import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { type Entry } from '../../entries/Entry.js'
import { searchLocations, getCapabilities, type LocationSuggestion } from '../../../infrastructure/http/Api.js'

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

/**
 * Location input with suggestions popover and Google Maps link.
 */
@component('mitra-location-field')
export class LocationField extends Component {
	@property({
		type: Object,
		updated(this: LocationField) { this.close() },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() private suggestions = new Array<LocationSuggestion>()
	@state() private activeIndex = -1

	private searchSequence = 0
	private debounceTimer?: ReturnType<typeof setTimeout>

	protected override createRenderRoot() { return this }

	@query('textarea') private readonly field?: HTMLTextAreaElement
	@query('menu[popover]') private readonly menu?: HTMLElement

	private readonly handleFocus = () => {
		requestPosition()
		this.search(this.entry.location.trim())
	}

	private readonly handleInput = (e: Event) => {
		const field = e.target as HTMLTextAreaElement
		if (field.value.includes('\n')) {
			field.value = field.value.replace(/\s*\n+\s*/g, ' ')
		}
		this.entry.location = field.value
		clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this.search(this.entry.location.trim()), 250)
	}

	private async search(query: string) {
		const sequence = ++this.searchSequence
		const suggestions = await searchLocations(query, position).catch(() => new Array<LocationSuggestion>())
		if (sequence !== this.searchSequence || !this.isConnected) {
			return
		}
		this.suggestions = suggestions
		this.activeIndex = -1
		await this.updateComplete
		suggestions.length ? this.menu?.showPopover() : this.menu?.hidePopover()
	}

	private close() {
		clearTimeout(this.debounceTimer)
		this.searchSequence++
		this.suggestions = []
		this.activeIndex = -1
		this.menu?.hidePopover()
	}

	private pick(suggestion: LocationSuggestion) {
		this.entry.location = suggestion.detail ? `${suggestion.name}, ${suggestion.detail}` : suggestion.name
		const field = this.field
		if (field) {
			field.value = this.entry.location
		}
		this.close()
		this.change.dispatch()
	}

	private readonly handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			this.activeIndex >= 0 ? this.pick(this.suggestions[this.activeIndex]!) : this.field?.blur()
			return
		}
		if (!this.suggestions.length) {
			return
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			const delta = e.key === 'ArrowDown' ? 1 : -1
			this.activeIndex = (this.activeIndex + delta + this.suggestions.length) % this.suggestions.length
		} else if (e.key === 'Escape') {
			e.stopPropagation()
			this.close()
		}
	}

	static override get styles() {
		return css`
			mitra-location-field {
				grid-column: 2;
				min-width: 0;
				display: flex;
				gap: 0.25rem;

				> textarea {
					flex: 1;
					min-width: 0;
				}

				> a {
					display: inline-flex;
					align-self: center;
					padding: 2px;
					border-radius: var(--border-radius);
					color: var(--color-text-muted);
					font-size: 0.87rem;
					transition: color 0.15s ease, background 0.15s ease;

					&:hover {
						color: var(--color-text);
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}

					&[data-empty] {
						visibility: hidden;
						pointer-events: none;
					}
				}

				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					max-inline-size: 280px;
					max-height: 60dvh;
					overflow-y: auto;
					background: var(--mitra-entry-surface);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					> button {
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
								font-weight: 400;
								color: var(--color-text-muted);
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
							}
						}

						&[data-active] {
							background: color-mix(in srgb, var(--color-text) 8%, transparent);
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<textarea rows="1" placeholder=${t('Location')} autocomplete="off" spellcheck="false"
				?readonly=${!getCapabilities(this.entry?.sourceId ?? '').editEntries}
				.value=${this.entry?.location ?? ''}
				@focus=${this.handleFocus}
				@input=${this.handleInput}
				@keydown=${this.handleKeydown}
				@blur=${() => this.close()}
			></textarea>
			<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.entry?.location ?? '')}"
				?data-empty=${!this.entry?.location}
				target="_blank" rel="noopener noreferrer" title=${t('Open in Google Maps')} aria-label=${t('Open in Google Maps')}>
				<mitra-icon icon="map"></mitra-icon>
			</a>
			<menu popover="manual">
				${this.suggestions.map((suggestion, index) => html`
					<button type="button" ?data-active=${index === this.activeIndex}
						@pointerdown=${(e: Event) => e.preventDefault()}
						@click=${() => this.pick(suggestion)}>
						<mitra-icon class="glyph" icon=${placeIcon(suggestion)}></mitra-icon>
						<span class="text">
							<span class="name">
								${suggestion.name}
								${!suggestion.type ? html.nothing : html`<span class="kind">· ${placeLabel(suggestion.type)}</span>`}
							</span>
							${!suggestion.detail ? html.nothing : html`<span class="detail">${suggestion.detail}</span>`}
						</span>
					</button>
				`)}
			</menu>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-location-field': LocationField
	}
}
