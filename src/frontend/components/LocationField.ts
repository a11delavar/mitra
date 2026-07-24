import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { type Entry } from 'shared'
import { searchLocations, type LocationSuggestion } from '../Api.js'

// The user's position, fetched once per session (on first use of a location field) to bias the
// geocoder towards nearby places. Denied or unavailable simply means unbiased results — the field
// never depends on it.
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

// Presentation of a suggestion's kind of place — the raw OSM tag value the proxy passes through
// (`restaurant`, `fast_food`, …) mapped to a glyph here, in ONE place, so wording (and later,
// localization) never leaks into the backend. Anything unmapped is still a place: map-pin.
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

/** The human label for a kind of place: `fast_food` → "Fast Food". English for now — this is the
 * single seam where localized wording plugs in later. */
function placeLabel(type: string): string {
	return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/**
 * The "Location" control for the entry editor, Google Calendar-style: ONE always-editable `subtle`
 * field — a single-line-behaving textarea, so `field-sizing` lets a long address wrap and grow — with
 * a trailing map link opening the address in Google Maps once one is set. (One mode on purpose: a
 * separate rendered/editing state can flip underneath mid-typing; a plain field can't.)
 *
 * Typing live-queries suggestions into an anchored menu: recently used locations from the user's own
 * entries first (shown on focus even before typing), then geocoder results (via the backend's Photon
 * proxy, biased towards the user's position when granted). The menu prefers opening beside the row —
 * the same placement strategy and tinted glass as the source and repeat pickers.
 *
 * The value is and stays a plain string (RFC 5545 LOCATION is TEXT), so free text is always valid;
 * picking a suggestion merely fills in a nicely formatted one. Mutates `entry.location` in place and
 * fires `change`; the host persists.
 */
@component('mitra-location-field')
export class LocationField extends Component {
	// Per-instance anchor token so two open editors' suggestion menus never collide.
	private static count = 0
	private readonly anchor = `--location-${LocationField.count++}`

	@property({
		type: Object,
		// The popover got reused for another entry while suggestions were open: they belong to the
		// previous entry's typing — drop them.
		updated(this: LocationField) { this.close() },
	}) entry!: Entry

	/** Fired after `entry.location` is mutated by picking a suggestion. (Typed edits additionally fire
	 * the field's own bubbling `change` on commit, like every other field.) */
	@event() readonly change!: EventDispatcher

	@state() private suggestions = new Array<LocationSuggestion>()
	@state() private activeIndex = -1

	// Responses may resolve out of order; only the latest issued request's may drive the menu.
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
		// The textarea is only multi-LOOKING (so a long address wraps); the value stays single-line —
		// Enter is intercepted below, and pasted newlines collapse here.
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
		this.searchSequence++ // orphan any in-flight response
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
			// Never a newline: Enter picks the active suggestion, or commits the typed text as-is (the
			// blur fires the field's own change).
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
			// Only dismiss the suggestions — stop it before the popover machinery closes the whole
			// details editor.
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
				align-items: center;
				gap: 0.25rem;

				/* The global textarea's field-sizing makes the field grow as a long address wraps. */
				> textarea {
					flex: 1;
					min-width: 0;
				}

				/* The Google Maps opener. Always laid out (just invisible while there's no location), so
				   the field doesn't shift the moment the first character makes it appear. */
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

					&[data-empty] {
						visibility: hidden;
						pointer-events: none;
					}
				}

				/* The suggestions wear the popover's tinted glass and open beside the row, flipping
				   inline/block when the space runs out — the same strategy as the source/repeat pickers. */
				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					max-inline-size: 280px;
					max-height: 60dvh;
					overflow-y: auto;
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					> button {
						/* The leading glyph: what KIND of thing this row is — recently used, a typed place,
						   or just somewhere on the map. */
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

								/* The kind of place, disambiguating a bare name ("Teheran · Restaurant"). */
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

						/* The keyboard-active row shares the hover surface. */
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
			<textarea class="subtle" rows="1" placeholder=${t('Location')} autocomplete="off" spellcheck="false"
				style="anchor-name: ${this.anchor}"
				.value=${this.entry?.location ?? ''}
				@focus=${this.handleFocus}
				@input=${this.handleInput}
				@keydown=${this.handleKeydown}
				@blur=${() => this.close()}></textarea>
			<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.entry?.location ?? '')}"
				?data-empty=${!this.entry?.location}
				target="_blank" rel="noopener noreferrer" title=${t('Open in Google Maps')} aria-label=${t('Open in Google Maps')}>
				<mitra-icon icon="map"></mitra-icon>
			</a>
			<!-- A MANUAL popover: light dismiss would race the opening click — the recents query is local-DB
				fast, so on an empty field the menu can open between pointerdown (focus) and pointerup, and
				the completing click would instantly dismiss it (a flash). Its lifecycle is fully owned here
				anyway: blur, Escape, and picking close it. -->
			<menu popover="manual" style="position-anchor: ${this.anchor}">
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
