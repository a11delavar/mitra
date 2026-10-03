import { Component, component, html, css, property, state, event, live } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { Recurrence, WEEKDAY_CODES, type Frequency, type RecurrencePreset } from '../Recurrence.js'
import { type Entry } from '../../entries/Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { type SelectionGroupValue } from '../../../design/SelectionGroup.js'
const FREQ_OPTIONS: ReadonlyArray<{ value: Frequency }> = [
	{ value: 'DAILY' },
	{ value: 'WEEKLY' },
	{ value: 'MONTHLY' },
	{ value: 'YEARLY' },
]

// The frequency unit as it reads in the "Every N …" select, pluralized by the current interval so
// "Every 1 week" / "Every 2 weeks" agree. The count drives the plural, hence pluralityNumber.
/** The unit alone, as the number beside it asks for it ("Every [2] [weeks]"): the language's own plural, by `Intl`. */
function freqLabel(value: Frequency, count: number): string {
	const unit = ({ DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' } as const)[value]
	return new Intl.NumberFormat(Localizer.languages.current, { style: 'unit', unit, unitDisplay: 'long' })
		.formatToParts(count)
		.filter(part => part.type === 'unit')
		.map(part => part.value)
		.join('')
}

type MenuItem = RecurrencePreset & { checked: boolean }
type MonthlyOption = { key: string, label: string }

/**
 * The "Repeat" control for the entry editor: a select of presets derived from the series anchor
 * date (like the source row's selector), and a "Custom…" dialog for the full interval / weekday /
 * ends editor. It mutates `entry.recurrence` (a `Recurrence` value object) in place and fires `change`;
 * the host persists. Rule changes are always series-wide.
 */
@component('mitra-repeat-field')
export class RepeatField extends Component {
	@property({
		type: Object,
		// If the shown entry changes while the Custom dialog is open (e.g. the popover is reused for another
		// entry), close it and drop the stale draft rather than leaving it editing the wrong entry.
		updated(this: RepeatField) { this.draft = undefined },
	}) entry!: Entry

	/** Fired after `entry.recurrence` is mutated, so the host can persist and re-render. */
	@event() readonly change!: EventDispatcher

	/** The working copy edited by the Custom dialog; absent when the dialog is closed. */
	@state() private draft?: Recurrence

	// Remember the last-entered UNTIL date / COUNT so toggling the "Ends" radios doesn't discard them.
	@state() private lastUntil?: DateTime
	@state() private lastCount = 10

	protected override createRenderRoot() { return this }

	/** The date the rule iterates from: the SERIES anchor, not the shown occurrence's own date. Presets
	 * and defaults derived from a later occurrence would write a rule that no longer matches the anchor,
	 * silently dropping every occurrence before the new rule's first match. */
	private get start(): DateTime { return this.entry.seriesStart ?? this.entry.start ?? this.entry.due! }

	private get currentLabel(): string {
		return this.entry.recurrence ? this.entry.recurrence.describe(this.start) : t('Does not repeat')
	}

	private commit(recurrence?: Recurrence) {
		// An explicit `null` (not undefined) marks a deliberate removal of an existing rule: the PUT payload
		// must carry the clear (JSON drops undefined keys), so the backend can tell "remove" from "not sent".
		this.entry.recurrence = recurrence ?? (this.entry.recurrence ? null : undefined)
		this.requestUpdate()
		this.change.dispatch()
	}

	// --- Preset dropdown ------------------------------------------------------------------------------

	private get menuItems(): Array<MenuItem> {
		const presets = Recurrence.presets(this.start)
		const selectedId = Recurrence.matchedPresetId(presets, this.entry.recurrence)
		const items: Array<MenuItem> = presets.map(preset => ({ ...preset, checked: preset.id === selectedId }))
		// A custom rule (or a preset narrowed by an end) gets its own checked row, like the screenshot's
		// "Every week on Thu until Jul 18".
		if (this.entry.recurrence && !selectedId) {
			items.push({ id: 'current', label: this.currentLabel, recurrence: this.entry.recurrence, checked: true })
		}
		items.push({ id: 'custom', label: t('Custom…'), checked: false })
		return items
	}

	private readonly handleSelect = (e: CustomEvent<string>) => {
		const id = e.detail
		if (id === 'custom') {
			// An action rather than a value: the select goes back to the rule in force as this re-renders.
			this.openCustomDialog()
			return
		}
		if (id === 'current') {
			return // the already-active custom rule
		}
		this.commit(this.menuItems.find(item => item.id === id)?.recurrence)
	}

	// --- Custom dialog --------------------------------------------------------------------------------

	private openCustomDialog() {
		this.draft = this.entry.recurrence ?? Recurrence.defaultFor(this.start)
		// Seed the remembered ends-values from the rule being edited, so the inactive option keeps a sensible
		// pre-fill rather than snapping to the defaults.
		if (this.draft.until) {
			this.lastUntil = this.draft.until
		} else if (this.draft.count) {
			this.lastCount = this.draft.count
		}
	}

	private readonly cancelDialog = () => {
		this.draft = undefined
	}

	private readonly confirmDialog = () => {
		if (this.draft) {
			this.commit(this.draft)
		}
		this.draft = undefined
	}

	private patchDraft(patch: Partial<Recurrence>) {
		this.draft = this.draft!.with(patch)
		this.requestUpdate()
	}

	private readonly onInterval = (e: CustomEvent<number>) => {
		this.patchDraft({ interval: e.detail })
	}

	private readonly onFreq = (e: CustomEvent<Frequency>) => {
		const freq = e.detail
		// Reset the by-rules so each frequency starts from a valid default derived from the start date.
		const patch: Partial<Recurrence> = { freq, byday: undefined, bymonthday: undefined }
		if (freq === 'WEEKLY') {
			patch.byday = [Recurrence.weekdayCode(this.start)]
		} else if (freq === 'MONTHLY') {
			patch.bymonthday = this.start.day
		}
		this.patchDraft(patch)
	}

	private readonly chooseWeekdays = (e: CustomEvent<SelectionGroupValue>) => {
		const selected = new Set(e.detail instanceof Array ? e.detail : [])
		// At least one day stays selected: emptying the set re-renders the one it had.
		this.patchDraft(selected.size ? { byday: WEEKDAY_CODES.filter(code => selected.has(code)) } : {})
	}

	private get monthlyOptions(): Array<MonthlyOption> {
		const wd = Recurrence.weekdayCode(this.start)
		const label = Recurrence.weekdayLabel(wd)
		const weekOfMonth = Math.floor((this.start.day - 1) / 7) + 1
		// The "on the Nth" label tracks the rule's own day when it differs from the start (e.g. a loaded
		// BYMONTHDAY=15 while the start is the 25th).
		const monthday = this.draft!.bymonthday ?? this.start.day
		const options: Array<MonthlyOption> = [
			{ key: 'monthday', label: t('the ${ordinal}', { ordinal: Recurrence.ordinal(monthday) }) },
			{ key: `${weekOfMonth}${wd}`, label: t('the ${ordinal} ${weekday}', { ordinal: Recurrence.ordinal(weekOfMonth), weekday: label }) },
		]
		if (this.start.day + 7 > this.start.daysInMonth) {
			options.push({ key: `-1${wd}`, label: t('the last ${weekday}', { weekday: label }) })
		}
		// Surface a loaded BYDAY ordinal that the start date doesn't derive (e.g. an external "2nd Tue"), so the
		// segmented control reflects the actual rule instead of showing nothing selected.
		const mode = this.monthlyMode
		if (mode !== 'monthday' && !options.some(option => option.key === mode)) {
			options.push({ key: mode, label: this.monthlyByDayLabel(mode) })
		}
		return options
	}

	private monthlyByDayLabel(code: string): string {
		const weekday = Recurrence.weekdayLabel(code)
		return code.startsWith('-1')
			? t('the last ${weekday}', { weekday })
			: t('the ${ordinal} ${weekday}', { ordinal: Recurrence.ordinal(Number(/^-?\d+/.exec(code)?.[0] ?? '1')), weekday })
	}

	private get monthlyMode(): string {
		return this.draft!.bymonthday ? 'monthday' : this.draft!.byday?.[0] ?? 'monthday'
	}

	private readonly chooseMonthly = (e: CustomEvent<SelectionGroupValue>) => {
		const key = String(e.detail)
		this.patchDraft(key === 'monthday' ? { bymonthday: this.start.day, byday: undefined } : { byday: [key], bymonthday: undefined })
	}

	private get ends() {
		return this.draft!.until ? 'until' : this.draft!.count ? 'count' : 'never'
	}

	private readonly setEnds = (e: CustomEvent<SelectionGroupValue>) => {
		const type = e.detail
		if (type === 'until') {
			this.patchDraft({ until: this.draftUntil, count: undefined })
		} else if (type === 'count') {
			this.patchDraft({ count: this.draftCount, until: undefined })
		} else {
			this.patchDraft({ until: undefined, count: undefined })
		}
	}

	private get draftUntil(): DateTime {
		if (this.draft!.until) {
			return this.draft!.until
		}
		if (this.lastUntil) {
			return this.lastUntil
		}
		const monthOn = this.start.add({ months: 1 })
		return Recurrence.untilFromDay(monthOn.year, monthOn.month, monthOn.day)
	}

	private get draftCount(): number {
		return this.draft!.count ?? this.lastCount
	}

	private readonly onUntil = (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		if (!value) {
			return
		}
		const [year, month, day] = value.split('-')
		this.lastUntil = Recurrence.untilFromDay(Number(year), Number(month), Number(day))
		this.patchDraft({ until: this.lastUntil, count: undefined })
	}

	private readonly onCount = (e: CustomEvent<number>) => {
		this.lastCount = e.detail
		this.patchDraft({ count: this.lastCount, until: undefined })
	}

	// UNTIL is a UTC calendar day (see Recurrence.untilFromDay), so read it back via getUTC* for the input.
	private dateValue(date: DateTime) {
		const utc = date as unknown as Date
		return `${String(utc.getUTCFullYear()).padStart(4, '0')}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
	}

	static override get styles() {
		return css`
			mitra-repeat-field {
				grid-column: 2;
				min-width: 0;
				display: flex;

				> mitra-select {
					flex: 1;
				}

				.custom-repeat {
					display: flex;
					flex-direction: column;
					gap: 1rem;

					.every {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						> .interval { inline-size: 4rem; }
						mitra-select { min-inline-size: 6rem; }
					}

					.ends-label {
						margin-block-end: -0.5rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					.ends {
						display: grid;
						grid-template-columns: auto 1fr;
						align-items: center;
						gap: 0.625rem 1rem;

						> mitra-radio { grid-column: 1; }
						> :not(mitra-radio) { grid-column: 2; justify-self: start; }
						mitra-number-field { inline-size: 4rem; }
						.after-times { display: inline-flex; align-items: center; gap: 0.5rem; }
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.entry?.start && !this.entry?.due ? html.nothing : html`
			<!-- No rule means nothing is chosen here, so "Does not repeat" reads as a placeholder rather than as a value. -->
			<mitra-select label=${t('Repeat')} .placeholder=${!this.entry.recurrence} ?disabled=${!getCapabilities(this.entry.sourceId).editEntries}
				.value=${live(this.menuItems.find(item => item.checked)?.id ?? 'none')}
				@change=${this.handleSelect}
			>
				${this.menuItems.map(item => html`
					<mitra-option .value=${item.id} label=${item.label} ?data-muted=${item.id === 'custom'}>
						${item.label}
						${!item.detail ? html.nothing : html`<span slot="detail">${item.detail}</span>`}
					</mitra-option>
				`)}
			</mitra-select>
			${this.dialogTemplate}
		`
	}

	private get dialogTemplate() {
		const draft = this.draft
		return html`
			<mitra-dialog heading=${t('Repeat')} primaryButtonText=${t('Done')} .open=${!!draft}
				@openChange=${this.cancelDialog} @primaryAction=${this.confirmDialog}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				${!draft ? html.nothing : html`
					<div class="custom-repeat">
						<div class="every">
							<label>${t('Every')}</label>
							<mitra-number-field class="interval" min="1" aria-label=${t('Interval')} .value=${draft.every} @change=${this.onInterval}></mitra-number-field>
							<mitra-select label=${t('Frequency')} .value=${draft.freq} @change=${this.onFreq}>
								${FREQ_OPTIONS.map(option => html`<mitra-option .value=${option.value}>${freqLabel(option.value, draft.every)}</mitra-option>`)}
							</mitra-select>
						</div>

						${draft.freq !== 'WEEKLY' ? html.nothing : html`
							<mitra-selection-group multiple aria-label=${t('Weekdays')} .value=${live(draft.byday ?? [])} @change=${this.chooseWeekdays}>
								${WEEKDAY_CODES.map(code => html`
									<mitra-toggle value=${code} title=${Recurrence.weekdayLabel(code)}>${Recurrence.weekdayLabel(code).slice(0, 2)}</mitra-toggle>
								`)}
							</mitra-selection-group>
						`}

						${draft.freq !== 'MONTHLY' ? html.nothing : html`
							<mitra-selection-group aria-label=${t('Repeat')} .value=${live(this.monthlyMode)} @change=${this.chooseMonthly}>
								${this.monthlyOptions.map(option => html`<mitra-toggle value=${option.key}>${option.label}</mitra-toggle>`)}
							</mitra-selection-group>
						`}

						<span class="ends-label">${t('Ends')}</span>
						<mitra-selection-group class="ends" aria-label=${t('Ends')} .value=${live(this.ends)} @change=${this.setEnds}>
							<mitra-radio value="never">${t('Never')}</mitra-radio>
							<mitra-radio value="until">${t('On')}</mitra-radio>
							<mitra-date-field label=${t('End date')} ?disabled=${!draft.until}
								.value=${this.dateValue(this.draftUntil)} @change=${this.onUntil}></mitra-date-field>
							<mitra-radio value="count">${t('After')}</mitra-radio>
							<span class="after-times">
								<mitra-number-field min="1" aria-label=${t('Occurrences')} ?disabled=${!draft.count}
									.value=${this.draftCount} @change=${this.onCount}></mitra-number-field>
								${t('times')}
							</span>
						</mitra-selection-group>
					</div>
				`}
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-repeat-field': RepeatField
	}
}
