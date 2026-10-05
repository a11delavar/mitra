import { Component, component, html, css, property, state, event, query, ifDefined } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { FLOATING_TIME_ZONE, type Entry } from '../Entry.js'
import { type TimeZonePicker, longZoneName, systemZoneId, zoneCity, zoneNamePart } from '../../time/client/TimeZonePicker.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { DefaultDurationSetting } from './DefaultDurationSetting.js'
import { controlHeight } from '../../../design/controlHeight.css.js'
import { type DateField } from '../../../design/DateField.js'
import { type DurationField } from '../../../design/DurationField.js'

/** A moment's row: what it shows and edits, and what removes it. */
type Moment = {
	readonly kind: 'start' | 'end' | 'due'
	readonly icon: string
	readonly label: string
	readonly value?: DateTime
	/** Takes the moment picked, and whether the field held a time. */
	readonly handleChange: (value: DateTime, timed: boolean) => void
	readonly remove?: { readonly label: string, readonly title?: string, readonly handler: () => void }
	/** The time a day picked into the empty field takes. */
	readonly defaultTime?: string
	/** A moment whose day its date only repeats (an end's, the start's), which then recedes. */
	readonly impliedDate?: DateTime
}

/**
 * The entry's moments, one row each: its start, its end (a task's estimate while it has no start) and a task's due. Each
 * is one date field, with the time of day unless the entry is all-day, which every row's toggle switches for all of them.
 * Then the time zone and the repeat rule.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.startShown = false; this.endShown = false; this.dueShown = false; this.estimateShown = false; this.showEventZone = false }
	}) entry!: Entry

	override role = 'listitem'

	@event() readonly change!: EventDispatcher
	/** Asks the page to bring an entry whose dates changed into view: on the calendar, or in the planning list without a start. */
	@event({ bubbles: true, composed: true }) readonly reveal!: EventDispatcher<Entry>

	readonly store = new EntryStore(this)

	@state() private startShown = false
	@state() private endShown = false
	@state() private dueShown = false
	@state() private estimateShown = false
	@state() private showEventZone = false

	protected override createRenderRoot() { return this }

	/** Zone used for display and editing in the date fields. */
	private get zone(): string {
		return this.entry.allDay ? systemZoneId()
			: this.entry.timeZone === FLOATING_TIME_ZONE ? 'UTC'
				: this.foreignZone && !this.showEventZone ? systemZoneId()
					: this.entry.timeZone ?? systemZoneId()
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

	/** Shows the field a placeholder stood for and opens its picker, once the press on the placeholder is over. */
	private async openField(show: () => void, field: () => DateField | undefined) {
		show()
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		field()?.showPicker()
	}

	private readonly handleStartChange = (value: DateTime, timed: boolean) => {
		if (this.entry.start) {
			this.entry.moveStart(value)
		} else if (timed) {
			this.entry.scheduleAt(value, false, DefaultDurationSetting.current)
		} else {
			// An estimate shorter than a day asks for hours, so the task gets a time; anything else takes the whole day.
			const hours = !!this.entry.estimate && TimeSpan.fromMinutes(this.entry.estimate).days < 1
			this.entry.scheduleAt(hours ? value.with({ hour: 9 }) : value, !hours, DefaultDurationSetting.current)
		}
		this.commit()
	}

	private readonly handleEndChange = (value: DateTime) => {
		if (this.entry.start) {
			this.entry.setEnd(value)
			this.commit()
		}
	}

	private readonly handleDueChange = (value: DateTime) => {
		const { entry } = this
		// A first due on an unscheduled task is a day; nothing else depends on the entry's precision yet.
		if (!entry.start && !entry.due) {
			entry.allDay = true
		}
		entry.due = value
		this.commit()
	}

	private readonly toggleAllDay = () => {
		this.entry.setAllDay(!this.entry.allDay, DefaultDurationSetting.current)
		this.commit()
	}

	private readonly addStart = () => this.openField(() => this.startShown = true, () => this.startField)

	private readonly removeStart = () => {
		this.entry.unschedule()
		this.startShown = false
		this.commit()
	}

	/** A moment gains an end: a timed one the default duration, an all-day one the day picked. */
	private readonly addEnd = async () => {
		if (this.entry.allDay) {
			await this.openField(() => this.endShown = true, () => this.endField)
		} else {
			this.entry.setEnd(this.entry.start!.add({ minutes: DefaultDurationSetting.current }))
			this.commit()
		}
	}

	private readonly removeEnd = () => {
		this.entry.end = undefined
		this.endShown = false
		this.commit()
	}

	private readonly addDue = () => this.openField(() => this.dueShown = true, () => this.dueField)

	private readonly removeDue = () => {
		this.entry.due = undefined
		this.dueShown = false
		this.commit()
	}

	private readonly addEstimate = async () => {
		this.estimateShown = true
		await this.updateComplete
		this.estimateField?.focus()
		this.estimateField?.showPicker()
	}

	private readonly handleEstimateChange = (e: CustomEvent<number | undefined>) => {
		this.entry.estimate = e.detail ?? null
		this.estimateShown = false
		this.commit()
	}

	/** The estimate's suggestions; any other length is typed. */
	private static readonly estimates = [15, 30, 60, 120, 180, 240, ...[1, 2, 3, 7].map(days => TimeSpan.fromDays(days).minutes)]

	@query('mitra-time-zone-picker') private readonly zonePicker?: TimeZonePicker
	@query('.start > :is(mitra-date-field, mitra-date-time-field)') private readonly startField?: DateField
	@query('.end > :is(mitra-date-field, mitra-date-time-field)') private readonly endField?: DateField
	@query('.due > :is(mitra-date-field, mitra-date-time-field)') private readonly dueField?: DateField
	@query('.estimate > mitra-duration-field') private readonly estimateField?: DurationField

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
					margin-inline: -0.5rem;

					> mitra-icon {
						grid-column: 1;
						font-size: 0.87rem;
						color: var(--color-text-muted);
						flex-shrink: 0;

						&[icon^=clock-arrow]:dir(rtl) {
							scale: -1 1;
						}
					}

					> :is(mitra-date-field, mitra-date-time-field, mitra-duration-field, button, .placeholder, .zone) {
						grid-column: 2;
						min-inline-size: 0;
					}

					/* Its box's border and its first segment's padding stand outside the column, so that its digits start where
					   the other rows' words do. */
					> :is(mitra-date-field, mitra-date-time-field, mitra-duration-field) {
						margin-inline-start: -2px;
					}

					> button {
						all: unset;
						cursor: pointer;
					}

					> :is(button, .placeholder) {
						display: flex;
						align-items: center;
					}

					> :is(mitra-date-field, mitra-date-time-field) > mitra-icon-button {
						color: var(--color-text-muted);

						/* A row's last action lands its glyph as far from the row's end as the row's icon sits from its start, out
						   past the field box's border too. */
						&:last-child {
							margin-inline-end: calc(-1 * var(--mitra-glyph-inset) - 1px);
						}
					}

					/* A row's actions show while it is in use. All day most of all: the lane an entry is created in has already
					   decided between days and times. */
					:is(.remove, .precision) {
						opacity: 0;
						visibility: hidden;
						transition: opacity 0.15s ease, visibility 0.15s;
					}

					&:is(:hover, :focus-within) :is(.remove, .precision) {
						opacity: 1;
						visibility: visible;
					}

					@media (pointer: coarse) {
						.remove {
							opacity: 1;
							visibility: visible;
						}
					}

					&:is(:hover, :focus-within, :has(:popover-open)) .chevron {
						opacity: 1;
					}
				}

				.zone {
					display: flex;
					gap: 0.25rem;

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
						/* Its glyph lines up with the clocks of the rows above. */
						margin-inline-end: calc(-1 * var(--mitra-glyph-inset));

						&[data-localized] { color: var(--color-accent); }
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
			${this.startTemplate}
			${this.entry.start ? this.endTemplate : this.estimateTemplate}
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

	/** All day, pressed while it is: it takes every moment of the entry between days and times at once. */
	private get allDayTemplate() {
		return !this.editable || !this.capabilities.allDay || this.entry.type.isAvailability ? html.nothing : html`
			<mitra-icon-button size="small" class="precision" icon="clock-fading" label=${t('All day')}
				?pressed=${this.entry.allDay} @click=${this.toggleAllDay}
			></mitra-icon-button>
		`
	}

	/**
	 * A moment's row: its field, with what removes it and the all-day toggle. The field holds a date and a time unless the entry
	 * is all-day; empty, it does once the entry has any date to take the precision from, and a day picked into it takes
	 * `defaultTime`.
	 */
	private momentTemplate({ kind, icon, label, value, handleChange, remove, defaultTime, impliedDate }: Moment) {
		const actions = html`
			${!remove || !this.editable ? html.nothing : html`
				<mitra-icon-button size="small" class="remove" icon="x" label=${remove.label} title=${remove.title ?? remove.label} @click=${remove.handler}></mitra-icon-button>
			`}
			${!value ? html.nothing : this.allDayTemplate}
		`
		const timed = !this.entry.allDay && !!(value ?? this.entry.start ?? this.entry.due)
		const change = (e: CustomEvent<DateTime | undefined>) => e.detail && handleChange(e.detail, timed)
		return html`
			<div class="${kind} row field">
				<mitra-icon icon=${icon}></mitra-icon>
				${timed ? html`
					<mitra-date-time-field label=${label} timeZone=${this.zone} defaultTime=${ifDefined(defaultTime)} .impliedDate=${impliedDate} ?readonly=${!this.editable} .value=${value} @change=${change}>${actions}</mitra-date-time-field>
				` : html`
					<mitra-date-field label=${label} timeZone=${this.zone} .impliedDate=${impliedDate} ?readonly=${!this.editable} .value=${value} @change=${change}>${actions}</mitra-date-field>
				`}
			</div>
		`
	}

	/** A field not given yet: its name, which shows the field. */
	private placeholderTemplate(kind: 'start' | 'end' | 'due' | 'estimate', icon: string, label: string, handler: () => void) {
		return html`
			<div class="${kind} row field">
				<mitra-icon icon=${icon}></mitra-icon>
				<button @click=${handler}><span class="placeholder">${label}</span></button>
			</div>
		`
	}

	private get startTemplate() {
		const { start } = this.entry
		return start || this.startShown
			? this.momentTemplate({
				kind: 'start', icon: 'clock-arrow-right', label: t('Start date'), value: start, handleChange: this.handleStartChange, defaultTime: '09:00',
				remove: !start || !this.entry.unschedulable ? undefined : { label: t('Remove the date'), title: t('Remove the date. The task moves to Unscheduled'), handler: this.removeStart },
			})
			: this.editable ? this.placeholderTemplate('start', 'clock-arrow-right', t('Start date'), this.addStart)
				: html`
					<div class="start row field">
						<mitra-icon icon="clock-arrow-right"></mitra-icon>
						<span class="placeholder">${t('No date')}</span>
					</div>
				`
	}

	/** The end, which a task may go without: then it is a moment, and its row only offers one. */
	private get endTemplate() {
		const { entry } = this
		const end = entry.point ? undefined : entry.allDay ? entry.inclusiveEnd : entry.effectiveEnd
		return end || this.endShown
			? this.momentTemplate({
				kind: 'end', icon: 'clock-arrow-left', label: t('End date'), value: end, handleChange: this.handleEndChange,
				impliedDate: entry.start,
				remove: !end || !entry.type.isTask || entry.partOfSeries ? undefined : { label: t('Remove the end date'), handler: this.removeEnd },
			})
			: !this.editable ? html.nothing
				: this.placeholderTemplate('end', 'clock-arrow-left', t('End date'), this.addEnd)
	}

	/** A task with no start: its estimate, where the end goes once it has one. */
	private get estimateTemplate() {
		if (!this.entry.type.isTask || !this.capabilities.estimate) {
			return html.nothing
		}
		return this.entry.estimate !== null || this.estimateShown ? html`
			<div class="estimate row field">
				<mitra-icon icon="hourglass"></mitra-icon>
				<mitra-duration-field label=${t('Estimate')} ?readonly=${!this.editable}
					.presets=${EntryDetailsWhen.estimates} .value=${this.entry.estimate ?? undefined} @change=${this.handleEstimateChange}
				></mitra-duration-field>
			</div>
		` : !this.editable ? html.nothing
			: this.placeholderTemplate('estimate', 'hourglass', t('Estimate'), this.addEstimate)
	}

	/** A task's deadline: its own row, kept apart from when the task is planned. */
	private get dueTemplate() {
		const { due } = this.entry
		if (!this.entry.type.isTask || !this.capabilities.due || (!due && !this.editable)) {
			return html.nothing
		}
		return due || this.dueShown
			? this.momentTemplate({
				kind: 'due', icon: 'flag', label: t('Due date'), value: due, handleChange: this.handleDueChange, defaultTime: '17:00',
				remove: !due || this.entry.partOfSeries ? undefined : { label: t('Remove the due date'), handler: this.removeDue },
			})
			: this.placeholderTemplate('due', 'flag', t('Due date'), this.addDue)
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
