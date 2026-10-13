import { component, html, css, property, state, event, eventListener, repeat, query } from '@a11d/lit'
import { Popover } from '../../../design/Popover.js'
import type { SearchField } from '../../../design/TextField.js'
import { TimeZoneDirectory, type TimeZoneTree } from './TimeZoneDirectory.js'

/**
 * A searchable popover over every IANA zone: the formatting region's zones first, then all, each group sharing a name
 * and a clock as one header for its main city, the others folded under it.
 */
@component('mitra-time-zone-picker')
export class TimeZonePicker extends Popover {
	@event() readonly pick!: EventDispatcher<string>

	/** One zone, which a pick closes; or several, which a pick toggles one of, leaving the list open. */
	@property({ type: Object }) selected?: string | ReadonlyArray<string>

	/** The account's home, marked with a house in place of a tick. */
	@property() home?: string

	/** The zone the device runs in, marked with a pin where it is not home. */
	@property() here?: string

	@state() private query = ''

	/**
	 * Listed from the first opening on: every entry editor holds a picker, and 400 unopened options cost each tap on an
	 * entry hundreds of milliseconds. Set before the popover shows, so the list opens at the selected zone.
	 */
	@state() private listed = false

	@eventListener('beforetoggle')
	protected handleBeforeOpen(e: ToggleEvent) {
		if (e.newState === 'open') {
			this.listed = true
		}
	}

	@query('mitra-search-field') private readonly input?: SearchField

	protected override opened() {
		this.query = ''
		if (this.input) {
			this.input.value = ''
			this.input.focus()
		}
	}

	private choose(id: string) {
		if (!Array.isArray(this.selected)) {
			this.hide()
		}
		this.pick.dispatch(id)
	}

	static override get styles() {
		return css`
			${super.styles}

			:host {
				/* Faded from the row's own colour rather than a fixed grey, so it reads on a selected or tinted row too. */
				--_faded: color-mix(in srgb, currentColor 55%, transparent);
				padding: 0;
				inline-size: 28rem;
				max-inline-size: calc(100dvw - 0.75rem);
			}

			:host(:popover-open) {
				display: flex;
				flex-direction: column;
			}

			mitra-search-field {
				flex-shrink: 0;
				border-block-end: var(--border);
			}

			mitra-option-group::part(label) {
				color: var(--_faded);
			}

			/* The list's own columns, between the tick and the chevron: a group's offset and name, and the city it stands for. */
			mitra-listbox {
				--mitra-tree-columns: [offset] 4.5rem [name] minmax(0, 1fr) [city] auto;
				max-block-size: min(26rem, 55dvh);
				padding: 0.25rem;
			}

			mitra-option::part(content) {
				display: contents;
			}

			mitra-option > span {
				grid-row: 1;
				white-space: nowrap;
			}

			.offset {
				grid-column: offset;
				color: var(--_faded);
				font-variant-numeric: tabular-nums;
			}

			.name, .country {
				grid-column: name;
				min-inline-size: 0;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.city {
				grid-column: city;
				justify-self: end;
				padding-inline-start: 0.75rem;
			}

		`
	}

	/** The other cities put their country under the group's name; the empty offset column is all the indent they need. */
	private treeTemplate(group: TimeZoneTree) {
		return html`
			<mitra-option-tree .open=${!!this.query.trim()}>
				<mitra-option slot="header" .value=${group.main.id} label=${`${group.name} · ${group.main.city}`} marker=${this.markerOf(group.main.id)} title=${this.titleOf(group.main.id)}>
					<span class="offset">${group.offset}</span>
					<span class="name">${group.name}</span>
					<span class="city">${group.main.city}</span>
				</mitra-option>
				${repeat(group.others, zone => zone.id, zone => html`
					<mitra-option .value=${zone.id} label=${`${group.name} · ${zone.city}`} marker=${this.markerOf(zone.id)} title=${this.titleOf(zone.id)}>
						<span class="country">${zone.country}</span>
						<span class="city">${zone.city}</span>
					</mitra-option>
				`)}
			</mitra-option-tree>
		`
	}

	private markerOf(id: string) {
		return id === this.home ? 'house' : id === this.here ? 'map-pin' : html.nothing
	}

	private titleOf(id: string) {
		return id === this.home ? t('Home') : id === this.here ? t('Current time zone') : html.nothing
	}

	protected override get template() {
		const directory = this.listed ? TimeZoneDirectory.current : undefined
		const region = directory?.locale.maximize().region
		const preferred = [this.here, this.home].filter(id => id !== undefined)
		const regional = this.query || !region ? [] : directory!.find('', zone => zone.region === region, region, preferred)
		// Never twice: a zone is one option, which the list tells from the others by its value alone.
		const listed = new Set(regional.flatMap(group => [group.main.id, ...group.others.map(zone => zone.id)]))
		const groups = directory?.find(this.query, zone => !listed.has(zone.id), region, preferred) ?? []
		return html`
			<mitra-combobox inline activateFirst .selected=${this.selected} @pick=${(e: CustomEvent<string>) => this.choose(e.detail)} @dismiss=${() => this.hide()}>
				<mitra-search-field slot="input" plain placeholder=${t('Time zone')}
					@input=${(e: Event) => this.query = (e.target as SearchField).value}
				></mitra-search-field>
				<mitra-listbox aria-label=${t('Time zone')}>
					${!regional.length ? html.nothing : html`
						<mitra-option-group label=${new Intl.DisplayNames([directory!.locale], { type: 'region' }).of(region!) ?? region!}>
							${regional.map(group => this.treeTemplate(group))}
						</mitra-option-group>
					`}
					<mitra-option-group label=${this.query ? '' : t('All time zones')}>
						${groups.map(group => this.treeTemplate(group))}
					</mitra-option-group>
				</mitra-listbox>
			</mitra-combobox>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-zone-picker': TimeZonePicker
	}
}
