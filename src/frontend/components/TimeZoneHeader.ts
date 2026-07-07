import { Component, component, html, css, state, event, repeat } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type UserTimeZone } from 'shared'
import { getTimeZones, setTimeZones } from '../Api.js'

// --- Zone presentation (shared with the day grid's time axis) --------------------------------------

/** One `timeZoneName` part off Intl, in the UI language; `zoneId` undefined = the system zone. */
export function zoneNamePart(zoneId: string | undefined, style: 'short' | 'long' | 'longOffset'): string {
	return new Intl.DateTimeFormat(Localizer.languages.current, { ...(!zoneId ? {} : { timeZone: zoneId }), timeZoneName: style })
		.formatToParts(new Date())
		.find(part => part.type === 'timeZoneName')?.value ?? ''
}

/** The compact column label: the user's custom name, else Intl's `short` name — a real abbreviation
 * ("PDT") where the zone has one, a localized offset ("GMT+2") where it doesn't. The generic names
 * ("Germany Time") don't fit a 3.75rem column. */
export function shortZoneLabel(zone?: UserTimeZone): string {
	return (zone ? zone.label : systemZoneLabel()) || zoneNamePart(zone?.id, 'short')
}

/** The zone the browser runs in — the grid's anchor; never offered (or storable) as an addition. */
export function systemZoneId(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Renames of the SYSTEM zone live in localStorage, not the database: the system zone is browser state
// (it changes when the device travels), so its label is browser state too — no second source of truth
// about which zone anchors the grid. Keyed by zone id, so a "DE" stays bound to Europe/Berlin rather
// than to whatever zone the device happens to be in.
const SYSTEM_LABELS_KEY = 'Mitra.TimeZones.Labels'

function systemZoneLabel(): string | undefined {
	try {
		return (JSON.parse(localStorage.getItem(SYSTEM_LABELS_KEY) ?? '{}') as Record<string, string>)[systemZoneId()] || undefined
	} catch {
		return undefined
	}
}

function setSystemZoneLabel(label: string | undefined) {
	try {
		const labels = JSON.parse(localStorage.getItem(SYSTEM_LABELS_KEY) ?? '{}') as Record<string, string>
		if (label) {
			labels[systemZoneId()] = label
		} else {
			delete labels[systemZoneId()]
		}
		localStorage.setItem(SYSTEM_LABELS_KEY, JSON.stringify(labels))
	} catch {
		// Storage unavailable — the rename just doesn't stick.
	}
}

/** The full name for tooltips ("Central European Summer Time"). */
export function longZoneName(zoneId?: string): string {
	return zoneNamePart(zoneId, 'long')
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

/** Every IANA zone the runtime knows, presentable and sorted by offset — built lazily on first picker
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
				city: id.split('/').at(-1)!.replaceAll('_', ' '),
			}
		})
		.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
}

/**
 * The day grid's time-axis header: one compact label per displayed zone — the user's additional zones
 * first, the system zone last (adjacent to the days; it anchors the grid and can't be removed) — plus
 * the affordances around them: a hover-revealed "+" opening a searchable picker over every IANA zone,
 * and a per-zone menu to rename (a custom short label like "DE") or remove. Mutations persist via the
 * user settings API and fire `change`, so the host re-renders its axis columns.
 */
@component('mitra-time-zone-header')
export class TimeZoneHeader extends Component {
	// Per-instance anchor token so anchored popovers of two instances never collide.
	private static count = 0
	private readonly anchor = `--time-zone-${TimeZoneHeader.count++}`

	/** Fired after the zone list changed (added/renamed/removed). */
	@event() readonly change!: EventDispatcher

	@state() private query = ''
	@state() private activeIndex = -1

	protected override createRenderRoot() { return this }

	private get picker() { return this.querySelector<HTMLElement>('.picker') }

	private get filteredRows(): ReadonlyArray<ZoneRow> {
		// Neither the already-added zones nor the system zone (always shown anyway) are offerable —
		// duplicate columns would only mislead.
		const taken = new Set([...getTimeZones().map(zone => zone.id), systemZoneId()])
		const rows = allZoneRows().filter(row => !taken.has(row.id))
		const query = this.query.trim().toLowerCase()
		return !query ? rows : rows.filter(row =>
			row.city.toLowerCase().includes(query)
			|| row.name.toLowerCase().includes(query)
			|| row.offset.toLowerCase().includes(query)
			|| row.id.toLowerCase().includes(query))
	}

	private async commit(timeZones: Array<UserTimeZone>) {
		await setTimeZones(timeZones)
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly add = (id: string) => {
		this.picker?.hidePopover()
		if (id === systemZoneId() || getTimeZones().some(zone => zone.id === id)) {
			return // already a column
		}
		this.commit([...getTimeZones(), { id }]).catch(() => void 0)
	}

	private readonly removeZone = (zone: UserTimeZone) => {
		this.commit(getTimeZones().filter(other => other.id !== zone.id)).catch(() => void 0)
	}

	private readonly rename = async (zone: UserTimeZone) => {
		const label = await new DialogTimeZoneRename({ zone }).confirm()
		if (label === undefined) {
			return // cancelled
		}
		await this.commit(getTimeZones().map(other => other.id !== zone.id ? other : { id: zone.id, ...(label ? { label } : {}) }))
	}

	private readonly renameSystem = async () => {
		const label = await new DialogTimeZoneRename({ zone: { id: systemZoneId(), label: systemZoneLabel() } }).confirm()
		if (label === undefined) {
			return // cancelled
		}
		setSystemZoneLabel(label || undefined)
		this.requestUpdate()
	}

	private readonly handlePickerToggle = (e: Event) => {
		if ((e as ToggleEvent).newState === 'open') {
			this.query = ''
			this.activeIndex = -1
			const input = this.querySelector<HTMLInputElement>('.picker input')
			input?.focus()
			if (input) {
				input.value = ''
			}
		}
	}

	private readonly handlePickerInput = (e: Event) => {
		this.query = (e.target as HTMLInputElement).value
		this.activeIndex = -1
	}

	private readonly handlePickerKeydown = (e: KeyboardEvent) => {
		const rows = this.filteredRows
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			const delta = e.key === 'ArrowDown' ? 1 : -1
			this.activeIndex = rows.length ? (this.activeIndex + delta + rows.length) % rows.length : -1
			this.updateComplete.then(() => this.querySelector('.picker .rows [data-active]')?.scrollIntoView({ block: 'nearest' }))
		} else if (e.key === 'Enter') {
			// The highlighted row, or — straight after typing — the top match.
			e.preventDefault()
			const row = rows[this.activeIndex] ?? rows[0]
			if (row) {
				this.add(row.id)
			}
		}
	}

	private readonly toggleMenu = (e: Event) => {
		((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null)?.togglePopover()
	}

	static override get styles() {
		return css`
			mitra-time-zone-header {
				/* The header adopts the day grid's OWN tracks (through the .timezone cell's subgrid):
				   the "+" affordance on the leading track, one label per zone track — the exact tracks
				   the axis hours below sit on, so alignment is the grid's job, not a coincidence. */
				grid-column: 1 / -1;
				display: grid;
				grid-template-columns: subgrid;
				align-items: center;

				> .add {
					justify-self: center;
					color: var(--color-text-muted);
					font-size: 0.7rem;
					opacity: 0;
					transition: opacity 0.15s ease;
				}

				&:hover > .add,
				> .add:focus-within {
					opacity: 1;
				}

				> .zone {
					all: unset;
					box-sizing: border-box;
					justify-self: center;
					max-width: 100%;
					padding: 0.125rem 0.25rem;
					border-radius: var(--border-radius);
					text-align: center;
					white-space: nowrap;
					color: var(--color-text-muted);
					font-size: 0.65rem;
					font-weight: 600;
					cursor: pointer;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 8%, transparent);
						color: var(--color-text);
					}
				}

				menu[popover] {
					position-area: block-end span-inline-end;
					position-try-fallbacks: flip-block, flip-inline;
				}

				/* The zone picker: search-as-you-type over every IANA zone, in the popover glass. */
				> .picker {
					margin: 0.25rem 0 0;
					padding: 0;
					max-inline-size: calc(100dvw - 0.75rem); /* never wider than the viewport */
					background: color-mix(in srgb, var(--color-surface) 95%, transparent);
					backdrop-filter: blur(10px);
					border: var(--border);
					border-radius: 8px;
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: block-end span-inline-end;
					position-try-fallbacks: flip-block, flip-inline;

					&:popover-open {
						display: flex;
						flex-direction: column;
						gap: 0.375rem;
					}

					> input {
						flex-shrink: 0;
						padding-block: 0.4rem;
						margin-block: 0.4rem;
						margin-inline: 0.24rem;
					}

					> .rows {
						overflow-y: overlay;
						max-height: min(24rem, 50dvh);
						display: flex;
						flex-direction: column;
						gap: 1px;

						> button {
							all: unset;
							box-sizing: border-box;
							display: flex;
							align-items: baseline;
							gap: 0.5rem;
							padding: 0.375rem 0.5rem;
							border-radius: var(--border-radius);
							font-size: 0.8125rem;
							cursor: pointer;

							/* The keyboard-active row shares the hover surface. */
							&:hover, &[data-active] {
								background: color-mix(in srgb, var(--color-text) 8%, transparent);
							}

							> .offset {
								flex-shrink: 0;
								inline-size: 5.25rem;
								color: var(--color-text-muted);
								font-variant-numeric: tabular-nums;
							}

							> .name {
								font-weight: 500;
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
							}

							> .city {
								color: var(--color-text-muted);
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-icon-button class="add" icon="plus" label=${t('Add time zone')}
				style="anchor-name: ${this.anchor}-add"
				@click=${() => this.picker?.togglePopover()}
			></mitra-icon-button>
			${repeat(getTimeZones(), zone => zone.id, (zone, index) => html`
				<button class="zone" style="anchor-name: ${this.anchor}-${index}" title=${longZoneName(zone.id)} @click=${this.toggleMenu}>
					${shortZoneLabel(zone)}
				</button>
				<menu popover style="position-anchor: ${this.anchor}-${index}">
					<button @click=${(e: Event) => { (e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover(); this.rename(zone).catch(() => void 0) }}>
						<mitra-icon icon="pencil"></mitra-icon>
						${t('Rename')}
					</button>
					<button class="danger" @click=${(e: Event) => { (e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover(); this.removeZone(zone) }}>
						<mitra-icon icon="x"></mitra-icon>
						${t('Remove')}
					</button>
				</menu>
			`)}
			<button class="zone" style="anchor-name: ${this.anchor}-system" title=${longZoneName()} @click=${this.toggleMenu}>
				${shortZoneLabel()}
			</button>
			<menu popover style="position-anchor: ${this.anchor}-system">
				<button @click=${(e: Event) => { (e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover(); this.renameSystem().catch(() => void 0) }}>
					<mitra-icon icon="pencil"></mitra-icon>
					${t('Rename')}
				</button>
			</menu>
			<div class="picker" popover style="position-anchor: ${this.anchor}-add" @toggle=${this.handlePickerToggle}>
				<input placeholder=${t('Time zone')} autocomplete="off" spellcheck="false"
					@input=${this.handlePickerInput}
					@keydown=${this.handlePickerKeydown}>
				<div class="rows">
					${repeat(this.filteredRows, row => row.id, (row, index) => html`
						<button type="button" ?data-active=${index === this.activeIndex} @click=${() => this.add(row.id)}>
							<span class="offset">${row.offset}</span>
							<span class="name">${row.name}</span>
							<span class="city">– ${row.city}</span>
						</button>
					`)}
				</div>
			</div>
		`
	}
}

/** Rename dialog: a short custom label for the column ("DE"); empty resets to the automatic name. */
@component('mitra-dialog-time-zone-rename')
export class DialogTimeZoneRename extends DialogComponent<{ readonly zone: UserTimeZone }, string | undefined> {
	@state() private label = this.parameters.zone.label ?? ''

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-time-zone-rename {
				.hint {
					display: block;
					margin-block-start: 0.5rem;
					font-size: 0.75rem;
					color: var(--color-text-muted);
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Rename time zone')} primaryButtonText=${t('Save')} primaryOnEnter>
				<div>
					<input placeholder=${zoneNamePart(this.parameters.zone.id, 'short')} maxlength="24"
						.value=${this.label} @input=${(e: Event) => this.label = (e.target as HTMLInputElement).value}>
					<span class="hint">${t('Shown above the time axis. Leave empty to use the automatic name.')}</span>
				</div>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return this.label.trim()
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-zone-header': TimeZoneHeader
		'mitra-dialog-time-zone-rename': DialogTimeZoneRename
	}
}
