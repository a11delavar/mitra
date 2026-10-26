import { bind, component, html, css, state, type PropertyValues } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { TimeZones } from '#features/time/client/TimeZones.js'
import { type Entry } from '../Entry.js'
import type { EntrySpan } from '../EntrySpan.js'
import { entryColors } from './entryColors.css.js'

/** Asks which days an entry is copied to, answering the span of each copy: the same times on every day chosen. */
@component('mitra-dialog-duplicate-days')
export class DialogDuplicateDays extends DialogComponent<{ readonly entry: Entry }, ReadonlyArray<EntrySpan>> {
	/** Where days are read, as the views read them, floating times included: the browser holds those on its own wall clock. */
	private readonly zone = TimeZones.here

	/** The first and the last day the entry covers, which a copy is not for: Duplicate is. */
	private readonly firstDay = this.dayOf((this.parameters.entry.start ?? this.parameters.entry.due)!)
	private readonly lastDay = this.dayOf(this.parameters.entry.start ? this.parameters.entry.inclusiveEnd : this.parameters.entry.due!)

	private readonly isCovered = (day: DateTime) => !day.isBefore(this.firstDay) && !day.isAfter(this.lastDay)

	@state() days: ReadonlyArray<DateTime> = []

	protected override createRenderRoot() { return this }

	private dayOf(date: Date) {
		return DateTime.from(date.getTime(), undefined, this.zone.id).dayStart
	}

	/** The time of day every copy keeps: its hours, a moment's start, or the whole day; an unscheduled task's due has none to show. */
	private get timeOfDay() {
		const { entry } = this.parameters
		return entry.allDay ? t('All day')
			: !entry.start ? undefined
				: !entry.end ? entry.start.format({ timeStyle: 'short' })
					: new DateTimeRange(entry.start, entry.end).format({ timeStyle: 'short' })
	}

	// After the dialog opens, which would put the focus on its first button.
	protected override firstUpdated(props: PropertyValues<this>) {
		super.firstUpdated(props)
		this.querySelector('mitra-date-picker')?.focus()
	}

	static override get styles() {
		return css`
			mitra-dialog-duplicate-days {
				/* Room for two months side by side; narrower, the second wraps beneath the first. */
				--mitra-dialog-width: min(34rem, 92vw);

				/* Opened over the editor but outside its chip, it takes the entry's accent as the dialogs inside the editor inherit it. */
				> mitra-dialog {
					${entryColors};
				}

				/* One column as wide as the months, which the chip above them spans. */
				mitra-dialog > .days {
					container: duplicate-days / inline-size;
					display: grid;
					justify-content: center;
					gap: 0.75rem;
				}

				/* Wrapped months still fill the room they are given, so where two don't fit side by side the picker takes one's width. */
				@container duplicate-days (width < 492px) {
					mitra-date-picker {
						inline-size: min-content;
					}
				}

				/* What is being copied, worn as its chip in the calendar. Its content never widens the column: a long title ends in an ellipsis. */
				.entry {
					contain: inline-size;
					display: flex;
					align-items: baseline;
					gap: 0.5rem;
					/* As far from the months as the heading is from it: it names the copy, the months are where it goes. */
					margin: 0 0 0.75rem;
					padding: 0.375rem 0.625rem;
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
					border-inline-start: 3px solid var(--mitra-entry-segment-color);
					border-radius: var(--border-radius);
					color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, var(--color-text));
					font-size: 0.8125rem;

					> .heading {
						min-inline-size: 0;
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
						font-weight: 600;
					}

					> .time {
						flex-shrink: 0;
						font-variant-numeric: tabular-nums;
					}
				}

				.hint {
					justify-self: center;
					margin: 0;
					font-size: 0.75rem;
					color: var(--color-text-muted);
				}

				@media (pointer: coarse) {
					.hint {
						display: none;
					}
				}
			}
		`
	}

	protected override get template() {
		const { entry } = this.parameters
		const count = this.days.length
		return html`
			<mitra-dialog style=${`--mitra-entry-segment-color: ${String(entry.effectiveColor ?? '')}`}
				heading=${t('Duplicate to other days')}
				primaryButtonText=${count ? t('Duplicate to ${count:pluralityNumber} days', { count }) : t('Duplicate')}
				?primaryButtonDisabled=${!count}
			>
				<div class="days">
					<p class="entry">
						<span class="heading">${entry.heading || t('Untitled')}</span>
						${!this.timeOfDay ? html.nothing : html`<span class="time">${this.timeOfDay}</span>`}
					</p>
					<mitra-date-picker multiple months="2" .navigationDate=${this.firstDay} .isDisabled=${this.isCovered} .value=${bind(this, 'days')}></mitra-date-picker>
					<p class="hint">${t('Hold Shift to choose a run of days')}</p>
				</div>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		const { entry } = this.parameters
		return this.days.map(day => entry.spanOn(this.zone.dayOf(day), this.zone))
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-duplicate-days': DialogDuplicateDays
	}
}
