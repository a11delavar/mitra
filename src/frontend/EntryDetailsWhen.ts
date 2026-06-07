import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import type { Entry } from 'shared'

/**
 * The date / time / all-day editor for an entry, split out of the (long) entry-details popover. It renders
 * one `<li>` that shares the popover's column grid (`display: contents` keeps it a grid item of the parent
 * `<ul>`, so its leading icon/switch line up with the other rows). Each input is wired straight to an
 * `Entry` span method — editing the start moves, the end resizes — then it fires `change` for the host to
 * persist. The native fields read as plain text; the picker glyph is hidden and surfaced on click.
 */
@component('mitra-entry-details-when')
export class EntryDetailsWhen extends Component {
	@property({
		type: Object,
		updated(this: EntryDetailsWhen) { this.endDateShown = false }
	}) entry!: Entry

	/** Fired after a span edit mutates the entry in place; the host persists and refreshes. */
	@event() readonly change!: EventDispatcher

	// Reveals the end-date field for a single-day entry without changing its dates (see addEndDate); reset
	// when a different entry is shown so it reflects that entry, not the previous one.
	@state() private endDateShown = false

	protected override createRenderRoot() { return this }

	// Native inputs carry plain strings; convert to/from DateTime via `.with()` (no epoch math, so the
	// timezone is preserved).
	private dateValue(dt: DateTime) {
		return `${String(dt.year).padStart(4, '0')}-${String(dt.month).padStart(2, '0')}-${String(dt.day).padStart(2, '0')}`
	}

	private timeValue(dt: DateTime) {
		return `${String(dt.hour).padStart(2, '0')}:${String(dt.minute).padStart(2, '0')}`
	}

	private withDate(value: string, base: DateTime) {
		const [year, month, day] = value.split('-').map(Number)
		return base.with({ year, month, day })
	}

	private withTime(value: string, base: DateTime) {
		const [hour, minute] = value.split(':').map(Number)
		return base.with({ hour, minute, second: 0, millisecond: 0 })
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
				/* Keep the rows as grid items of the popover's <ul>, so the leading icon/switch column lines
				   up with the source/colour rows below. */
				display: contents;
			}

