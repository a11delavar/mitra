import { Component, component, html, css, state, property, event, repeat, query, bind } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type UserTimeZone } from '../../identity/User.js'
import { getTimeZones, setTimeZones } from '../../../infrastructure/http/Api.js'
import { type TimeZonePicker, zoneNamePart, shortZoneLabel, longZoneName, systemZoneId, systemZoneLabel, setSystemZoneLabel } from './TimeZonePicker.js'

/**
 * The day grid's time-axis header: one compact label per displayed zone (the user's additional zones
 * first, the system zone last (adjacent to the days; it anchors the grid and can't be removed), plus
 * the affordances around them: a hover-revealed "+" opening a searchable picker over every IANA zone,
 * and a per-zone menu to rename (a custom short label like "DE") or remove. Mutations persist via the
 * user settings API and fire `change`, so the host re-renders its axis columns.
 *
 * The additional zones' columns FOLD (the host owns the state and the gesture, see
 * TimeZoneLaneController); this contributes the chevron that asks for it, and clips its own labels
 * against `--zone-width` so they can shrink away with the tracks they sit in.
 */
@component('mitra-time-zone-header')
export class TimeZoneHeader extends Component {
	/** Whether the additional zones' columns are currently tucked away (the host's fold state). */
	@property({ type: Boolean, reflect: true }) folded = false

	/** Fired after the zone list changed (added/renamed/removed). */
	@event() readonly change!: EventDispatcher

	/** Asks the host for a fold state: `true` tucks the additional zones away, `false` brings them out. */
	@event() readonly fold!: EventDispatcher<boolean>

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
		// A zone added into a folded lane would land in a column nobody can see, so the lane comes out
		// with it, since the new column is the whole point of the interaction.
		this.fold.dispatch(false)
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

	private readonly togglePicker = (e: Event) => {
		this.picker?.toggle(e.currentTarget as HTMLElement)
	}

	static override get styles() {
		return css`
			mitra-time-zone-header {
				/* The header adopts the day grid's OWN tracks (through the .timezone cell's subgrid):
				   the affordances on the leading track, one label per zone track, the exact tracks
				   the axis hours below sit on, so alignment is the grid's job, not a coincidence. */
				grid-column: 1 / -1;
				display: grid;
				grid-template-columns: subgrid;
				align-items: center;

				> .actions {
					justify-self: center;
					/* The positioning context for the fold chevron, which hangs BELOW this cell rather than
					   beside the "+". The leading track therefore stays exactly as wide as the "+" alone:
					   it is sticky chrome, so a second in-flow icon would cost the day columns that width
					   for the entire life of the view, in the very state (unfolded) where a fold button
					   matters least. */
					position: relative;
					display: flex;
					align-items: center;
					color: var(--color-text-muted);

					> .add {
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					/* Out of flow, in the empty all-day corner directly under the "+", and revealed with it.
					   Hover and keyboard focus are its only triggers; touch has neither, and that's the
					   deliberate trade: there the rail drag IS the affordance, and it's the folded lane
					   (which needs no button to advertise itself) a phone starts in.

					   The block padding keeps its box FLUSH against the "+" so travelling down to it never
					   leaves the header and blinks the reveal off, while the glyph itself lands clear of the
					   all-day lane's top border. pointer-events follow the reveal: an invisible toggle
					   sitting over the corner would otherwise swallow clicks aimed at the grid.

					   The chevron points where the lane is about to go: toward the days while the other
					   zones are tucked away, back at the axis once they are out. Flipped in RTL, where
					   inline-end is the other way. 180° on top of that mirror is a plain vertical flip,
					   which a chevron is symmetric under, so the two compose correctly. */
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

					/* An additional zone's label is one of the two cells that FOLD their column (the axis
					   hours below are the other, see the [data-foreign] rule in Days.ts, which explains
					   why a definite max-inline-size is what lets the auto track follow). Clipped and
					   un-padded so it can reach zero, and faded by the same width ratio. The anchor zone's
					   label (the one without this attribute) never folds, so it keeps the plain 100% cap
					   above and takes exactly the width it needs. */
					&[data-alternative] {
						max-inline-size: var(--zone-width);
						overflow: clip;
						/* Halved against the ceiling because there are TWO of them: padding is never reduced
						   to honour a max-inline-size, so a plain min(0.25rem, ceiling) would hold the last
						   few pixels of the fold open at 0.5rem. */
						padding-inline: min(0.25rem, calc(var(--zone-width) / 2));
						opacity: clamp(0, tan(atan2(var(--zone-width), var(--zone-lane-width))), 1);
					}
				}

				/* Tucked away, an alternative zone's chip is a zero-width invisible button, so it must stop
				   answering the pointer too (the template drops it out of the tab order to match). */
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
		const zones = getTimeZones()
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
			${repeat(zones, zone => zone.id, zone => html`
				<mitra-popover-container>
					<button class="zone" data-alternative tabindex=${this.folded ? -1 : 0} title=${longZoneName(zone.id)}>
						${shortZoneLabel(zone)}
					</button>
					<mitra-menu slot="popover">
						<mitra-menu-item icon="pencil" @click=${() => void this.rename(zone).catch(() => void 0)}>${t('Rename')}</mitra-menu-item>
						<mitra-menu-item icon="x" variant="danger" @click=${() => this.removeZone(zone)}>${t('Remove')}</mitra-menu-item>
					</mitra-menu>
				</mitra-popover-container>
			`)}
			<mitra-popover-container>
				<button class="zone" title=${longZoneName()}>
					${shortZoneLabel()}
				</button>
				<mitra-menu slot="popover">
					<mitra-menu-item icon="pencil" @click=${() => void this.renameSystem().catch(() => void 0)}>${t('Rename')}</mitra-menu-item>
				</mitra-menu>
			</mitra-popover-container>
			<mitra-time-zone-picker
				.exclude=${new Set([...zones.map(zone => zone.id), systemZoneId()])}
				@pick=${(e: CustomEvent<string>) => this.add(e.detail)}
			></mitra-time-zone-picker>
		`
	}
}

/** Rename dialog: a short custom label for the column ("DE"); empty resets to the automatic name. */
@component('mitra-dialog-time-zone-rename')
export class DialogTimeZoneRename extends DialogComponent<{ readonly zone: UserTimeZone }, string | undefined> {
	@state() label = this.parameters.zone.label ?? ''

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Rename time zone')} primaryButtonText=${t('Save')} primaryOnEnter>
				<mitra-text-field label=${t('Name')} autofocus placeholder=${zoneNamePart(this.parameters.zone.id, 'short')} maxlength="24"
					hint=${t('Shown above the time axis. Leave empty to use the automatic name.')}
					${bind(this, 'label')}
				></mitra-text-field>
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
