import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Temporal } from 'temporal-polyfill'
import { FLOATING_TIME_ZONE, type Entry } from '../Entry.js'
import { type TimeZonePicker, longZoneName, systemZoneId, zoneCity, zoneNamePart } from '../../time/client/TimeZonePicker.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { controlHeight } from '../../../design/controlHeight.css.js'

/**
 * The date / time / all-day editor for an entry, split out of the (long) entry-details popover. It
 * subgrids the popover's column grid, and each of its lines is a `.field` row (see field.css.ts) whose
 * leading glyph/switch lines up with the other rows'. Each input is wired straight to an `Entry` span
 * method — editing the start moves, the end resizes — then it fires `change` for the host to persist.
 * The native fields read as plain text; the picker glyph is hidden and surfaced on click.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.endDateShown = false; this.dateShown = false; this.showEventZone = false }
	}) entry!: Entry

	override role = 'listitem'

	/** Fired after a span edit mutates the entry in place; the host persists and refreshes. */
	@event() readonly change!: EventDispatcher

	// Subscribe to the store so a re-render fires when the entry mutates in place — notably a source
	// migration, which changes `entry.sourceId` (and thus the provider's capabilities) on the SAME
	// instance, so the incoming `@property` reference is unchanged and lit wouldn't otherwise re-render.
	// That's what keeps the repeat field correctly shown/hidden after the entry moves to another source.
	readonly store = new EntryStore(this)

	// Reveals the end-date field for a single-day entry without changing its dates (see addEndDate); reset
	// when a different entry is shown so it reflects that entry, not the previous one.
	@state() private endDateShown = false

	// The same, one step earlier: an EMPTY date field for an entry with no date, where picking one is
	// what schedules it (see addDate).
	@state() private dateShown = false

	// The display LENS for a foreign-zone entry (see `zone`): false shows/edits the times in the viewer's
	// own zone (so the editor agrees with the grid — the default), true in the entry's authoring zone.
	// Reset per entry so a freshly opened one always starts local.
	@state() private showEventZone = false

	protected override createRenderRoot() { return this }

	// Native inputs carry plain strings, read and applied as the WALL CLOCK in the entry's own zone
	// (see `zone`): a 14:00-Tehran entry reads "14:00" here whatever zone the browser is in, and typing
	// "15:00" means 15:00 *Tehran* — the same reading `Entry.setTimeZone` keeps. Instants are converted
	// through Temporal both ways, so start/end stay the absolute epochs the rest of the app expects.

	/** The zone the fields read/write in. All-day spans are floating days stored at the browser's
	 * midnights, so they always read locally; a FLOATING entry's wall clock is encoded as-if-UTC (see
	 * Entry.timeZone), so UTC reads it back. A foreign-zone entry reads in the VIEWER's own zone by
	 * default — so the editor agrees with the grid — and flips to the authoring zone with the lens. */
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

	// The field looks like plain text (the native glyph is hidden), so a click surfaces the picker; typing
	// still works for keyboard users.
	private readonly openPicker = (e: Event) => {
		// `showPicker()` throws on a readonly input.
		if (!this.editable) {
			return
		}
		try {
			(e.currentTarget as HTMLInputElement).showPicker()
		} catch {
			// showPicker is unsupported or blocked here — typing the value still works.
		}
	}

	/** Re-render with the mutated span and let the host persist. */
	private commit() {
		this.requestUpdate()
		this.change.dispatch()
	}

	// Editing the start moves the entry (Entry.moveStart); editing the end resizes (Entry.setEnd). All the
	// move/resize/all-day rules live on the model.
	private readonly handleStartDateChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value) return
		if (!this.entry.start) {
			// Picking a date SCHEDULES the entry rather than moving a span that isn't there. All-day,
			// because a date is all the user said — the switch on the next line adds a time.
			this.entry.scheduleAt(new DateTime(`${value}T00:00:00`), true)
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
		this.entry.setAllDay(!this.entry.allDay)
		this.commit()
	}

	// --- The entry's time zone ------------------------------------------------------------------------
	// The zone the times are authored in (see Entry.timeZone). Picking one keeps the WALL CLOCK and
	// moves the instants (Entry.setTimeZone) — the "show this instant elsewhere" reading lives in the
	// time axis' zone columns, not here.

	@query('mitra-time-zone-picker') private readonly zonePicker?: TimeZonePicker
	@query('.end-date') private readonly endDateInput?: HTMLInputElement
	@query('.start-date') private readonly startDateInput?: HTMLInputElement

	/** The entry was authored in another (real) zone than the browser's — the chip expands then.
	 * FLOATING is deliberately not "foreign": it's no zone at all (and no IANA id to label the chip
	 * with); until floating gets its own UI, the chip stays neutral and the tooltip says what it is. */
	private get foreignZone(): string | undefined {
		const zone = this.entry.timeZone
		return zone && zone !== FLOATING_TIME_ZONE && zone !== systemZoneId() ? zone : undefined
	}

	/** In the localized (your-time) lens of a foreign entry the zone can't be changed here — the times
	 * are shown in YOUR zone, not the entry's, so re-picking would be ambiguous. The select goes
	 * read-only until the user switches back to the entry's own zone (where an edit is unambiguous). */
	private get zoneReadonly(): boolean {
		return !this.editable || (!!this.foreignZone && !this.showEventZone)
	}

	/** The zone row's label — reflects the zone the times are CURRENTLY shown in (the lens): the entry's
	 * authoring zone in its own-zone view, the viewer's own (primary) zone in the localized view, and a
	 * plain tag for a floating entry. Clicking it opens the picker (unless read-only, see zoneReadonly). */
	private get zoneLabel(): string {
		if (this.entry.timeZone === FLOATING_TIME_ZONE) {
			return t('Wall clock — no time zone')
		}
		const shown = this.foreignZone && this.showEventZone ? this.foreignZone : systemZoneId()
		return `${zoneNamePart(shown, 'shortOffset')} ${zoneCity(shown)}`
	}

	/** Whether the label is showing nothing more than the viewer's OWN primary zone — a default rather
	 * than a choice, so it reads placeholder-like (see field.css.ts). True when the entry names no zone,
	 * when it names one that IS the viewer's (picking "Berlin" in Berlin changes nothing you can see),
	 * and in the localized lens of a foreign entry, where the times are shown in your zone anyway. A
	 * FLOATING entry is excluded: "no time zone" is a deliberate authoring decision, not a default. */
	private get zoneIsPrimary(): boolean {
		return this.entry.timeZone !== FLOATING_TIME_ZONE && !(this.foreignZone && this.showEventZone)
	}

	/** The shown zone's full name — or, when the LENS is what withholds the picker, why it can't be changed
	 * here. A wholly read-only entry says nothing extra: the zone is no special case there. */
	private get zoneTitle(): string {
		if (this.zoneReadonly && this.foreignZone && !this.showEventZone) {
			return t('Primary time zone — switch to ${city} time to change the zone', { city: zoneCity(this.foreignZone) })
		}
		const zone = this.entry.timeZone ?? undefined
		return !zone ? t('Time zone')
			: zone === FLOATING_TIME_ZONE ? t('Wall clock — no time zone')
				: `${zoneCity(zone)} — ${longZoneName(zone)} (${zoneNamePart(zone, 'longOffset')})`
	}

	/** The lens toggle's tooltip: switching flips the date/time rows to the other zone. */
	private get lensTitle(): string {
		const city = this.foreignZone ? zoneCity(this.foreignZone) : ''
		return this.showEventZone
			? t('Showing ${city} time — switch to the primary time zone', { city })
			: t('Showing the primary time zone — switch to ${city} time', { city })
	}

	// Flip the display lens between the viewer's own zone and the entry's authoring zone. A pure view
	// concern — nothing is persisted; the times' underlying instants don't move.
	private readonly toggleLens = () => {
		this.showEventZone = !this.showEventZone
	}

	private readonly handleZonePick = (e: CustomEvent<string>) => {
		this.entry.setTimeZone(e.detail)
		// Just picked a foreign zone → the user is authoring in it, so show the times in it; picking the
		// browser's own zone (a reset) leaves nothing foreign to toggle.
		this.showEventZone = e.detail !== systemZoneId()
		this.commit()
	}

	/** Whether the span crosses a day boundary AS DISPLAYED — computed in the current lens zone, not on
	 * the stored instants. A 23:30→00:30 entry spans midnight in Tehran (two dates shown) but not in
	 * Berlin (one date, the "+ end date" affordance), so toggling the lens flips the date row's shape. */
	private get displayMultiDay(): boolean {
		if (this.entry.allDay || !this.entry.start || !this.entry.end) {
			return this.entry.multiDay
		}
		return this.dateValue(this.entry.start) !== this.dateValue(this.entry.inclusiveEnd)
	}

	// Reveal the end-date field — it starts equal to the start (no surprise jump) and the user picks the
	// real end. Picking a later day makes it multi-day; the field stays shown.
	private readonly addEndDate = async () => {
		this.endDateShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		try {
			this.endDateInput?.showPicker()
		} catch {
			// Couldn't auto-open (no transient activation / unsupported) — the revealed field still works.
		}
	}

	/** `addEndDate`'s shape one step earlier — and the only way to schedule a task on a phone, where
	 * the sidebar holding it covers the calendar and there is nothing to drag onto. */
	private readonly addDate = async () => {
		this.dateShown = true
		await this.updateComplete
		await new Promise(resolve => setTimeout(resolve, 100))
		try {
			this.startDateInput?.showPicker()
		} catch {
			// Couldn't auto-open — the revealed field still accepts a typed date.
		}
	}

	/** The editor's twin of dropping the entry on the unscheduled section. */
	private readonly clearDate = () => {
		this.entry.unschedule()
		this.dateShown = false
		this.commit()
	}

	/** The entry ends on the day it starts. A timed span keeps its end's CLOCK time and moves only the
	 * date, so collapsing a two-day 14:00→16:00 leaves 14:00→16:00 rather than a snap-minute stub. */
	private readonly clearEndDate = () => {
		this.entry.setEnd(this.entry.allDay ? this.entry.start! : this.withDate(this.dateValue(this.entry.start!), this.entry.effectiveEnd))
		this.endDateShown = false
		this.commit()
	}

	/** Only a task has an undated form, and a series occurrence is identified by its date. */
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
				grid-template-columns: subgrid; /* the popover's two columns: leading glyph | content */
				grid-column: 1 / -1;
				row-gap: 0.125rem;

				/* A line spanning the popover's two columns. A line holding ONE control is itself the
				   field (glyph inside, bleeding like the host's field rows — see EventDetails); the date
				   and time lines hold TWO, so there the glyph/switch stays outside in the gutter and each
				   input is its own field (see .dates/.times below). */
				> .row {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					/* A line stands the shared control height even when it holds no control at all: with the
					switch flipped to all-day the times line is one bare label, and without this it
					collapsed to that label's line box — half the height of every row around it. */
					${controlHeight};
					min-height: var(--control-height);

					&.field { margin-inline: -0.5rem; }
					&:not(.field) { align-items: center; }

					> mitra-icon { grid-column: 1; font-size: 0.87rem; color: var(--color-text-muted); flex-shrink: 0; }
					> .switch { grid-column: 1; align-self: center; }

					/* Hovered, or active for any reason — including its own picker being open, which the
					   shared .field:has(:popover-open) rule already covers now that the picker lives
					   inside the row. */
					&:is(:hover, :focus-within, :has(:popover-open)) .chevron {
						opacity: 1;
					}
				}

				/* A start and an end, side by side in the content column — the SAME two tracks on both
				   lines, so the dates and the times align with each other. Each is its own field: they
				   are two inputs, and one box around the pair would claim otherwise. The end field wears
				   the arrow (or, while there is no end date, the plus) as its leading glyph, exactly the
				   way every other field wears one. */
				.dates, .times {
					grid-column: 2;
					display: grid;
					grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
					column-gap: 0.25rem;

					> .field {
						/* Tighter than a full-row field's, so the pair's borders stay clear of the gutter glyph
						   while the start value still sits exactly on the popover's content line. Declared on
						   the fields THEMSELVES: .field sets its own default, which would out-cascade a value
						   inherited from this container. */
						--field-padding-inline: 0.25rem;

						/* Net-zero against the padding above (start), and the same trailing bleed every
						   other field has (end) — so the pair spans exactly the row the others do. */
						&:first-child { margin-inline-start: calc(-1 * var(--field-padding-inline)); }
						&:last-child { margin-inline-end: -0.5rem; }

						display: flex;
						align-items: center;
						gap: 0.5rem;

						> input { flex: 1; min-width: 0; }
					}
				}

				/* The dedicated time-zone line (its own row under the times, since flipping the display
				   zone can shift the DATE — an entry that crosses midnight in one zone but not another).
				   It holds the zone label (opens the picker) and, for a foreign-zone entry, the lens
				   toggle that flips the date/time rows between the viewer's zone and the entry's own. */
				.zone {
					grid-column: 2;
					display: flex;
					gap: 0.25rem;
					min-inline-size: 0;

					/* The zone reads like the popover's selects (Repeat / Source): plain text filling the
					   row, with a chevron (same size, muted fill, right-aligned) that surfaces — like a
					   select's picker icon — while the FIELD is hovered or active. */
					> .zone-label {
						all: unset;
						flex: 1 1 auto; /* fill the row like the Repeat select, so the whole width is the target */
						display: flex;
						align-items: center;
						min-inline-size: 0;
						cursor: pointer;

						> .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
						/* The select's ::picker-icon: 1.125rem, muted fill, pushed to the row's end. */
						> .chevron { margin-inline-start: auto; font-size: 1.125rem; color: color-mix(in srgb, var(--color-text) 60%, transparent); opacity: 0; transition: opacity 0.15s ease; }

						/* The localized (your-time) lens: the zone can't be changed here (see zoneReadonly).
						   Read as static muted text — no chevron, no pointer — so it's clearly not a
						   dropdown until the user switches back to the entry's own zone. */
						&:disabled {
							cursor: default;
							color: var(--color-text-muted);
							> .chevron { display: none; }
						}
					}

					/* The lens toggle — an icon-only button at the row's end. Its icon reflects the current
					   view: a HOUSE (accent-tinted) when the times read in your own/local zone, an EARTH
					   when they read in the entry's own (foreign) zone. */
					> .lens {
						flex-shrink: 0;
						align-self: center;
						font-size: 0.85rem;
						color: var(--color-text-muted);

						&[data-localized] { color: var(--color-accent); }
					}
				}

				/* This popover's instance of the zone picker wears the details popover's tinted glass and
				   opens beside it — the same strategy as the source/repeat pickers, so nested surfaces
				   read as one plane. It sits INSIDE its field row, which is what anchors it (see
				   field.css.ts) and what makes the row read as active while it's open. */
				mitra-time-zone-picker {
					background: var(--mitra-entry-surface);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
					margin: 0;
					margin-inline: 0.875rem;
				}

				/* The stand-in for an end date nobody has set: a field indistinguishable from its sibling,
				   but with a plus for a glyph and a placeholder for text — so an entry with one date reads
				   as a start plus an empty end, not as a single mystery input. It is a BUTTON, so it also
				   depends on button.css standing down inside a field; all:unset alone lost that fight. */
				.add-end {
					cursor: pointer;
				}

				/* One rule read twice — "clear this field" — where the start's clears everything downstream,
				   because an end without a start is not a thing. Revealed on the row like the zone
				   chevron: a field you are not touching shouldn't wear a delete button. */
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

				/* A finger cannot hover, so there is nothing to reveal it with. */
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
			// The end, the all-day switch, the zone and the repeat rule are all statements ABOUT a date,
			// so an undated entry gets the way in and nothing more — through the same placeholder button
			// the missing end date uses, so the two absences read alike.
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
				${/* A provider that stores durations rather than days (a Tempo worklog) cannot mean "all day",
				     so the switch goes rather than offering a state the save would have to refuse. */''}
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
						<!-- Showing just the viewer's own zone is a default, not a choice — placeholder-like,
							like an unset Repeat (see zoneIsPrimary). -->
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
					<!-- Inside the row, not beside it: the field is what anchors it (field.css.ts), and the
						containment makes the row read as active while the picker is open. -->
					<!-- The picker opens ticked on the zone actually in force, which for an entry that names
						none is the viewer's own — the same zone the label shows. Leaving it unselected made
						the list open with nothing marked while the row read "GMT+2 Berlin". -->
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
