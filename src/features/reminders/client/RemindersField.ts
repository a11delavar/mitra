import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { type Entry } from '../../entries/Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { enablePushNotifications } from './push.js'

type CustomUnit = 'minutes' | 'hours' | 'days' | 'weeks'

const UNIT_MINUTES: Record<CustomUnit, number> = { minutes: 1, hours: 60, days: 24 * 60, weeks: 7 * 24 * 60 }

function unitLabel(unit: CustomUnit): string {
	switch (unit) {
		case 'minutes': return t('minutes')
		case 'hours': return t('hours')
		case 'days': return t('days')
		case 'weeks': return t('weeks')
	}
}

/** Formats minute duration into localized span text (e.g. "30 min", "1 hour", "2 days"). */
export function reminderSpanLabel(minutes: number): string {
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

/** Formats full reminder label for menus and settings. */
export function reminderLabel(minutes: number): string {
	return minutes === 0 ? t('At start of event') : t('${span} before', { span: reminderSpanLabel(minutes) })
}

/**
 * Entry editor reminders field supporting preset list and custom duration dialog.
 * Prompts for notification permission on first added reminder.
 */
@component('mitra-reminders-field')
export class RemindersField extends Component {
	private static readonly presets = [0, 5, 10, 30, 60, 24 * 60]

	@property({
		type: Object,
		updated(this: RemindersField) { this.menu?.hidePopover(); this.dialog?.close(); this.draft = undefined },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() private draft?: { count: number, unit: CustomUnit }

	protected override createRenderRoot() { return this }

	@query('menu[popover]') private readonly menu?: HTMLElement
	@query('dialog') private readonly dialog?: HTMLDialogElement
	@query('dialog select') private readonly unitSelect?: HTMLSelectElement

	private get reminders(): Array<number> {
		return this.entry.reminders ?? []
	}

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
		this.entry.reminders = reminders.length ? [...new Set(reminders)].sort((a, b) => a - b) : null
		this.requestUpdate()
		this.change.dispatch()
	}

	private add(minutes: number) {
		const first = !this.reminders.length
		this.commit([...this.reminders, minutes])
		this.menu?.hidePopover()
		if (first) {
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
		if (this.unitSelect && this.draft) {
			this.unitSelect.value = this.draft.unit
		}
	}

	static override get styles() {
		return css`
			mitra-reminders-field {
				grid-column: 2;
				min-width: 0;
				/* The reminders stack in the first column; the add button holds the END of the first line,
				   so it stays put as the list below it grows. */
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				align-items: center;
				row-gap: 0.125rem;
				padding-block: 0.25rem;

				> :is(.placeholder, .reminder) { grid-column: 1; }

				> .add {
					grid-column: 2;
					grid-row: 1;
					color: var(--color-text-muted);
					font-size: 0.8rem;
					/* Swallow the button's own padding so it never stretches the row past a line's height. */
					margin-block: -0.25rem;
				}

				> .reminder {
					display: flex;
					align-items: center;
					gap: 0.25rem;

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
						margin-block: -0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > mitra-icon-button,
					> mitra-icon-button:focus-visible {
						opacity: 1;
					}
				}

				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					background: var(--mitra-entry-surface);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;

					> button.custom {
						color: var(--color-text-muted);
					}
				}

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
		const editable = getCapabilities(this.entry.sourceId).editEntries
		return !this.entry?.start ? html.nothing : html`
			${!this.reminders.length ? html`
				<span class="placeholder">${t('Reminders')}</span>
			` : this.reminders.map(minutes => html`
				<div class="reminder">
					<span>
						${minutes === 0
							? html`${t('At start')} <span class="detail">${t('of event at ${time}', { time: this.fireLabel(minutes) })}</span>`
							: html`${reminderSpanLabel(minutes)} <span class="detail">${t('before at ${time}', { time: this.fireLabel(minutes) })}</span>`}
					</span>
					${!editable ? html.nothing : html`
						<mitra-icon-button icon="x" label=${t('Remove reminder')}
							@click=${() => this.commit(this.reminders.filter(other => other !== minutes))}
						></mitra-icon-button>
					`}
				</div>
			`)}
			${!editable ? html.nothing : html`
				<mitra-icon-button class="add" icon="plus" label=${t('Add reminder')} @click=${this.toggleMenu}></mitra-icon-button>
			`}
			<menu popover>
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
