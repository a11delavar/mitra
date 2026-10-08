import { component, html, css, property, state, event, repeat, query } from '@a11d/lit'
import { type UserTimeZone } from '../../identity/User.js'
import { Popover } from '../../../design/Popover.js'
import type { SearchField } from '../../../design/TextField.js'

// --- Zone presentation (shared by the axis header, the picker, and the entry editor) ----------------

/** One `timeZoneName` part off Intl, in the UI language; `zoneId` undefined = the system zone. */
export function zoneNamePart(zoneId: string | undefined, style: 'short' | 'long' | 'shortOffset' | 'longOffset'): string {
	return new Intl.DateTimeFormat(Localizer.locales.current, { ...(!zoneId ? {} : { timeZone: zoneId }), timeZoneName: style })
		.formatToParts(new Date())
		.find(part => part.type === 'timeZoneName')?.value ?? ''
}

/** The compact column label: the user's custom name, else Intl's `short` name: a real abbreviation
 * ("PDT") where the zone has one, a localized offset ("GMT+2") where it doesn't. The generic names
 * ("Germany Time") don't fit a 3.75rem column. */
export function shortZoneLabel(zone?: UserTimeZone): string {
	return (zone ? zone.label : systemZoneLabel()) || zoneNamePart(zone?.id, 'short')
}

/** The full name for tooltips ("Central European Summer Time"). */
export function longZoneName(zoneId?: string): string {
	return zoneNamePart(zoneId, 'long')
}

/** The zone the browser runs in, the grid's anchor; never offered (or storable) as an addition. */
export function systemZoneId(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** The zone id's city segment ("Asia/Tehran" → "Tehran"), the most recognizable compact handle a
 * zone has; the offsets and generic names collide across zones, the city never does within one. */
export function zoneCity(zoneId: string): string {
	return zoneId.split('/').at(-1)!.replaceAll('_', ' ')
}

// Renames of the SYSTEM zone live in localStorage, not the database: the system zone is browser state
// (it changes when the device travels), so its label is browser state too, with no second source of truth
// about which zone anchors the grid. Keyed by zone id, so a "DE" stays bound to Europe/Berlin rather
// than to whatever zone the device happens to be in.
const SYSTEM_LABELS_KEY = 'Mitra.TimeZones.Labels'

export function systemZoneLabel(): string | undefined {
	try {
		return (JSON.parse(localStorage.getItem(SYSTEM_LABELS_KEY) ?? '{}') as Record<string, string>)[systemZoneId()] || undefined
	} catch {
		return undefined
	}
}

export function setSystemZoneLabel(label: string | undefined) {
	try {
		const labels = JSON.parse(localStorage.getItem(SYSTEM_LABELS_KEY) ?? '{}') as Record<string, string>
		if (label) {
			labels[systemZoneId()] = label
		} else {
			delete labels[systemZoneId()]
		}
		localStorage.setItem(SYSTEM_LABELS_KEY, JSON.stringify(labels))
	} catch {
		// Storage unavailable, so the rename just doesn't stick.
	}
}

// --- Picker data ------------------------------------------------------------------------------------

interface ZoneRow {
	readonly id: string
	readonly offset: string
	readonly offsetMinutes: number
	readonly name: string
	readonly city: string
}

let zoneRows: ReadonlyArray<ZoneRow> | undefined

/** Every IANA zone the runtime knows, presentable and sorted by offset, built lazily on first picker
 * open (~400 zones × two Intl formatters is one-time work worth deferring off the boot path). */
function allZoneRows(): ReadonlyArray<ZoneRow> {
	return zoneRows ??= Intl.supportedValuesOf('timeZone')
		.map(id => {
			const offset = zoneNamePart(id, 'longOffset') // "GMT+02:00"; plain "GMT" for UTC
			const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset)
			const offsetMinutes = !match ? 0 : (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
			return {
				id,
				offset,
				offsetMinutes,
				name: zoneNamePart(id, 'long'),
				city: zoneCity(id),
			}
		})
		.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
}

/**
 * A searchable list of every IANA zone, as a popover: `toggle(anchor)` opens it, and a chosen zone id is `pick`ed
 * and closes it. `exclude` leaves out ids that would change nothing for the caller.
 */
@component('mitra-time-zone-picker')
export class TimeZonePicker extends Popover {
	@event() readonly pick!: EventDispatcher<string>

	@property({ type: Object }) exclude?: ReadonlySet<string>

	/** The caller's current zone, marked and where the list opens, among its neighbours by offset. */
	@property() selected?: string

	@state() private query = ''

	@query('mitra-search-field') private readonly input?: SearchField

	private get rows(): ReadonlyArray<ZoneRow> {
		const rows = !this.exclude?.size ? allZoneRows() : allZoneRows().filter(row => !this.exclude!.has(row.id))
		const query = this.query.trim().toLowerCase()
		const matches = !query ? rows : rows.filter(row =>
			row.city.toLowerCase().includes(query)
			|| row.name.toLowerCase().includes(query)
			|| row.offset.toLowerCase().includes(query)
			|| row.id.toLowerCase().includes(query))
		// The browser's own zone is the way back to the default, so it heads the list rather than hiding in the offset order.
		const system = systemZoneId()
		return [...matches.filter(row => row.id === system), ...matches.filter(row => row.id !== system)]
	}

	protected override opened() {
		this.query = ''
		if (this.input) {
			this.input.value = ''
			this.input.focus()
		}
	}

	private choose(id: string) {
		this.hide()
		this.pick.dispatch(id)
	}

	static override get styles() {
		return css`
			${super.styles}

			:host {
				padding: 0;
				inline-size: 26rem;
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

			mitra-listbox {
				max-block-size: min(24rem, 50dvh);
				padding: 0.25rem;
				--mitra-option-inset: 2rem;
			}

			.offset {
				flex-shrink: 0;
				inline-size: 5.25rem;
				color: var(--color-text-muted);
				font-variant-numeric: tabular-nums;
			}

			.name {
				font-weight: 500;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.city {
				color: var(--color-text-muted);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.primary {
				margin-inline-start: auto;
				flex-shrink: 0;
				color: var(--color-text-muted);
				font-size: 0.6875rem;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}
		`
	}

	protected override get template() {
		const system = systemZoneId()
		return html`
			<mitra-combobox inline activateFirst .selected=${this.selected} @pick=${(e: CustomEvent<string>) => this.choose(e.detail)} @dismiss=${() => this.hide()}>
				<mitra-search-field slot="input" plain placeholder=${t('Time zone')}
					@input=${(e: Event) => this.query = (e.target as SearchField).value}
				></mitra-search-field>
				<mitra-listbox aria-label=${t('Time zone')}>
					${repeat(this.rows, row => row.id, row => html`
						<mitra-option .value=${row.id}>
							<span class="offset">${row.offset}</span>
							<span class="name">${row.name}</span>
							<span class="city">– ${row.city}</span>
							${row.id !== system ? html.nothing : html`<span class="primary">${t('Primary')}</span>`}
						</mitra-option>
					`)}
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
