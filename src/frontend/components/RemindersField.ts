import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { type Entry } from 'shared'
import { enablePushNotifications } from '../push.js'

type CustomUnit = 'minutes' | 'hours' | 'days' | 'weeks'

const UNIT_MINUTES: Record<CustomUnit, number> = { minutes: 1, hours: 60, days: 24 * 60, weeks: 7 * 24 * 60 }

// The unit words for the custom dialog's select. Static t() per case so the scanner sees each key.
function unitLabel(unit: CustomUnit): string {
	switch (unit) {
		case 'minutes': return t('minutes')
		case 'hours': return t('hours')
		case 'days': return t('days')
		case 'weeks': return t('weeks')
	}
}

/** "30 min", "1 hour", "2 days" — the span part of a reminder's label. English for now; the single
 * seam where localized wording plugs in later (mirrors the backend's own reminderSpan). */
function reminderSpanLabel(minutes: number): string {
	const unit = ([['week', UNIT_MINUTES.weeks], ['day', UNIT_MINUTES.days], ['hour', UNIT_MINUTES.hours]] as const)
		.find(([, factor]) => minutes >= factor && minutes % factor === 0)
	if (!unit) {
		return t('${count:number} min', { count: minutes })
	}
	const count = minutes / unit[1]
	switch (unit[0]) {
		case 'week': return t('${count:pluralityNumber} weeks', { count })
		case 'day': return t('${count:pluralityNumber} days', { count })
		case 'hour': return t('${count:pluralityNumber} hours', { count })
	}
}

/** The full one-line label, for the preset menu. */
function reminderLabel(minutes: number): string {
	return minutes === 0 ? t('At start of event') : t('${span} before', { span: reminderSpanLabel(minutes) })
}

/**
 * The "Reminders" control for the entry editor — simplicity with control: a muted
 * placeholder (or the list of active reminders, each removable) plus an anchored preset menu whose
 * last item opens the full custom editor (any count of minutes/hours/days/weeks before). Reminders are
 * MINUTES BEFORE START on the entry (see Entry.reminders), multiple allowed, deduplicated, ascending.
 *
 * Adding the FIRST reminder is the contextual moment to ask for notification permission and register
 * the push subscription — the ask appears exactly when the user expresses they want to be notified.
 *
 * Mutates `entry.reminders` in place and fires `change`; the host persists.
 */
@component('mitra-reminders-field')
export class RemindersField extends Component {
	// Per-instance anchor token so two open editors' menus never collide.
	private static count = 0
	private readonly anchor = `--reminders-${RemindersField.count++}`

	private static readonly presets = [0, 5, 10, 30, 60, 24 * 60]

	@property({
		type: Object,
		// The popover got reused for another entry: close the menu/dialog opened for the previous one.
		updated(this: RemindersField) { this.menu?.hidePopover(); this.dialog?.close(); this.draft = undefined },
	}) entry!: Entry

	/** Fired after `entry.reminders` is mutated, so the host can persist. */
	@event() readonly change!: EventDispatcher

	/** The custom dialog's working state; absent when the dialog is closed. */
	@state() private draft?: { count: number, unit: CustomUnit }

	protected override createRenderRoot() { return this }

	private get menu() { return this.querySelector<HTMLElement>('menu[popover]') }
	private get dialog() { return this.querySelector('dialog') }

	private get reminders(): Array<number> {
		return this.entry.reminders ?? []
	}

	/** When this reminder will actually notify — "at 14:24", with the day when it isn't the event's
	 * own (a "1 day before" fires yesterday). */
	private fireLabel(minutes: number): string {
		const fireAt = this.entry.start!.subtract({ minutes })
		const sameDay = fireAt.dayStart.valueOf() === this.entry.start!.dayStart.valueOf()
		return new Intl.DateTimeFormat(Localizer.languages.current, {
			hour: '2-digit',
			minute: '2-digit',
			...(sameDay ? {} : { weekday: 'short' }),
		}).format(fireAt)
	}

	private commit(reminders: Array<number>) {
		// `null`, not undefined, for "none": the wire's tri-state needs an explicit clear, and the
		// hydrated canonical is null too — one value, no phantom dirt.
		this.entry.reminders = reminders.length ? [...new Set(reminders)].sort((a, b) => a - b) : null
		this.requestUpdate()
		this.change.dispatch()
	}

	private add(minutes: number) {
		const first = !this.reminders.length
		this.commit([...this.reminders, minutes])
		this.menu?.hidePopover()
		if (first) {
			// The user just asked to be notified — the one moment the permission prompt is expected.
			// A denial only mutes THIS browser; the reminder persists (and other CalDAV clients alert).
			enablePushNotifications().catch(() => void 0)
		}
	}

	private readonly toggleMenu = () => {
		this.menu?.togglePopover()
	}

	// --- Custom dialog --------------------------------------------------------------------------------

	private readonly openCustomDialog = () => {
		this.menu?.hidePopover()
		this.draft = { count: 10, unit: 'minutes' }
		this.updateComplete.then(() => this.dialog?.showModal())
	}

	private readonly cancelDialog = () => {
		this.dialog?.close()
		this.draft = undefined
	}

