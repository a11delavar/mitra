import { Component, component, html, css, state, event, repeat, query } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type UserTimeZone } from 'shared'
import { getTimeZones, setTimeZones } from '../Api.js'
import { type TimeZonePicker, zoneNamePart, shortZoneLabel, longZoneName, systemZoneId, systemZoneLabel, setSystemZoneLabel } from './TimeZonePicker.js'

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

	protected override createRenderRoot() { return this }

	@query('mitra-time-zone-picker') private readonly picker?: TimeZonePicker

	private async commit(timeZones: Array<UserTimeZone>) {
		await setTimeZones(timeZones)
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly add = (id: string) => {
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
			<mitra-time-zone-picker style="position-anchor: ${this.anchor}-add"
				.exclude=${new Set([...getTimeZones().map(zone => zone.id), systemZoneId()])}
				@pick=${(e: CustomEvent<string>) => this.add(e.detail)}
			></mitra-time-zone-picker>
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
