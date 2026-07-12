import { Component, component, html, css, property, state, event, eventListener, repeat } from '@a11d/lit'
import { type UserTimeZone } from 'shared'

// --- Zone presentation (shared by the axis header, the picker, and the entry editor) ----------------

/** One `timeZoneName` part off Intl, in the UI language; `zoneId` undefined = the system zone. */
export function zoneNamePart(zoneId: string | undefined, style: 'short' | 'long' | 'shortOffset' | 'longOffset'): string {
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

/** The full name for tooltips ("Central European Summer Time"). */
export function longZoneName(zoneId?: string): string {
	return zoneNamePart(zoneId, 'long')
}

/** The zone the browser runs in — the grid's anchor; never offered (or storable) as an addition. */
export function systemZoneId(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** The zone id's city segment ("Asia/Tehran" → "Tehran") — the most recognizable compact handle a
 * zone has; the offsets and generic names collide across zones, the city never does within one. */
export function zoneCity(zoneId: string): string {
	return zoneId.split('/').at(-1)!.replaceAll('_', ' ')
}

// Renames of the SYSTEM zone live in localStorage, not the database: the system zone is browser state
// (it changes when the device travels), so its label is browser state too — no second source of truth
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
		// Storage unavailable — the rename just doesn't stick.
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
				city: zoneCity(id),
			}
		})
		.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
}

/**
 * A time zone picker as an anchored POPOVER (the host element IS the popover): search-as-you-type over
 * every IANA zone, arrow-key + Enter selection, the popover glass. The opener anchors it (sets
 * `position-anchor` on this element) and calls `togglePopover()`; a chosen zone id is dispatched as
 * `pick` and the popover closes itself. `exclude` hides ids that would be no-ops for the caller.
 */
@component('mitra-time-zone-picker')
export class TimeZonePicker extends Component {
	/** Fired with the picked IANA zone id. */
	@event() readonly pick!: EventDispatcher<string>

	/** Zone ids not to offer (e.g. already-shown columns). */
	@property({ type: Object }) exclude?: ReadonlySet<string>

	/** The caller's current zone id — pinned to the top and check-marked, so the picker opens on it. */
	@property() selected?: string

	@state() private query = ''
	@state() private activeIndex = -1

	protected override createRenderRoot() { return this }

	protected override connected() {
		super.connected()
		this.setAttribute('popover', '')
	}

	private get filteredRows(): ReadonlyArray<ZoneRow> {
		const rows = !this.exclude?.size ? allZoneRows() : allZoneRows().filter(row => !this.exclude!.has(row.id))
		const query = this.query.trim().toLowerCase()
		const matches = !query ? rows : rows.filter(row =>
			row.city.toLowerCase().includes(query)
			|| row.name.toLowerCase().includes(query)
			|| row.offset.toLowerCase().includes(query)
			|| row.id.toLowerCase().includes(query))
		// Pin the browser's own zone (the reset target) to the top, so it never hides in the offset order.
		// The caller's CURRENT zone is deliberately NOT hoisted — it stays in its natural offset position
		// and the picker scrolls to it on open (see handleToggle), so the user lands among its neighbours.
		const system = systemZoneId()
		return [...matches.filter(row => row.id === system), ...matches.filter(row => row.id !== system)]
	}

	@eventListener('toggle')
	protected handleToggle(e: ToggleEvent) {
		if (e.newState === 'open') {
			this.query = ''
			// Open highlighted on the current zone in its natural position, and CENTER it in view — so the
			// user sees it selected among its offset-neighbours (Enter re-picks it). Typing resets to -1.
			this.activeIndex = this.filteredRows.findIndex(row => row.id === this.selected)
			const input = this.querySelector('input')
			input?.focus()
			if (input) {
				input.value = ''
			}
			this.updateComplete.then(() => this.querySelector('.rows [data-active]')?.scrollIntoView({ block: 'center' }))
		}
	}

	private choose(id: string) {
		this.hidePopover()
		this.pick.dispatch(id)
	}

	private readonly handleInput = (e: Event) => {
		this.query = (e.target as HTMLInputElement).value
		this.activeIndex = -1
	}

	private readonly handleKeydown = (e: KeyboardEvent) => {
		const rows = this.filteredRows
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			const delta = e.key === 'ArrowDown' ? 1 : -1
			this.activeIndex = rows.length ? (this.activeIndex + delta + rows.length) % rows.length : -1
			this.updateComplete.then(() => this.querySelector('.rows [data-active]')?.scrollIntoView({ block: 'nearest' }))
		} else if (e.key === 'Enter') {
			// The highlighted row, or — straight after typing — the top match.
			e.preventDefault()
			const row = rows[this.activeIndex] ?? rows[0]
			if (row) {
				this.choose(row.id)
			}
		}
	}

	static override get styles() {
		return css`
			mitra-time-zone-picker {
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

				/* The search reads as a plain row of the popover (no box, no focus ring — the caret and
				   the filtering are feedback enough), separated from the results by a hairline. */
				> input.search {
					flex-shrink: 0;
					background: transparent;
					border: none;
					border-radius: 0;
					border-block-end: 1px solid rgba(255, 255, 255, 0.06);
					padding-block: 0.4rem;
					padding-inline: 0.5rem;

					&:hover,
					&:focus-visible {
						background: transparent;
						border-color: transparent;
						border-block-end-color: rgba(255, 255, 255, 0.06);
						box-shadow: none;
					}
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
						&:hover,
						&[data-active] {
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

						/* The caller's current zone, pinned near the top and check-marked. */
						&[data-selected] {
							background: color-mix(in srgb, var(--color-accent) 12%, transparent);
						}

						> .check {
							margin-inline-start: auto;
							flex-shrink: 0;
							color: var(--color-accent);
							font-size: 0.9rem;
						}

						/* Tags the browser's own zone, hoisted to the top as the "reset to default" pick. */
						> .primary {
							margin-inline-start: auto;
							flex-shrink: 0;
							color: var(--color-text-muted);
							font-size: 0.6875rem;
							text-transform: uppercase;
							letter-spacing: 0.04em;
						}

						/* When both a check and the primary tag trail, the check owns the auto-margin; the tag follows it. */
						> .check ~ .primary { margin-inline-start: 0.375rem; }
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<input class="search" placeholder="Time zone" autocomplete="off" spellcheck="false"
				@input=${this.handleInput}
				@keydown=${this.handleKeydown}>
			<div class="rows">
				${repeat(this.filteredRows, row => row.id, (row, index) => html`
					<button type="button" ?data-active=${index === this.activeIndex} ?data-selected=${row.id === this.selected} @click=${() => this.choose(row.id)}>
						<span class="offset">${row.offset}</span>
						<span class="name">${row.name}</span>
						<span class="city">– ${row.city}</span>
						${row.id !== this.selected ? html.nothing : html`<mitra-icon class="check" icon="check"></mitra-icon>`}
						${row.id !== systemZoneId() ? html.nothing : html`<span class="primary">primary</span>`}
					</button>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-zone-picker': TimeZonePicker
	}
}
