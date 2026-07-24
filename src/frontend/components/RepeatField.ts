import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { Recurrence, WEEKDAY_CODES, type Entry, type Frequency, type RecurrencePreset } from 'shared'

const FREQ_OPTIONS: ReadonlyArray<{ value: Frequency }> = [
	{ value: 'DAILY' },
	{ value: 'WEEKLY' },
	{ value: 'MONTHLY' },
	{ value: 'YEARLY' },
]

// The frequency unit as it reads in the "Every N …" select, pluralized by the current interval so
// "Every 1 week" / "Every 2 weeks" agree. The count drives the plural, hence pluralityNumber.
function freqLabel(value: Frequency, count: number): string {
	switch (value) {
		case 'DAILY': return t('${count:pluralityNumber} days', { count })
		case 'WEEKLY': return t('${count:pluralityNumber} weeks', { count })
		case 'MONTHLY': return t('${count:pluralityNumber} months', { count })
		case 'YEARLY': return t('${count:pluralityNumber} years', { count })
	}
}

type MenuItem = RecurrencePreset & { checked: boolean }
type MonthlyOption = { key: string, label: string }

/**
 * The "Repeat" control for the entry editor: a \`subtle\` select of presets derived from the series
 * anchor date (like the source row's selector), and a "Custom…" dialog for the full interval / weekday /
 * ends editor. It mutates `entry.recurrence` (a `Recurrence` value object) in place and fires `change`;
 * the host persists. Rule changes are always series-wide.
 */
@component('mitra-repeat-field')
export class RepeatField extends Component {
	// Per-instance token so the dialog's radio groups of two open editors never collide.
	private static count = 0
	private readonly anchor = `--repeat-${RepeatField.count++}`

	@property({
		type: Object,
		// If the shown entry changes while the Custom dialog is open (e.g. the popover is reused for another
		// entry), close it and drop the stale draft rather than leaving it editing the wrong entry.
		updated(this: RepeatField) { this.dialog?.close(); this.draft = undefined },
	}) entry!: Entry

	/** Fired after `entry.recurrence` is mutated, so the host can persist and re-render. */
	@event() readonly change!: EventDispatcher

	/** The working copy edited by the Custom dialog; absent when the dialog is closed. */
	@state() private draft?: Recurrence

	// Remember the last-entered UNTIL date / COUNT so toggling the "Ends" radios doesn't discard them.
	@state() private lastUntil?: DateTime
	@state() private lastCount = 10

	protected override createRenderRoot() { return this }

	/** The date the rule iterates from — the SERIES anchor, not the shown occurrence's own date. Presets
	 * and defaults derived from a later occurrence would write a rule that no longer matches the anchor,
	 * silently dropping every occurrence before the new rule's first match. */
	private get start(): DateTime { return this.entry.seriesStart ?? this.entry.start! }

	@query('dialog') private readonly dialog?: HTMLDialogElement
	// The preset dropdown (the first select) and the Custom dialog's frequency select.
	@query('select') private readonly presetSelect?: HTMLSelectElement
	@query('dialog select') private readonly freqSelect?: HTMLSelectElement

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

	private readonly handleSelect = (e: Event) => {
		e.stopPropagation() // the RULE change is dispatched via commit(); the raw select change isn't a span edit
		const id = (e.target as HTMLSelectElement).value
		if (id === 'custom') {
			// An action, not a value: reopen the real selection underneath and edit in the dialog instead.
			this.syncSelect()
			this.openCustomDialog()
			return
		}
		if (id === 'current') {
			return // the already-active custom rule
		}
		this.commit(this.menuItems.find(item => item.id === id)?.recurrence)
	}

	/** Keep the select's own (dirty-flagged) value on the checked item — after a "Custom…" pick, a dialog
	 * cancel, or an external change re-render, the attribute alone doesn't move it back. */
	private syncSelect() {
		if (this.presetSelect) {
			this.presetSelect.value = this.menuItems.find(item => item.checked)?.id ?? 'none'
		}
	}

	protected override updated() {
		this.syncSelect()
		// The Custom dialog's frequency select suffers the same value-before-options timing on its first
		// render — without this it can display "day" while the rule (and the visible weekday chips) are
		// weekly.
		if (this.freqSelect && this.draft) {
			this.freqSelect.value = this.draft.freq
		}
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
		this.requestUpdate()
		this.updateComplete.then(() => this.dialog?.showModal())
	}

	private readonly cancelDialog = () => {
		this.dialog?.close()
		this.draft = undefined
	}

	private readonly confirmDialog = () => {
		if (this.draft) {
			this.commit(this.draft)
		}
		this.dialog?.close()
		this.draft = undefined
	}

	private patchDraft(patch: Partial<Recurrence>) {
		this.draft = this.draft!.with(patch)
		this.requestUpdate()
	}

