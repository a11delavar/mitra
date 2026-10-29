import { Component, component, html, css, state, property, event, repeat, query, bind } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { TimeZone } from '../TimeZone.js'
import { UserTimeZones } from '../UserTimeZones.js'
import { type TimeZonePicker } from './TimeZonePicker.js'
import { TimeZones } from './TimeZones.js'

/**
 * The day grid's time-axis header: one label per zone, the device's last beside the days (it anchors the grid and is
 * never removed). The host owns the fold (`TimeZoneLaneController`); the other labels clip to `--zone-width`.
 */
@component('mitra-time-zone-header')
export class TimeZoneHeader extends Component {
	/** Mirrors the host's fold state. */
	@property({ type: Boolean, reflect: true }) folded = false

	@event() readonly change!: EventDispatcher

	/** Asks the host to fold (`true`) or unfold the other zones. */
	@event() readonly fold!: EventDispatcher<boolean>

	protected override createRenderRoot() { return this }

	@query('mitra-time-zone-picker') private readonly picker?: TimeZonePicker

	private async commit(change: Promise<unknown>) {
		await change
		this.requestUpdate()
		this.change.dispatch()
	}

	/** A pick adds or removes a column; the device's zone and home stay. */
	private readonly toggle = (zone: TimeZone) => {
		if (zone.equals(TimeZones.here) || TimeZones.list.isHome(zone)) {
			return
		}
		if (TimeZones.list.has(zone)) {
			this.removeZone(zone)
			return
		}
		// A zone added to a folded lane would land in a column nobody can see, so the lane unfolds with it.
		this.fold.dispatch(false)
		this.commit(TimeZones.add(zone)).catch(() => void 0)
	}

	private readonly removeZone = (zone: TimeZone) => {
		this.commit(TimeZones.remove(zone)).catch(() => void 0)
	}

	private readonly makeHome = (zone: TimeZone) => {
		this.commit(TimeZones.makeHome(zone)).catch(() => void 0)
	}

	private readonly rename = async (zone: TimeZone) => {
		const label = await new DialogTimeZoneRename({ zone }).confirm()
		if (label === undefined) {
			return // cancelled
		}
		await this.commit(TimeZones.rename(zone, label || undefined))
	}

	private titleOf(zone: TimeZone) {
		const name = zone.name().long
		return TimeZones.list.isHome(zone) ? `${name} · ${t('Home')}` : name
	}

	/** Home is replaced, never removed; the device's zone is not `removable`. */
	private menuTemplate(zone: TimeZone, removable: boolean) {
		const home = TimeZones.list.isHome(zone)
		return html`
			<mitra-menu slot="popover">
				<mitra-menu-item icon="pencil" @click=${() => void this.rename(zone).catch(() => void 0)}>${t('Rename')}</mitra-menu-item>
				${home ? html.nothing : html`<mitra-menu-item icon="house" @click=${() => this.makeHome(zone)}>${t('Make home')}</mitra-menu-item>`}
				${home || !removable ? html.nothing : html`<mitra-menu-item icon="x" variant="danger" @click=${() => this.removeZone(zone)}>${t('Remove')}</mitra-menu-item>`}
			</mitra-menu>
		`
	}

	private readonly togglePicker = (e: Event) => {
		this.picker?.toggle(e.currentTarget as HTMLElement)
	}

