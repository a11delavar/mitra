import { Component, component, html, css, property, state, event, query, live } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Temporal } from 'temporal-polyfill'
import { FLOATING_TIME_ZONE, type Entry } from '../Entry.js'
import { type TimeZonePicker, longZoneName, systemZoneId, zoneCity, zoneNamePart } from '../../time/client/TimeZonePicker.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { DefaultDurationSetting } from './DefaultDurationSetting.js'
import { controlHeight } from '../../../design/controlHeight.css.js'
import { type DateField } from '../../../design/DateTimeField.js'
import { type DurationField } from '../../../design/DurationField.js'

/**
 * Date, time, all-day, due, estimate, time zone and repeat editor for an entry.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.endDateShown = false; this.dateShown = false; this.dueShown = false; this.estimateShown = false; this.showEventZone = false }
	}) entry!: Entry

	override role = 'listitem'

	@event() readonly change!: EventDispatcher
	/** Asks the page to bring an entry whose dates changed into view: on the calendar, or in the planning list without a start. */
	@event({ bubbles: true, composed: true }) readonly reveal!: EventDispatcher<Entry>

	readonly store = new EntryStore(this)

	@state() private endDateShown = false
	@state() private dateShown = false
	@state() private dueShown = false
	@state() private estimateShown = false
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

	private commit() {
		const { entry } = this
		this.requestUpdate()
		this.change.dispatch()
		this.reveal.dispatch(entry)
		// A new span can land the entry on another day or lane, where a new segment renders it; once that has
		// rendered, it opens the editor again rather than letting it close with the old one.
		if (!entry.partOfSeries) {
			setTimeout(() => entry.id ? EntryEditorIntent.requestOpen(entry.id) : EntryEditorIntent.openDraft(entry))
		}
	}

	private readonly handleStartDateChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value) return
		if (!this.entry.start) {
			// An estimate shorter than a day asks for hours, so the task gets a time; anything else takes the whole day.
			const timed = !!this.entry.estimate && TimeSpan.fromMinutes(this.entry.estimate).days < 1
			this.entry.scheduleAt(new DateTime(`${value}T${timed ? '09' : '00'}:00:00`), !timed, DefaultDurationSetting.current)
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

	private readonly addEndTime = () => {
		this.entry.setEnd(this.entry.start!.add({ minutes: DefaultDurationSetting.current }))
		this.commit()
	}

	private readonly clearEndTime = () => {
		this.entry.end = undefined
		this.commit()
	}

	private readonly handleDueDateChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value) return
		const { entry } = this
		// A first due on an unscheduled task is a day; nothing else depends on the entry's precision yet.
		if (!entry.start && !entry.due) {
			entry.allDay = true
		}
		entry.due = entry.allDay ? new DateTime(`${value}T00:00:00`)
			: entry.due ? this.withDate(value, entry.due)
				: this.toInstant(Temporal.PlainDate.from(value).toPlainDateTime({ hour: 17 }))
		this.commit()
	}

	private readonly handleDueTimeChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value || !this.entry.due) return
		this.entry.due = this.withTime(value, this.entry.due)
		this.commit()
	}

	private readonly addDue = async () => {
		this.dueShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		this.dueDateInput?.showPicker()
	}

	private readonly clearDue = () => {
		this.entry.due = undefined
		this.dueShown = false
		this.commit()
	}

	private readonly addEstimate = async () => {
		this.estimateShown = true
		await this.updateComplete
		this.estimateInput?.focus()
		this.estimateInput?.showPicker()
	}

	private readonly handleEstimateChange = (e: CustomEvent<number | undefined>) => {
		this.entry.estimate = e.detail ?? null
		this.estimateShown = false
		this.commit()
	}

	/** The estimate's suggestions; any other length is typed. */
	private static readonly estimates = [15, 30, 60, 120, 180, 240, ...[1, 2, 3, 7].map(days => TimeSpan.fromDays(days).minutes)]

	@query('mitra-time-zone-picker') private readonly zonePicker?: TimeZonePicker
	@query('.end-date') private readonly endDateInput?: DateField
	@query('.start-date') private readonly startDateInput?: DateField
	@query('.due-date') private readonly dueDateInput?: DateField
	@query('.estimate-length') private readonly estimateInput?: DurationField

	private get foreignZone(): string | undefined {
		const zone = this.entry.timeZone
		return zone && zone !== FLOATING_TIME_ZONE && zone !== systemZoneId() ? zone : undefined
	}

	private get zoneReadonly(): boolean {
		return !this.editable || (!!this.foreignZone && !this.showEventZone)
	}

	private get zoneLabel(): string {
		if (this.entry.timeZone === FLOATING_TIME_ZONE) {
			return t('Wall clock (no time zone)')
		}
		const shown = this.foreignZone && this.showEventZone ? this.foreignZone : systemZoneId()
		return `${zoneNamePart(shown, 'shortOffset')} ${zoneCity(shown)}`
	}

	private get zoneIsPrimary(): boolean {
		return this.entry.timeZone !== FLOATING_TIME_ZONE && !(this.foreignZone && this.showEventZone)
	}

	private get zoneTitle(): string {
		if (this.zoneReadonly && this.foreignZone && !this.showEventZone) {
			return t('Primary time zone. Switch to ${city} time to change the zone', { city: zoneCity(this.foreignZone) })
		}
		const zone = this.entry.timeZone ?? undefined
		return !zone ? t('Time zone')
			: zone === FLOATING_TIME_ZONE ? t('Wall clock (no time zone)')
				: `${zoneCity(zone)}, ${longZoneName(zone)} (${zoneNamePart(zone, 'longOffset')})`
	}

	private get lensTitle(): string {
		const city = this.foreignZone ? zoneCity(this.foreignZone) : ''
		return this.showEventZone
			? t('Showing ${city} time. Switch to the primary time zone', { city })
			: t('Showing the primary time zone. Switch to ${city} time', { city })
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
		this.endDateInput?.showPicker()
	}

	private readonly addDate = async () => {
		this.dateShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		this.startDateInput?.showPicker()
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
		return this.editable && this.entry.unschedulable
	}

	private get editable() {
		return getCapabilities(this.entry.sourceId).editEntries
	}

	private get capabilities() {
		return getCapabilities(this.entry.sourceId)
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

						> :is(mitra-date-field, mitra-time-field, mitra-duration-field, mitra-select) { flex: 1; min-width: 0; }

						> mitra-icon {
							flex-shrink: 0;
							color: var(--color-text-muted);

							&[icon="arrow-right"]:dir(rtl) {
								scale: -1 1;
							}
						}
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
						color: var(--color-text-muted);

						&[data-localized] { color: var(--color-accent); }
					}
				}

				.add-end {
					cursor: pointer;
				}

				.clear {
					flex-shrink: 0;
					align-self: center;
					color: var(--color-text-muted);
					opacity: 0;
					transition: opacity 0.15s ease;
					margin-inline-end: calc(-1 * var(--mitra-glyph-inset));
				}

				:is(.dates, .times) > .field:hover > .clear,
				:is(.dates, .times) > .field:focus-within > .clear,
				.clear:focus-within {
					opacity: 1;
				}

				@media (pointer: coarse) {
					.clear {
						opacity: 1;
					}
				}
			}
		`
	}

	protected override get template() {
		if (!this.entry) {
			return html.nothing
		}
		const dated = !!this.entry.start || !!this.entry.due
		return html`
			${this.entry.start ? this.scheduleTemplate : this.unscheduledTemplate}
			${this.dueTemplate}
			${this.entry.allDay || !dated || !this.capabilities.timeZone ? html.nothing : this.zoneTemplate}
			${!dated || !this.capabilities.recurrence ? html.nothing : html`
				<div class="row field">
					<mitra-icon icon="repeat"></mitra-icon>
					<mitra-repeat-field .entry=${this.entry} @change=${() => this.commit()}></mitra-repeat-field>
				</div>
			`}
		`
	}

	private get switchTemplate() {
		return html`
			<mitra-switch class="switch" label=${t('Include time')} title=${this.entry.allDay ? t('Include time') : t('Switch to all-day')}
				?checked=${live(!this.entry.allDay)} @change=${this.toggleAllDay}
				?hidden=${!this.editable || !this.capabilities.allDay || this.entry.type.isAvailability}
			></mitra-switch>
		`
	}

	/** A task with no start: the start's placeholder, and its estimate where the end goes once it has one. */
	private get unscheduledTemplate() {
		const estimates = this.entry.type.isTask && this.capabilities.estimate
		return html`
			<div class="row">
				<mitra-icon icon="calendar-plus"></mitra-icon>
				<div class="dates">
					${!this.editable ? html`
						<span class="allday-label">${t('No date')}</span>
					` : this.dateShown ? html`
						<div class="field">
							<mitra-date-field class="start-date" label=${t('Start date')} .value=${''} @change=${this.handleStartDateChange}></mitra-date-field>
						</div>
					` : html`
						<button class="field add-end" @click=${this.addDate}>
							<span class="placeholder">${t('Start date')}</span>
						</button>
					`}
					${!estimates ? html.nothing : this.entry.estimate !== null || this.estimateShown ? html`
						<span class="estimate field">
							<mitra-icon icon="hourglass"></mitra-icon>
							<mitra-duration-field class="estimate-length" label=${t('Estimate')} ?readonly=${!this.editable}
								.presets=${EntryDetailsWhen.estimates} .value=${this.entry.estimate ?? undefined} @change=${this.handleEstimateChange}
							></mitra-duration-field>
						</span>
					` : html`
						<button class="estimate field add-end" @click=${this.addEstimate}>
							<mitra-icon icon="hourglass"></mitra-icon>
							<span class="placeholder">${t('Estimate')}</span>
						</button>
					`}
				</div>
			</div>
			${!this.entry.due ? html.nothing : html`
				<div class="row">
					${this.switchTemplate}
					<div class="times">
						<span class="allday-label">${this.entry.allDay ? t('All day') : t('Include time')}</span>
					</div>
				</div>
			`}
		`
	}

	private get scheduleTemplate() {
		const start = this.entry.start!
		return html`
			<div class="row">
				<mitra-icon icon=${this.entry.allDay ? 'calendar-days' : 'clock'}></mitra-icon>
				<div class="dates">
					<div class="field">
						<mitra-date-field class="start-date" label=${t('Start date')} ?readonly=${!this.editable} .value=${this.dateValue(start)} @change=${this.handleStartDateChange}></mitra-date-field>
						${!this.clearable ? html.nothing : html`
							<mitra-icon-button size="small" class="clear" icon="x" label=${t('Remove the date')} title=${t('Remove the date. The task moves to Unscheduled')} @click=${this.clearDate}></mitra-icon-button>
						`}
					</div>
					${!this.displayMultiDay && !this.endDateShown ? (!this.editable ? html.nothing : html`
						<button class="field add-end" @click=${this.addEndDate}>
							<span class="placeholder">${t('End date')}</span>
						</button>
					`) : html`
						<div class="field">
							<mitra-icon icon="arrow-right"></mitra-icon>
							<mitra-date-field class="end-date" label=${t('End date')} ?readonly=${!this.editable} .value=${this.dateValue(this.entry.inclusiveEnd)} @change=${this.handleEndDateChange}></mitra-date-field>
							${!this.editable ? html.nothing : html`
								<mitra-icon-button size="small" class="clear" icon="x" label=${t('Remove the end date')} @click=${this.clearEndDate}></mitra-icon-button>
							`}
						</div>
					`}
				</div>
			</div>
			<div class="row">
				${this.switchTemplate}
				<div class="times">
					${this.entry.allDay ? html`
						<span class="allday-label">${t('All day')}</span>
					` : html`
						<mitra-time-field class="field" label=${t('Start time')} ?readonly=${!this.editable} .value=${this.timeValue(start)} @change=${this.handleStartTimeChange}></mitra-time-field>
						${this.entry.point ? (!this.editable ? html.nothing : html`
							<button class="field add-end" @click=${this.addEndTime}>
								<span class="placeholder">${t('End time')}</span>
							</button>
						`) : html`
							<div class="field">
								<mitra-time-field label=${t('End time')} ?readonly=${!this.editable} .value=${this.timeValue(this.entry.effectiveEnd)} @change=${this.handleEndTimeChange}></mitra-time-field>
								${!this.editable || !this.entry.type.isTask || this.entry.partOfSeries ? html.nothing : html`
									<mitra-icon-button size="small" class="clear" icon="x" label=${t('Remove the end time')} @click=${this.clearEndTime}></mitra-icon-button>
								`}
							</div>
						`}
					`}
				</div>
			</div>
		`
	}

	/** A task's deadline: its own row, kept apart from when the task is planned. */
	private get dueTemplate() {
		return (!this.entry.type.isTask || !this.capabilities.due || (!this.entry.due && !this.editable)) ? html.nothing : html`
			<div class="row">
				<mitra-icon icon="flag"></mitra-icon>
				<div class="dates">
					${!this.entry.due && !this.dueShown ? html`
						<button class="field add-end" @click=${this.addDue}>
							<span class="placeholder">${t('Due date')}</span>
						</button>
					` : html`
						<div class="field">
							<mitra-date-field class="due-date" label=${t('Due date')} ?readonly=${!this.editable} .value=${this.entry.due ? this.dateValue(this.entry.due) : ''} @change=${this.handleDueDateChange}></mitra-date-field>
							${!this.entry.due || !this.editable || this.entry.partOfSeries ? html.nothing : html`
								<mitra-icon-button size="small" class="clear" icon="x" label=${t('Remove the due date')} @click=${this.clearDue}></mitra-icon-button>
							`}
						</div>
					`}
					${!this.entry.due || this.entry.allDay ? html.nothing : html`
						<mitra-time-field class="field" label=${t('Due time')} ?readonly=${!this.editable} .value=${this.timeValue(this.entry.due)} @change=${this.handleDueTimeChange}></mitra-time-field>
					`}
				</div>
			</div>
		`
	}

	private get zoneTemplate() {
		return html`
			<div class="row field">
				<mitra-icon icon="globe"></mitra-icon>
				<div class="zone">
					<button class="zone-label" ?disabled=${this.zoneReadonly}
						?data-placeholder=${this.zoneIsPrimary}
						title=${this.zoneTitle} aria-label=${this.zoneTitle}
						@click=${(e: Event) => this.zonePicker?.toggle(e.currentTarget as HTMLElement)}
					>
						<span class="text">${this.zoneLabel}</span>
						<mitra-icon class="chevron" icon="chevron-down"></mitra-icon>
					</button>
					${!this.foreignZone ? html.nothing : html`
						<mitra-icon-button size="small" class="lens" ?data-localized=${!this.showEventZone}
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
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-when': EntryDetailsWhen
	}
}
