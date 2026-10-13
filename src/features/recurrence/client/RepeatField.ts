import { Component, component, html, css, property, state, event, live } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { Recurrence, type RecurrencePreset } from '../Recurrence.js'
import { RecurrenceFrequency } from '../RecurrenceFrequency.js'
import { RecurrenceEnd } from '../RecurrenceEnd.js'
import { RecurrenceWeekday } from '../RecurrenceWeekday.js'
import { type Entry } from '../../entries/Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { type SelectionGroupValue } from '../../../design/SelectionGroup.js'
type MenuItem = RecurrencePreset & { checked: boolean }
type MonthlyOption = { key: string, label: string }

/** The editor's Repeat row: presets from the series' start, and a dialog for a custom rule. */
@component('mitra-repeat-field')
export class RepeatField extends Component {
	@property({
		type: Object,
		// A popover reused for another entry must not keep editing the last one's rule.
		updated(this: RepeatField) { this.draft = undefined },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() private draft?: Recurrence

	// Kept while the other end is chosen, so switching back restores them.
	@state() private lastUntil?: RecurrenceEnd
	@state() private lastCount = 10

	protected override createRenderRoot() { return this }

	/** The series' start, not the shown occurrence's: a rule that misses its anchor drops every occurrence before its first match. */
	private get start(): DateTime { return this.entry.seriesStart ?? this.entry.start ?? this.entry.due! }

	private get currentLabel(): string {
		return this.entry.recurrence ? this.entry.recurrence.describe(this.start) : t('Does not repeat')
	}

	private commit(recurrence?: Recurrence) {
		// `null` removes a rule, as JSON drops an `undefined` one, which the server reads as unchanged.
		this.entry.recurrence = recurrence ?? (this.entry.recurrence ? null : undefined)
		this.requestUpdate()
		this.change.dispatch()
	}

	private get menuItems(): Array<MenuItem> {
		const presets = Recurrence.presets(this.start)
		const selectedId = Recurrence.matchedPresetId(presets, this.entry.recurrence)
		const items: Array<MenuItem> = presets.map(preset => ({ ...preset, checked: preset.id === selectedId }))
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
			return
		}
		this.commit(this.menuItems.find(item => item.id === id)?.recurrence)
	}

	private openCustomDialog() {
		this.draft = this.entry.recurrence ?? Recurrence.defaultFor(this.start)
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

	private readonly onFreq = (e: CustomEvent<RecurrenceFrequency>) => {
		const freq = e.detail
		const patch: Partial<Recurrence> = { freq, byday: undefined, bymonthday: undefined }
		if (freq === RecurrenceFrequency.Weekly) {
			patch.byday = [RecurrenceWeekday.of(this.start)]
		} else if (freq === RecurrenceFrequency.Monthly) {
			patch.bymonthday = this.start.recurrenceDate.day
		}
		this.patchDraft(patch)
	}

	private readonly chooseWeekdays = (e: CustomEvent<SelectionGroupValue>) => {
		const selected = new Set(e.detail instanceof Array ? e.detail : [])
		// At least one day stays selected: emptying the set re-renders the one it had.
		this.patchDraft(selected.size ? { byday: RecurrenceWeekday.all.filter(weekday => selected.has(weekday.code)) } : {})
	}

	private get monthlyOptions(): Array<MonthlyOption> {
		const weekday = RecurrenceWeekday.of(this.start)
		const recurrenceDate = this.start.recurrenceDate
		const weekOfMonth = Math.floor((recurrenceDate.day - 1) / 7) + 1
		const monthday = this.draft!.bymonthday ?? recurrenceDate.day
		const options: Array<MonthlyOption> = [
			{ key: 'monthday', label: t('the ${ordinal}', { ordinal: Recurrence.ordinal(monthday) }) },
			this.monthlyOption(weekday.nth(weekOfMonth)),
		]
		if (recurrenceDate.day + 7 > recurrenceDate.daysInMonth) {
			options.push(this.monthlyOption(weekday.nth(-1)))
		}
		// A rule from elsewhere ("2nd Tue") may name a day the start doesn't.
		const mode = this.monthlyMode
		if (mode !== 'monthday' && !options.some(option => option.key === mode)) {
			options.push(this.monthlyOption(RecurrenceWeekday.parse(mode)!))
		}
		return options
	}

	private monthlyOption(weekday: RecurrenceWeekday): MonthlyOption {
		return {
			key: weekday.toString(),
			label: weekday.ordinal === undefined ? weekday.format()
				: weekday.ordinal === -1 ? t('the last ${weekday}', { weekday: weekday.format() })
					: t('the ${ordinal} ${weekday}', { ordinal: Recurrence.ordinal(weekday.ordinal), weekday: weekday.format() }),
		}
	}

	private get monthlyMode(): string {
		return this.draft!.bymonthday ? 'monthday' : this.draft!.byday?.[0]?.toString() ?? 'monthday'
	}

	private readonly chooseMonthly = (e: CustomEvent<SelectionGroupValue>) => {
		const key = String(e.detail)
		this.patchDraft(key === 'monthday' ? { bymonthday: this.start.recurrenceDate.day, byday: undefined } : { byday: [RecurrenceWeekday.parse(key)!], bymonthday: undefined })
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

	/** A month past the occurrence on show, as the series' own start may lie years back. */
	private get draftUntil(): RecurrenceEnd {
		const shown = this.entry.start ?? this.entry.due ?? this.start
		return this.draft!.until ?? this.lastUntil ?? new RecurrenceEnd(shown.recurrenceDate.add({ months: 1 }))
	}

	private get draftCount(): number {
		return this.draft!.count ?? this.lastCount
	}

	// UNTIL is a UTC calendar day (see RecurrenceEnd), which the field reads and writes in UTC.
	private readonly onUntil = (e: CustomEvent<DateTime | undefined>) => {
		if (e.detail) {
			this.lastUntil = RecurrenceEnd.of(e.detail)
			this.patchDraft({ until: this.lastUntil, count: undefined })
		}
	}

	private readonly onCount = (e: CustomEvent<number>) => {
		this.lastCount = e.detail
		this.patchDraft({ count: this.lastCount, until: undefined })
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
								${RecurrenceFrequency.all.map(frequency => html`<mitra-option .value=${frequency}>${frequency.formatUnit(draft.every)}</mitra-option>`)}
							</mitra-select>
						</div>

						${draft.freq !== RecurrenceFrequency.Weekly ? html.nothing : html`
							<mitra-selection-group multiple aria-label=${t('Weekdays')} .value=${live(draft.byday?.map(weekday => weekday.code) ?? [])} @change=${this.chooseWeekdays}>
								${RecurrenceWeekday.week().map(weekday => html`
									<mitra-toggle value=${weekday.code} title=${weekday.format()}>${weekday.format().slice(0, 2)}</mitra-toggle>
								`)}
							</mitra-selection-group>
						`}

						${draft.freq !== RecurrenceFrequency.Monthly ? html.nothing : html`
							<mitra-selection-group aria-label=${t('Repeat')} .value=${live(this.monthlyMode)} @change=${this.chooseMonthly}>
								${this.monthlyOptions.map(option => html`<mitra-toggle value=${option.key}>${option.label}</mitra-toggle>`)}
							</mitra-selection-group>
						`}

						<span class="ends-label">${t('Ends')}</span>
						<mitra-selection-group class="ends" aria-label=${t('Ends')} .value=${live(this.ends)} @change=${this.setEnds}>
							<mitra-radio value="never">${t('Never')}</mitra-radio>
							<mitra-radio value="until">${t('On')}</mitra-radio>
							<mitra-date-field label=${t('End date')} ?disabled=${!draft.until}
								timeZone="UTC" .value=${this.draftUntil.instant} @change=${this.onUntil}></mitra-date-field>
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