	private readonly confirmDialog = () => {
		if (this.draft) {
			this.add(this.draft.count * UNIT_MINUTES[this.draft.unit])
		}
		this.dialog?.close()
		this.draft = undefined
	}

	protected override updated() {
		// The dialog's unit select suffers the value-before-options timing on its first render.
		const unit = this.querySelector<HTMLSelectElement>('dialog select')
		if (unit && this.draft) {
			unit.value = this.draft.unit
		}
	}

	static override get styles() {
		return css`
			mitra-reminders-field {
				grid-column: 2;
				min-width: 0;
				display: flex;
				flex-direction: column;
				align-items: start;
				gap: 0.125rem;

				/* The subtle-field box (margin/padding pair) stretched over the whole row, so the buttons
				   line up with — and click like — the other full-width fields. The full-width anchor is
				   also what places the preset menu beside the popover, like the source/repeat pickers. */
				> .empty, > .add {
					all: unset;
					box-sizing: border-box;
					align-self: stretch;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;
					cursor: pointer;
					color: var(--color-text-muted);

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}
				}

				> .add {
					font-size: 0.6875rem;
				}

				> .reminder {
					align-self: stretch;
					display: flex;
					align-items: center;
					gap: 0.25rem;
					/* The same subtle box as the sibling buttons, so every row shares one left edge. */
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
					}

					> span {
						flex: 1;
						min-width: 0;

						> .detail {
							color: var(--color-text-muted);
						}
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
						font-size: 0.8rem;
						/* Swallow the button's own padding so the row stays text-height — otherwise the
						   first row's label sits lower than the gutter bell. */
						margin-block: -0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > mitra-icon-button,
					> mitra-icon-button:focus-visible {
						opacity: 1;
					}
				}

				/* The preset menu wears the popover's tinted glass and opens beside the row — the same
				   strategy as the source/repeat pickers. */
				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					> button.custom {
						color: var(--color-text-muted);
					}
				}

				/* --- Custom dialog (the RepeatField dialog's look) ---------------------------------------- */
				dialog {
					margin: auto;
					border: var(--border);
					border-radius: 14px;
					padding: 1.25rem;
					min-width: 280px;
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

					> .reminder-dialog {
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

						> .before {
							display: flex;
							align-items: center;
							gap: 0.5rem;
							> .count { inline-size: 4rem; }
							> select { min-inline-size: 6rem; }
						}

						> .dialog-actions {
							display: flex;
							justify-content: flex-end;
							gap: 0.5rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.entry?.start ? html.nothing : html`
			${!this.reminders.length ? html`
				<button type="button" class="empty" style="anchor-name: ${this.anchor}" @click=${this.toggleMenu}>${t('Reminders')}</button>
			` : html`
				${this.reminders.map(minutes => html`
					<div class="reminder">
						<span>
							${minutes === 0
								? html`${t('At start')} <span class="detail">${t('of event at ${time}', { time: this.fireLabel(minutes) })}</span>`
								: html`${reminderSpanLabel(minutes)} <span class="detail">${t('before at ${time}', { time: this.fireLabel(minutes) })}</span>`}
						</span>
						<mitra-icon-button icon="x" label=${t('Remove reminder')}
							@click=${() => this.commit(this.reminders.filter(other => other !== minutes))}
						></mitra-icon-button>
					</div>
				`)}
				<button type="button" class="add" style="anchor-name: ${this.anchor}" @click=${this.toggleMenu}>${t('Add reminder')}</button>
			`}
			<menu popover style="position-anchor: ${this.anchor}">
				${RemindersField.presets.filter(minutes => !this.reminders.includes(minutes)).map(minutes => html`
					<button type="button" @click=${() => this.add(minutes)}>${reminderLabel(minutes)}</button>
				`)}
				<button type="button" class="custom" @click=${this.openCustomDialog}>${t('Custom…')}</button>
			</menu>
			${this.dialogTemplate}
		`
	}

	private get dialogTemplate() {
		const draft = this.draft
		return html`
			<dialog @cancel=${this.cancelDialog} @click=${(e: Event) => { if (e.target === this.dialog) this.cancelDialog() }}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				${!draft ? html.nothing : html`
					<div class="reminder-dialog">
						<header>
							<h3>${t('Reminder')}</h3>
							<mitra-icon-button icon="x" label=${t('Close')} style="color: var(--color-text-muted)" @click=${this.cancelDialog}></mitra-icon-button>
						</header>
						<div class="before">
							<input class="count" type="number" min="1" aria-label=${t('Amount')} .value=${String(draft.count)}
								@change=${(e: Event) => this.draft = { ...draft, count: Math.max(1, Math.trunc(Number((e.target as HTMLInputElement).value)) || 1) }}>
							<select @change=${(e: Event) => this.draft = { ...draft, unit: (e.target as HTMLSelectElement).value as CustomUnit }}>
								<button>
									<selectedcontent></selectedcontent>
								</button>
								${(Object.keys(UNIT_MINUTES) as Array<CustomUnit>).map(unit => html`<option value=${unit}>${unitLabel(unit)}</option>`)}
							</select>
							<span>${t('before')}</span>
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
		'mitra-reminders-field': RemindersField
	}
}