			mitra-entry-details-when > .when {
				display: grid;
				grid-template-columns: subgrid;   /* the popover's two columns: leading glyph | content */
				grid-column: 1 / -1;
				align-items: center;
				row-gap: 0.25rem;
				/* Closes the date/time/all-day group with a divider, like the description row. */
				padding-block-end: 0.75rem;
				border-block-end: 1px solid rgba(255, 255, 255, 0.06);

				/* Leading column — one glyph per row (clock, duration, switch), auto-flowed so they line up
				   with the popover's other row icons. */
				> mitra-icon { grid-column: 1; font-size: 0.87rem; color: var(--color-text-muted); flex-shrink: 0; }
				> .duration { grid-column: 1; font-size: 0.7rem; white-space: nowrap; color: var(--color-text-muted); }
				> .switch { grid-column: 1; margin-block-start: 0.3rem; }
				> .allday-label { grid-column: 2; margin-block-start: 0.3rem; color: var(--color-text-muted); }

				/* Recurring occurrences replace the all-day toggle with a read-only "Repeats …" summary. */
				> .repeat-summary { grid-column: 2; color: var(--color-text-muted); }
				input:disabled { color: var(--color-text-muted); cursor: default; opacity: 1; }

				/* The dates and times rows are each the SAME 3-column grid inside the content column, so their
				   start/→/end line up across the two rows — all within the component, not the popover grid. */
				.dates, .times {
					grid-column: 2;
					display: grid;
					grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
					align-items: center;
					column-gap: 0.5rem;
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

				/* Fields read as plain text — transparent until hovered/focused, filling their column so
				   start/end line up. The negative inline margin pulls the text flush with the content-column
				   edge so it aligns with the title/source text. They open the picker on click (hence the
				   pointer + full opacity, overriding the read-only dimming). */
				input {
					width: 100%;
					min-width: 0;
					height: auto;
					font: inherit;
					color: inherit;
					opacity: 1;
					cursor: pointer;
					background: transparent;
					border: 1px solid transparent;
					border-radius: var(--border-radius);
					margin-inline-start: -0.25rem;
					padding: 0.125rem 0.25rem;
					transition: background 0.15s ease;

					&:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); }
					&:focus, &:focus-visible { background: color-mix(in srgb, var(--color-text) 10%, transparent); outline: none; }

					&::-webkit-calendar-picker-indicator { display: none; }
				}
			}
		`
	}

	protected override get template() {
		const entry = this.entry
		if (!entry?.start) {
			return html.nothing
		}
		// A recurring occurrence is read-only here (v1): its times come from the series, and editing the
		// schedule isn't supported yet. The all-day row is replaced by a "Repeats …" summary.
		const recurring = entry.isRecurring
		const showEnd = entry.multiDay || (!recurring && this.endDateShown)
		return html`
			<li class="when">
				<mitra-icon icon=${entry.allDay ? 'calendar-days' : 'clock'}></mitra-icon>
				<div class="dates">
					<input type="date" aria-label="Start date" ?disabled=${recurring} .value=${this.dateValue(entry.start)} @click=${this.openPicker} @change=${this.handleStartDateChange}>
					${showEnd ? html`
						<span class="arrow">→</span>
						<input type="date" class="end-date" aria-label="End date" ?disabled=${recurring} .value=${this.dateValue(entry.inclusiveEnd)} @click=${this.openPicker} @change=${this.handleEndDateChange}>
					` : recurring ? html.nothing : html`
						<button class="add-end" @click=${this.addEndDate}>+ end date</button>
					`}
				</div>
				${entry.allDay ? html.nothing : html`
					<span class="duration">${entry.duration}</span>
					<div class="times">
						<input type="time" aria-label="Start time" ?disabled=${recurring} .value=${this.timeValue(entry.start)} @click=${this.openPicker} @change=${this.handleStartTimeChange}>
						<span class="arrow">→</span>
						<input type="time" aria-label="End time" ?disabled=${recurring} .value=${this.timeValue(entry.effectiveEnd)} @click=${this.openPicker} @change=${this.handleEndTimeChange}>
					</div>
				`}
				${recurring ? html`
					<mitra-icon icon="repeat"></mitra-icon>
					<span class="repeat-summary">${recurrenceSummary(entry.rrule)}</span>
				` : html`
					<button class="switch" role="switch" aria-checked=${entry.allDay} aria-label="All day" @click=${this.toggleAllDay}></button>
					<span class="allday-label">All day</span>
				`}
			</li>
		`
	}
}

const WEEKDAYS: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }
const FREQ_ADVERB: Record<string, string> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' }
const FREQ_UNIT: Record<string, string> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }

/** Best-effort, human summary of an RRULE for the read-only badge — e.g. "Repeats weekly on Mon, Wed, Fri"
 * or "Repeats every 2 weeks". Falls back to a plain "Repeats" for rules it can't pretty-print. */
function recurrenceSummary(rrule?: string): string {
	if (!rrule) {
		return 'Repeats'
	}
	const parts: Record<string, string> = {}
	for (const part of rrule.split(';')) {
		const [key, value] = part.split('=')
		if (key) {
			parts[key] = value ?? ''
		}
	}
	const freq = parts.FREQ ?? ''
	const unit = FREQ_UNIT[freq]
	if (!unit) {
		return 'Repeats'
	}
	const interval = Number(parts.INTERVAL ?? 1)
	const cadence = interval > 1 ? `every ${interval} ${unit}s` : FREQ_ADVERB[freq]
	const days = parts.BYDAY ? parts.BYDAY.split(',').map(d => WEEKDAYS[d.replace(/^[+-]?\d+/, '')] ?? d).join(', ') : ''
	return `Repeats ${cadence}${days ? ` on ${days}` : ''}`
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-when': EntryDetailsWhen
	}
}
