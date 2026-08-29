import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Temporal } from 'temporal-polyfill'
import { FLOATING_TIME_ZONE, type Entry } from '../Entry.js'
import { type TimeZonePicker, longZoneName, systemZoneId, zoneCity, zoneNamePart } from '../../time/client/TimeZonePicker.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { DefaultDurationSetting } from './DefaultDurationSetting.js'
import { controlHeight } from '../../../design/controlHeight.css.js'

/**
 * Date, time, all-day, and time zone editor for an entry.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.endDateShown = false; this.dateShown = false; this.showEventZone = false }
	}) entry!: Entry

	override role = 'listitem'

	@event() readonly change!: EventDispatcher

	readonly store = new EntryStore(this)

	@state() private endDateShown = false
	@state() private dateShown = false
	@state() private showEventZone = false

	protected override createRenderRoot() { return this }

	/** Zone used for display and editing in native date/time fields. */
	private get zone(): string {
		return this.entry.allDay ? systemZoneId()
			: this.entry.timeZone === FLOATING_TIME_ZONE ? 'UTC'
				: this.foreignZone && !this.showEventZone ? systemZoneId()
					: this.entry.timeZone ?? systemZoneId()
	}

	private wall(dt: DateTime): Temporal.PlainDateTime {
		return Temporal.Instant.fromEpochMilliseconds(dt.valueOf()).toZonedDateTimeISO(this.zone).toPlainDateTime()
	}

	private toInstant(wall: Temporal.PlainDateTime): DateTime {
		return new DateTime(wall.toZonedDateTime(this.zone, { disambiguation: 'compatible' }).epochMilliseconds)
	}

	private dateValue(dt: DateTime) {
		const wall = this.wall(dt)
		return `${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
	}

	private timeValue(dt: DateTime) {
		const wall = this.wall(dt)
		return `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}`
	}

	private withDate(value: string, base: DateTime) {
		const [year, month, day] = value.split('-').map(Number)
		return this.toInstant(this.wall(base).with({ year, month, day }))
	}

	private withTime(value: string, base: DateTime) {
		const [hour, minute] = value.split(':').map(Number)
		return this.toInstant(this.wall(base).with({ hour, minute, second: 0, millisecond: 0 }))
	}

	private readonly openPicker = (e: Event) => {
		if (!this.editable) {
			return
		}
		try {
			(e.currentTarget as HTMLInputElement).showPicker()
		} catch {
			// showPicker is unsupported or blocked.
		}
	}

	private commit() {
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly handleStartDateChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value) return
		if (!this.entry.start) {
			this.entry.scheduleAt(new DateTime(`${value}T00:00:00`), true, DefaultDurationSetting.current)
		} else {
			this.entry.moveStart(this.withDate(value, this.entry.start))
		}
		this.commit()
	}

	private readonly handleEndDateChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value || !this.entry.start) return
		this.entry.setEnd(this.withDate(value, this.entry.allDay ? this.entry.inclusiveEnd : this.entry.effectiveEnd))
		this.commit()
	}

	private readonly handleStartTimeChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value || !this.entry.start) return
		this.entry.moveStart(this.withTime(value, this.entry.start))
		this.commit()
	}

	private readonly handleEndTimeChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value || !this.entry.start) return
		this.entry.setEnd(this.withTime(value, this.entry.effectiveEnd))
		this.commit()
	}

	private readonly toggleAllDay = () => {
		this.entry.setAllDay(!this.entry.allDay, DefaultDurationSetting.current)
		this.commit()
	}

	@query('mitra-time-zone-picker') private readonly zonePicker?: TimeZonePicker
	@query('.end-date') private readonly endDateInput?: HTMLInputElement
	@query('.start-date') private readonly startDateInput?: HTMLInputElement

	private get foreignZone(): string | undefined {
		const zone = this.entry.timeZone
		return zone && zone !== FLOATING_TIME_ZONE && zone !== systemZoneId() ? zone : undefined
	}

	private get zoneReadonly(): boolean {
		return !this.editable || (!!this.foreignZone && !this.showEventZone)
	}

	private get zoneLabel(): string {
		if (this.entry.timeZone === FLOATING_TIME_ZONE) {
			return t('Wall clock — no time zone')
		}
		const shown = this.foreignZone && this.showEventZone ? this.foreignZone : systemZoneId()
		return `${zoneNamePart(shown, 'shortOffset')} ${zoneCity(shown)}`
	}

	private get zoneIsPrimary(): boolean {
		return this.entry.timeZone !== FLOATING_TIME_ZONE && !(this.foreignZone && this.showEventZone)
	}

	private get zoneTitle(): string {
		if (this.zoneReadonly && this.foreignZone && !this.showEventZone) {
			return t('Primary time zone — switch to ${city} time to change the zone', { city: zoneCity(this.foreignZone) })
		}
		const zone = this.entry.timeZone ?? undefined
		return !zone ? t('Time zone')
			: zone === FLOATING_TIME_ZONE ? t('Wall clock — no time zone')
				: `${zoneCity(zone)} — ${longZoneName(zone)} (${zoneNamePart(zone, 'longOffset')})`
	}

	private get lensTitle(): string {
		const city = this.foreignZone ? zoneCity(this.foreignZone) : ''
		return this.showEventZone
			? t('Showing ${city} time — switch to the primary time zone', { city })
			: t('Showing the primary time zone — switch to ${city} time', { city })
	}

	private readonly toggleLens = () => {
		this.showEventZone = !this.showEventZone
	}

	private readonly handleZonePick = (e: CustomEvent<string>) => {
		this.entry.setTimeZone(e.detail)
		this.showEventZone = e.detail !== systemZoneId()
		this.commit()
	}

	private get displayMultiDay(): boolean {
		if (this.entry.allDay || !this.entry.start || !this.entry.end) {
			return this.entry.multiDay
		}
		return this.dateValue(this.entry.start) !== this.dateValue(this.entry.inclusiveEnd)
	}

	private readonly addEndDate = async () => {
		this.endDateShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		try {
			this.endDateInput?.showPicker()
		} catch {
			// Ignore if showPicker is blocked.
		}
	}

	private readonly addDate = async () => {
		this.dateShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		try {
			this.startDateInput?.showPicker()
		} catch {
			// Ignore if showPicker is blocked.
		}
	}

	private readonly clearDate = () => {
		this.entry.unschedule()
		this.dateShown = false
		this.commit()
	}

	private readonly clearEndDate = () => {
		this.entry.setEnd(this.entry.allDay ? this.entry.start! : this.withDate(this.dateValue(this.entry.start!), this.entry.effectiveEnd))
		this.endDateShown = false
		this.commit()
	}

	private get clearable() {
		return this.editable && this.entry.unschedulable && !this.entry.partOfSeries
	}

	private get editable() {
		return getCapabilities(this.entry.sourceId).editEntries
	}

	static override get styles() {
		return css`
			mitra-entry-details-when {
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				row-gap: 0.125rem;

				> .row {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					${controlHeight};
					min-height: var(--control-height);

					&.field { margin-inline: -0.5rem; }
					&:not(.field) { align-items: center; }

					> mitra-icon { grid-column: 1; font-size: 0.87rem; color: var(--color-text-muted); flex-shrink: 0; }
					> .switch { grid-column: 1; align-self: center; }

					&:is(:hover, :focus-within, :has(:popover-open)) .chevron {
						opacity: 1;
					}
				}

				.dates, .times {
					grid-column: 2;
					display: grid;
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					column-gap: 0.25rem;

					> .field {
						--field-padding-inline: 0.25rem;
						&:first-child { margin-inline-start: calc(-1 * var(--field-padding-inline)); }
						&:last-child { margin-inline-end: -0.5rem; }

						display: flex;
						align-items: center;
						gap: 0.5rem;

						> input { flex: 1; min-width: 0; }
					}
				}

				.zone {
					grid-column: 2;
					display: flex;
					gap: 0.25rem;
					min-inline-size: 0;

					> .zone-label {
						all: unset;
						flex: 1 1 auto;
						display: flex;
						align-items: center;
						min-inline-size: 0;
						cursor: pointer;

						> .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
						> .chevron { margin-inline-start: auto; font-size: 1.125rem; color: color-mix(in srgb, var(--color-text) 60%, transparent); opacity: 0; transition: opacity 0.15s ease; }

						&:disabled {
							cursor: default;
							color: var(--color-text-muted);
							> .chevron { display: none; }
						}
					}

					> .lens {
						flex-shrink: 0;
						align-self: center;
						font-size: 0.85rem;
						color: var(--color-text-muted);

						&[data-localized] { color: var(--color-accent); }
					}
				}

				mitra-time-zone-picker {
					background: var(--mitra-entry-surface);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
					margin: 0;
					margin-inline: 0.875rem;
				}

				.add-end {
					cursor: pointer;
				}

				.clear {
					flex-shrink: 0;
					align-self: center;
					font-size: 0.85rem;
					color: var(--color-text-muted);
					opacity: 0;
					transition: opacity 0.15s ease;
					margin-inline-end: -0.25rem;
				}

				.dates > .field:hover > .clear,
				.dates > .field:focus-within > .clear,
				.clear:focus-visible {
					opacity: 1;
				}

				@media (pointer: coarse) {
					.clear {
						opacity: 1;
					}
				}

				input::-webkit-calendar-picker-indicator {
					display: none;
				}
			}
		`
	}

	protected override get template() {
		if (!this.entry) {
			return html.nothing
		}
		if (!this.entry.start) {
			return html`
				<div class="row">
					<mitra-icon icon="calendar-plus"></mitra-icon>
					<div class="dates">
						${!this.editable ? html`
							<span class="allday-label">${t('No date')}</span>
						` : this.dateShown ? html`
							<div class="field">
								<input type="date" class="start-date" aria-label=${t('Date')} .value=${''} @click=${this.openPicker} @change=${this.handleStartDateChange}>
							</div>
						` : html`
							<button class="field add-end" @click=${this.addDate}>
								<mitra-icon icon="plus"></mitra-icon>
								<span class="placeholder">${t('Date')}</span>
							</button>
						`}
					</div>
				</div>
			`
		}
		return html`
			<div class="row">
				<mitra-icon icon=${this.entry.allDay ? 'calendar-days' : 'clock'}></mitra-icon>
				<div class="dates">
					<div class="field">
						<input type="date" class="start-date" aria-label=${t('Start date')} ?readonly=${!this.editable} .value=${this.dateValue(this.entry.start)} @click=${this.openPicker} @change=${this.handleStartDateChange}>
						${!this.clearable ? html.nothing : html`
							<mitra-icon-button class="clear" icon="x" label=${t('Remove the date')} title=${t('Remove the date — the task moves to Unscheduled')} @click=${this.clearDate}></mitra-icon-button>
						`}
					</div>
					${!this.displayMultiDay && !this.endDateShown ? (!this.editable ? html.nothing : html`
						<button class="field add-end" @click=${this.addEndDate}>
							<mitra-icon icon="plus"></mitra-icon>
							<span class="placeholder">${t('End date')}</span>
						</button>
					`) : html`
						<div class="field">
							<mitra-icon icon="arrow-right"></mitra-icon>
							<input type="date" class="end-date" aria-label=${t('End date')} ?readonly=${!this.editable} .value=${this.dateValue(this.entry.inclusiveEnd)} @click=${this.openPicker} @change=${this.handleEndDateChange}>
							${!this.editable ? html.nothing : html`
								<mitra-icon-button class="clear" icon="x" label=${t('Remove the end date')} @click=${this.clearEndDate}></mitra-icon-button>
							`}
						</div>
					`}
				</div>
			</div>
			<div class="row">
				<button class="switch" role="switch" aria-label=${t('All day')} title=${this.entry.allDay ? t('Include time') : t('Switch to all-day')}
					aria-checked=${!this.entry.allDay} @click=${this.toggleAllDay}
					?hidden=${!this.editable || !getCapabilities(this.entry.sourceId).allDay}
				></button>
				<div class="times">
					${this.entry.allDay ? html`
						<span class="allday-label">${t('All day')}</span>
						` : html`
							<input type="time" class="field" aria-label=${t('Start time')} ?readonly=${!this.editable} .value=${this.timeValue(this.entry.start)} @click=${this.openPicker} @change=${this.handleStartTimeChange}>
							<div class="field">
								<mitra-icon icon="arrow-right"></mitra-icon>
								<input type="time" aria-label=${t('End time')} ?readonly=${!this.editable} .value=${this.timeValue(this.entry.effectiveEnd)} @click=${this.openPicker} @change=${this.handleEndTimeChange}>
							</div>
						`}
				</div>
			</div>
			${this.entry.allDay || !getCapabilities(this.entry.sourceId).timeZone ? html.nothing : html`
				<div class="row field">
					<mitra-icon icon="globe"></mitra-icon>
					<div class="zone">
						<button class="zone-label" ?disabled=${this.zoneReadonly}
							?data-placeholder=${this.zoneIsPrimary}
							title=${this.zoneTitle} aria-label=${this.zoneTitle}
							@click=${() => this.zonePicker?.togglePopover()}
						>
							<span class="text">${this.zoneLabel}</span>
							<mitra-icon class="chevron" icon="chevron-down"></mitra-icon>
						</button>
						${!this.foreignZone ? html.nothing : html`
							<mitra-icon-button class="lens" ?data-localized=${!this.showEventZone}
								icon=${this.showEventZone ? 'earth' : 'house'}
								label=${this.lensTitle} @click=${this.toggleLens}
							></mitra-icon-button>
							`}
					</div>
					<mitra-time-zone-picker
						.selected=${this.entry.timeZone && this.entry.timeZone !== FLOATING_TIME_ZONE ? this.entry.timeZone : systemZoneId()}
						@pick=${this.handleZonePick}
					></mitra-time-zone-picker>
				</div>
			`}
			${!getCapabilities(this.entry.sourceId).recurrence ? html.nothing : html`
				<div class="row field">
					<mitra-icon icon="repeat"></mitra-icon>
					<mitra-repeat-field .entry=${this.entry} @change=${() => this.commit()}></mitra-repeat-field>
				</div>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-when': EntryDetailsWhen
	}
}
