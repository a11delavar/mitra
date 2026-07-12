import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Temporal } from 'temporal-polyfill'
import { FLOATING_TIME_ZONE, type Entry } from 'shared'
import { type TimeZonePicker, longZoneName, systemZoneId, zoneCity, zoneNamePart } from './components/TimeZonePicker.js'

/**
 * The date / time / all-day editor for an entry, split out of the (long) entry-details popover. It renders
 * one `<li>` that shares the popover's column grid (`display: contents` keeps it a grid item of the parent
 * `<ul>`, so its leading icon/switch line up with the other rows). Each input is wired straight to an
 * `Entry` span method — editing the start moves, the end resizes — then it fires `change` for the host to
 * persist. The native fields read as plain text; the picker glyph is hidden and surfaced on click.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	// Per-instance anchor token so two open editors' zone pickers never collide.
	private static count = 0
	private readonly anchor = `--when-zone-${EntryDetailsWhen.count++}`

	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.endDateShown = false; this.showEventZone = false }
	}) entry!: Entry

	override role = 'listitem'

	/** Fired after a span edit mutates the entry in place; the host persists and refreshes. */
	@event() readonly change!: EventDispatcher

	// Reveals the end-date field for a single-day entry without changing its dates (see addEndDate); reset
	// when a different entry is shown so it reflects that entry, not the previous one.
	@state() private endDateShown = false

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
		if (!value || !this.entry.start) return
		this.entry.moveStart(this.withDate(value, this.entry.start))
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

	private get zonePicker() { return this.querySelector<TimeZonePicker>('mitra-time-zone-picker') }

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
		return !!this.foreignZone && !this.showEventZone
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

	/** The label tooltip: the shown zone's full name — or, when read-only, why it can't be changed here. */
	private get zoneTitle(): string {
		if (this.zoneReadonly) {
			return t('Primary time zone — switch to ${city} time to change the zone', { city: zoneCity(this.foreignZone!) })
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
			this.querySelector<HTMLInputElement>('.end-date')?.showPicker()
		} catch {
			// Couldn't auto-open (no transient activation / unsupported) — the revealed field still works.
		}
	}

	static override get styles() {
		return css`
			mitra-entry-details-when {
				display: grid;
				grid-template-columns: subgrid; /* the popover's two columns: leading glyph | content */
				grid-column: 1 / -1;
				align-items: center;
				row-gap: 0.75rem;

				/* Leading column — one glyph per row (clock, duration, switch), auto-flowed so they line up with the popover's other row icons. */
				> mitra-icon { grid-column: 1; font-size: 0.87rem; color: var(--color-text-muted); flex-shrink: 0; }
				> .duration { grid-column: 1; font-size: 0.7rem; white-space: nowrap; color: var(--color-text-muted); }
				> .switch { grid-column: 1; }
				> .allday-label { grid-column: 2; color: var(--color-text-muted); }

				/* The dates and times rows are each the SAME 3-column grid inside the content column, so their start/→/end line up across the two rows — all within the component, not the popover grid. */
				.dates, .times {
					grid-column: 2;
					display: grid;
					grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
					align-items: center;
					column-gap: 0.5rem;
					height: 1.5rem;
				}

				/* The dedicated time-zone row (its own line under the times, since flipping the display
				   zone can shift the DATE — an entry that crosses midnight in one zone but not another).
				   It holds the zone label (opens the picker) and, for a foreign-zone entry, the lens
				   toggle that flips the date/time rows between the viewer's zone and the entry's own. */
				> .zone-row {
					grid-column: 2;
					display: flex;
					align-items: center;
					gap: 0.25rem;
					min-inline-size: 0;
					font-size: 0.75rem;

					/* The label is styled to MATCH the popover's subtle selects (Repeat / Source — see
					   select.css.ts) exactly, so the zone reads as one more select of the same family:
					   plain text at rest, filling the row, with a hover/focus background and a chevron
					   (same size, muted fill, right-aligned) that surfaces only on interaction. */
					> .zone-label {
						all: unset;
						flex: 1 1 auto; /* fill the row like the Repeat select, so the whole width is the target */
						display: flex;
						align-items: center;
						min-inline-size: 0;
						margin: -2px -4px;
						padding: 2px 4px;
						border-radius: var(--border-radius);
						color: var(--color-text);
						cursor: pointer;

						> .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
						/* The select's ::picker-icon: 1.125rem, muted fill, pushed to the row's end. */
						> .chevron { margin-inline-start: auto; font-size: 1.125rem; color: color-mix(in srgb, var(--color-text) 60%, transparent); opacity: 0; transition: opacity 0.15s ease; }

						&:is(:hover, :focus-visible) {
							background: color-mix(in srgb, var(--color-text) 6%, transparent);
							outline: none;
							> .chevron { opacity: 1; }
						}

						/* The localized (your-time) lens: the zone can't be changed here (see zoneReadonly).
						   Read as static muted text — no chevron, no hover, no pointer — so it's clearly not
						   a dropdown until the user switches back to the entry's own zone. */
						&:disabled {
							cursor: default;
							color: var(--color-text-muted);
							> .chevron { display: none; }
							&:is(:hover, :focus-visible) { background: transparent; }
						}
					}

					/* The lens toggle — an icon-only button at the row's end. Its icon reflects the current
					   view: a HOUSE (accent-tinted) when the times read in your own/local zone, an EARTH
					   when they read in the entry's own (foreign) zone. */
					> .lens {
						flex-shrink: 0;
						font-size: 0.85rem;
						color: var(--color-text-muted);

						&[data-localized] { color: var(--color-accent); }
					}
				}

				/* This popover's instance of the zone picker wears the details popover's tinted glass and
				   opens beside it — the same strategy as the source/repeat pickers, so nested surfaces
				   read as one plane. */
				> mitra-time-zone-picker {
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
					margin: 0;
					margin-inline: 0.875rem;
				}

				.arrow { color: var(--color-text-muted); justify-self: center; }

				.add-end {
					all: unset;
					grid-column: 2 / -1;
					color: var(--color-text-muted);
					cursor: pointer;
					padding: 0.125rem 0.25rem;
					border-radius: var(--border-radius);

					&:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); color: var(--color-text); }
				}

				input::-webkit-calendar-picker-indicator {
					display: none;
				}

			}
		`
	}

	protected override get template() {
		if (!this.entry?.start) {
			return html.nothing
		}
		return html`
			<mitra-icon icon=${this.entry.allDay ? 'calendar-days' : 'clock'}></mitra-icon>
			<div class="dates">
				<input type="date" class="subtle" aria-label=${t('Start date')} .value=${this.dateValue(this.entry.start)} @click=${this.openPicker} @change=${this.handleStartDateChange}>
				${!this.displayMultiDay && !this.endDateShown ? html`
					<button class="add-end" @click=${this.addEndDate}>${t('+ end date')}</button>
				` : html`
					<span class="arrow">→</span>
					<input type="date" class="subtle end-date" aria-label=${t('End date')} .value=${this.dateValue(this.entry.inclusiveEnd)} @click=${this.openPicker} @change=${this.handleEndDateChange}>
				`}
			</div>
			<button class="switch" role="switch" aria-label=${t('All day')} title=${this.entry.allDay ? t('Include time') : t('Switch to all-day')}
				aria-checked=${!this.entry.allDay} @click=${this.toggleAllDay}
			></button>
			<div class="times">
				${this.entry.allDay ? html`
					<span class="allday-label">${t('All day')}</span>
					` : html`
						<input type="time" class="subtle" aria-label=${t('Start time')} .value=${this.timeValue(this.entry.start)} @click=${this.openPicker} @change=${this.handleStartTimeChange}>
						<span class="arrow">→</span>
						<input type="time" class="subtle" aria-label=${t('End time')} .value=${this.timeValue(this.entry.effectiveEnd)} @click=${this.openPicker} @change=${this.handleEndTimeChange}>
					`}
			</div>
			${this.entry.allDay ? html.nothing : html`
				<mitra-icon icon="globe"></mitra-icon>
				<div class="zone-row">
					<button class="zone-label" ?disabled=${this.zoneReadonly}
						title=${this.zoneTitle} aria-label=${this.zoneTitle}
						style="anchor-name: ${this.anchor}"
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
				`}
			<mitra-time-zone-picker style="position-anchor: ${this.anchor}"
				.selected=${this.entry.timeZone && this.entry.timeZone !== FLOATING_TIME_ZONE ? this.entry.timeZone : undefined}
				@pick=${this.handleZonePick}
			></mitra-time-zone-picker>
			<mitra-icon icon="repeat"></mitra-icon>
			<mitra-repeat-field .entry=${this.entry} @change=${() => this.commit()}></mitra-repeat-field>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-when': EntryDetailsWhen
	}
}