	private readonly onInterval = (e: Event) => {
		this.patchDraft({ interval: Math.max(1, Math.trunc(Number((e.target as HTMLInputElement).value)) || 1) })
	}

	private readonly onFreq = (e: Event) => {
		const freq = (e.target as HTMLSelectElement).value as Frequency
		// Reset the by-rules so each frequency starts from a valid default derived from the start date.
		const patch: Partial<Recurrence> = { freq, byday: undefined, bymonthday: undefined }
		if (freq === 'WEEKLY') {
			patch.byday = [Recurrence.weekdayCode(this.start)]
		} else if (freq === 'MONTHLY') {
			patch.bymonthday = this.start.day
		}
		this.patchDraft(patch)
	}

	private readonly toggleWeekday = (code: string) => (e: Event) => {
		e.preventDefault()
		const selected = new Set(this.draft!.byday ?? [])
		if (selected.has(code)) {
			selected.delete(code) // keep at least one day selected
			if (selected.size === 0) {
				return
			}
		} else {
			selected.add(code)
		}
		this.patchDraft({ byday: WEEKDAY_CODES.filter(c => selected.has(c)) })
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

	private readonly chooseMonthly = (key: string) => (e: Event) => {
		e.preventDefault()
		this.patchDraft(key === 'monthday' ? { bymonthday: this.start.day, byday: undefined } : { byday: [key], bymonthday: undefined })
	}

	private readonly setEnds = (type: 'never' | 'until' | 'count') => () => {
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

	private readonly onCount = (e: Event) => {
		this.lastCount = Math.max(1, Math.trunc(Number((e.target as HTMLInputElement).value)) || 1)
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

				/* The same \`subtle\` select as the popover's source row: it reads as plain text until hovered,
				   and its picker wears the popover's tinted glass, opening beside the row before below/above. */
				> select {
					width: 100%;

					selectedcontent {
						display: flex;
						align-items: baseline;
						gap: 0.5rem;
						overflow: hidden;
						white-space: nowrap;

						.detail { color: var(--color-text-muted); }
					}

					/* The same picker strategy as the source selector: the popover's tinted glass, opening
					   beside the row and flipping inline/block when the space runs out. */
					&::picker(select) {
						background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
						border: var(--border);
						box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
						position-area: inline-end span-all;
						position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
						margin-inline: 0.875rem;
						max-height: 60dvh;
						overflow-y: auto;
					}

					option {
						gap: 0.5rem;

						.name { white-space: nowrap; }
						.detail { color: var(--color-text-muted); font-weight: 400; white-space: nowrap; }
						&.custom { color: var(--color-text-muted); }
					}
				}

				/* --- Custom dialog ------------------------------------------------------------------------ */
				dialog {
					margin: auto;
					border: var(--border);
					border-radius: 14px;
					padding: 1.25rem;
					min-width: 320px;
					max-width: min(380px, 92vw);
					background: color-mix(in srgb, var(--color-surface) 94%, transparent);
					backdrop-filter: blur(12px);
					color: var(--color-text);
					font-family: 'Inter', sans-serif;
					font-size: 0.8125rem;
					box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);

					&::backdrop { background: rgba(0, 0, 0, 0.45); }

					@media (prefers-reduced-motion: no-preference) {
						transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
						@starting-style { opacity: 0; transform: scale(0.95) translateY(8px); }
					}

					> .repeat-dialog {
						display: flex;
						flex-direction: column;
						gap: 1rem;

						> header {
							display: flex;
							align-items: center;
							justify-content: space-between;
							gap: 1rem;

							> h3 { margin: 0; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; }
						}

						.every {
							display: flex;
							align-items: center;
							gap: 0.5rem;
							> .interval { inline-size: 4rem; }
							> select { min-inline-size: 6rem; }
						}

						/* Weekday chips (Mo … Su). */
						.weekdays {
							display: flex;
							gap: 0.375rem;
							flex-wrap: wrap;
							> button {
								all: unset;
								box-sizing: border-box;
								inline-size: 2rem;
								block-size: 2rem;
								display: grid;
								place-content: center;
								border-radius: 50%;
								font-size: 0.75rem;
								font-weight: 600;
								cursor: pointer;
								background: color-mix(in srgb, var(--color-text) 8%, transparent);
								color: var(--color-text);
								transition: background 0.15s ease, color 0.15s ease;
								&:hover { background: color-mix(in srgb, var(--color-text) 14%, transparent); }
								&[aria-pressed="true"] { background: var(--color-accent); color: var(--color-accent-text); }
							}
						}

						/* Monthly segmented control (the Nth | the Nth Wd | the last Wd). */
						.monthly {
							display: flex;
							flex-wrap: wrap;
							gap: 0.375rem;
							> button {
								all: unset;
								box-sizing: border-box;
								padding: 0.3rem 0.625rem;
								border-radius: var(--border-radius);
								font-size: 0.75rem;
								font-weight: 500;
								cursor: pointer;
								background: color-mix(in srgb, var(--color-text) 8%, transparent);
								color: var(--color-text);
								transition: background 0.15s ease, color 0.15s ease;
								&:hover { background: color-mix(in srgb, var(--color-text) 14%, transparent); }
								&[aria-pressed="true"] { background: var(--color-accent); color: var(--color-accent-text); }
							}
						}

						.ends {
							display: grid;
							grid-template-columns: auto auto 1fr;
							align-items: center;
							gap: 0.625rem 0.5rem;
							> .ends-label { grid-column: 1 / -1; font-weight: 600; color: var(--color-text-muted); }

							label {
								display: contents;
								/* Radios wear the global input.css convention; only their grid placement is local. */
								> input[type="radio"] { grid-column: 1; justify-self: start; }
								> span { grid-column: 2; }
							}

							input[type="date"], input[type="number"] { grid-column: 3; justify-self: start; }
							input[type="number"] { inline-size: 4rem; }
							.after-times { grid-column: 3; display: inline-flex; align-items: center; gap: 0.5rem; }
						}

						.dialog-actions {
							display: flex;
							justify-content: flex-end;
							gap: 0.5rem;
							margin-block-start: 0.25rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.entry?.start ? html.nothing : html`
			<select class="subtle" @change=${this.handleSelect}>
				<button>
					<selectedcontent></selectedcontent>
				</button>
				${this.menuItems.map(item => html`
					<option value=${item.id} ?selected=${item.checked} class=${item.id === 'custom' ? 'custom' : ''}>
						<span class="name">${item.label}</span>
						${item.detail ? html`<span class="detail">${item.detail}</span>` : html.nothing}
					</option>
				`)}
			</select>
			${this.dialogTemplate}
		`
	}

	private get dialogTemplate() {
		const draft = this.draft
		return html`
			<dialog @cancel=${this.cancelDialog} @click=${(e: Event) => { if (e.target === this.dialog) this.cancelDialog() }}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				${!draft ? html.nothing : html`
					<div class="repeat-dialog">
						<header>
							<h3>${t('Repeat')}</h3>
							<mitra-icon-button icon="x" label=${t('Close')} style="color: var(--color-text-muted)" @click=${this.cancelDialog}></mitra-icon-button>
						</header>
						<div class="every">
							<label>${t('Every')}</label>
							<input class="interval" type="number" min="1" aria-label=${t('Interval')} .value=${String(draft.every)} @change=${this.onInterval}>
							<select .value=${draft.freq} @change=${this.onFreq}>
								<button>
									<selectedcontent></selectedcontent>
								</button>
								${FREQ_OPTIONS.map(option => html`<option value=${option.value}>${freqLabel(option.value, draft.every)}</option>`)}
							</select>
						</div>

						${draft.freq !== 'WEEKLY' ? html.nothing : html`
							<div class="weekdays">
								${WEEKDAY_CODES.map(code => html`
									<button aria-pressed=${draft.byday?.includes(code) ?? false} title=${Recurrence.weekdayLabel(code)} @click=${this.toggleWeekday(code)}>
										${Recurrence.weekdayLabel(code).slice(0, 2)}
									</button>
								`)}
							</div>
						`}

						${draft.freq !== 'MONTHLY' ? html.nothing : html`
							<div class="monthly">
								${this.monthlyOptions.map(option => html`
									<button aria-pressed=${this.monthlyMode === option.key} @click=${this.chooseMonthly(option.key)}>${option.label}</button>
								`)}
							</div>
						`}

						<div class="ends">
							<div class="ends-label">${t('Ends')}</div>
							<label>
								<input type="radio" name="ends-${this.anchor}" .checked=${!draft.until && !draft.count} @change=${this.setEnds('never')}>
								<span>${t('Never')}</span>
							</label>
							<label>
								<input type="radio" name="ends-${this.anchor}" .checked=${!!draft.until} @change=${this.setEnds('until')}>
								<span>${t('On')}</span>
								<input type="date" aria-label=${t('End date')} ?disabled=${!draft.until}
									.value=${this.dateValue(this.draftUntil)} @change=${this.onUntil}>
							</label>
							<label>
								<input type="radio" name="ends-${this.anchor}" .checked=${!!draft.count} @change=${this.setEnds('count')}>
								<span>${t('After')}</span>
								<span class="after-times">
									<input type="number" min="1" aria-label=${t('Occurrences')} ?disabled=${!draft.count}
										.value=${String(this.draftCount)} @change=${this.onCount}>
									${t('times')}
								</span>
							</label>
						</div>

						<div class="dialog-actions">
							<button type="button" class="primary" @click=${this.confirmDialog}>${t('Done')}</button>
						</div>
					</div>
				`}
			</dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-repeat-field': RepeatField
	}
}