	static override get styles() {
		return css`
			mitra-time-zone-header {
				/* Adopts the day grid's own tracks through the .timezone cell's subgrid, so each label sits on its axis column. */
				grid-column: 1 / -1;
				display: grid;
				grid-template-columns: subgrid;
				align-items: center;

				> .actions {
					justify-self: center;
					/* The fold chevron hangs below this cell, so the sticky leading track stays as wide as the "+" alone. */
					position: relative;
					display: flex;
					align-items: center;
					color: var(--color-text-muted);

					> .add {
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					/* Its block padding keeps it flush with the "+", so moving down to it never ends the hover that reveals it
					   (touch has none: there the rail drag is the affordance). pointer-events follow the reveal, or the hidden
					   toggle would swallow clicks aimed at the grid. */
					> .fold {
						position: absolute;
						inset-inline: 0;
						top: 100%;
						justify-content: center;
						padding-block-start: 0.5rem;
						opacity: 0;
						pointer-events: none;
						transition: opacity 0.15s ease;

						&::part(icon) {
							transition: rotate 0.24s cubic-bezier(0.2, 0, 0, 1);
						}
					}
				}

				&:hover > .actions > .add,
				&:focus-within > .actions > .add {
					opacity: 1;
				}

				&:hover > .actions > .fold,
				&:focus-within > .actions > .fold {
					opacity: 1;
					pointer-events: auto;
				}

				&:dir(rtl) > .actions > .fold::part(icon) {
					scale: -1 1;
				}

				&:not([folded]) > .actions > .fold::part(icon) {
					rotate: 180deg;
				}

				> mitra-popover-container > .zone {
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

					/* Folds its column with the axis hours, exactly as wide as the lane (see [data-foreign] in Days.ts): clipped
					   and unpadded to reach zero, faded by the width ratio. */
					&[data-alternative] {
						inline-size: var(--zone-width);
						overflow: clip;
						/* Padding is never reduced to honour an inline-size, so each side takes at most half the
						   width, or the fold would stall at 0.5rem. */
						padding-inline: min(0.25rem, calc(var(--zone-width) / 2));
						opacity: clamp(0, tan(atan2(var(--zone-width), var(--zone-lane-width))), 1);
					}
				}

				/* A folded label is zero-width but still a button (the template drops it from the tab order). */
				&[folded] > mitra-popover-container > .zone[data-alternative] {
					pointer-events: none;
				}

				mitra-menu {
					position-area: block-end span-inline-end;
				}
			}
		`
	}

	protected override get template() {
		const here = TimeZones.here
		const zones = TimeZones.besides
		return html`
			<div class="actions">
				${zones.length === 0 ? html.nothing : html`
					<mitra-icon-button size="small" class="fold" icon="chevrons-right"
						label=${this.folded ? t('Show the other time zones') : t('Hide the other time zones')}
						@click=${() => this.fold.dispatch(!this.folded)}
					></mitra-icon-button>
				`}
				<mitra-icon-button size="small" class="add" icon="plus" label=${t('Add time zone')} @click=${this.togglePicker}></mitra-icon-button>
			</div>
			${repeat(zones, ({ zone }) => zone.id, ({ zone }) => html`
				<mitra-popover-container>
					<button class="zone" data-alternative tabindex=${this.folded ? -1 : 0} title=${this.titleOf(zone)}>
						${TimeZones.list.headingOf(zone)}
					</button>
					${this.menuTemplate(zone, true)}
				</mitra-popover-container>
			`)}
			<mitra-popover-container>
				<button class="zone" title=${this.titleOf(here)}>
					${TimeZones.list.headingOf(here)}
				</button>
				${this.menuTemplate(here, false)}
			</mitra-popover-container>
			<mitra-time-zone-picker
				.selected=${[here, ...zones.map(({ zone }) => zone)]}
				@pick=${(e: CustomEvent<TimeZone>) => this.toggle(e.detail)}
			></mitra-time-zone-picker>
		`
	}
}

/** An empty name goes back to the automatic one. */
@component('mitra-dialog-time-zone-rename')
export class DialogTimeZoneRename extends DialogComponent<{ readonly zone: TimeZone }, string | undefined> {
	@state() label = TimeZones.list.labelOf(this.parameters.zone) ?? ''

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Rename time zone')} primaryButtonText=${t('Save')} primaryOnEnter>
				<mitra-text-field label=${t('Name')} autofocus placeholder=${this.parameters.zone.name().short} maxlength=${UserTimeZones.maximumLabelLength}
					hint=${t('Shown above the time axis. Leave empty to use the automatic name.')}
					${bind(this, 'label')}
				></mitra-text-field>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return this.label.trim()
	}

	protected override cancellationAction() {
		return undefined
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-zone-header': TimeZoneHeader
		'mitra-dialog-time-zone-rename': DialogTimeZoneRename
	}
}
