import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { type Entry } from '../../entries/Entry.js'
import { type EntryType } from '../../entries/EntryType.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { enablePushNotifications } from './push.js'
import { type Menu } from '../../../design/Menu.js'

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
export function reminderLabel(minutes: number, type?: EntryType): string {
	if (minutes === 0) {
		return type?.isTask ? t('At the time of the task') : t('At start of event')
	}
	return t('${span} before', { span: reminderSpanLabel(minutes) })
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
		updated(this: RemindersField) { this.menu?.hide(); this.draft = undefined },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	readonly store = new EntryStore(this)

	@state() private draft?: { count: number, unit: CustomUnit }

	protected override createRenderRoot() { return this }

	@query('mitra-menu') private readonly menu?: Menu

	private get reminders(): Array<number> {
		return this.entry.reminders ?? []
	}

	private fireLabel(minutes: number): string {
		const anchor = this.entry.reminderAnchor!
		const fireAt = anchor.subtract({ minutes })
		const sameDay = fireAt.dayStart.valueOf() === anchor.dayStart.valueOf()
		return new Intl.DateTimeFormat(Localizer.languages.current, {
			hour: '2-digit',
			minute: '2-digit',
			...(sameDay ? {} : { weekday: 'short' }),
		}).format(fireAt)
	}

	private commit(reminders: Array<number>) {
		this.entry.setReminders(reminders)
		this.requestUpdate()
		this.change.dispatch()
	}

	private add(minutes: number) {
		const first = !this.reminders.length
		this.commit([...this.reminders, minutes])
		if (first) {
			enablePushNotifications().catch(() => void 0)
		}
	}

	// --- Custom dialog --------------------------------------------------------------------------------

	private readonly openCustomDialog = () => {
		this.draft = { count: 10, unit: 'minutes' }
	}

	private readonly cancelDialog = () => {
		this.draft = undefined
	}

	private readonly confirmDialog = () => {
		if (this.draft) {
			this.add(this.draft.count * UNIT_MINUTES[this.draft.unit])
		}
		this.draft = undefined
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

				> mitra-popover-container > .add {
					grid-column: 2;
					grid-row: 1;
					color: var(--color-text-muted);
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
						margin-block: -0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > mitra-icon-button,
					> mitra-icon-button:focus-within {
						opacity: 1;
					}
				}

				mitra-menu-item.custom {
					color: var(--color-text-muted);
				}

				.custom-reminder {
					display: flex;
					align-items: center;
					gap: 0.5rem;

					> .count { inline-size: 4rem; }
					mitra-select { min-inline-size: 6rem; }
				}
			}
		`
	}

	protected override get template() {
		const editable = getCapabilities(this.entry.sourceId).editEntries
		return !this.entry?.reminderAnchor ? html.nothing : html`
			${!this.reminders.length ? html`
				<span class="placeholder">${t('Reminders')}</span>
			` : this.reminders.map(minutes => html`
				<div class="reminder">
					<span>
						${minutes !== 0
							? html`${reminderSpanLabel(minutes)} <span class="detail">${t('before at ${time}', { time: this.fireLabel(minutes) })}</span>`
							: this.entry.type?.isTask
								? html`${t('At the time of the task')} <span class="detail">${this.fireLabel(0)}</span>`
								: html`${t('At start')} <span class="detail">${t('of event at ${time}', { time: this.fireLabel(minutes) })}</span>`}
					</span>
					${!editable ? html.nothing : html`
						<mitra-icon-button size="small" icon="x" label=${t('Remove reminder')}
							@click=${() => this.commit(this.reminders.filter(other => other !== minutes))}
						></mitra-icon-button>
					`}
				</div>
			`)}
			${!editable ? html.nothing : html`
				<mitra-popover-container>
					<mitra-icon-button size="small" class="add" icon="plus" label=${t('Add reminder')}></mitra-icon-button>
					<mitra-menu slot="popover">
						${RemindersField.presets.filter(minutes => !this.reminders.includes(minutes)).map(minutes => html`
							<mitra-menu-item @click=${() => this.add(minutes)}>${reminderLabel(minutes, this.entry.type)}</mitra-menu-item>
						`)}
						<mitra-menu-item class="custom" @click=${this.openCustomDialog}>${t('Custom…')}</mitra-menu-item>
					</mitra-menu>
				</mitra-popover-container>
			`}
			${this.dialogTemplate}
		`
	}

	private get dialogTemplate() {
		const draft = this.draft
		return html`
			<mitra-dialog heading=${t('Reminder')} primaryButtonText=${t('Done')} .open=${!!draft}
				@openChange=${this.cancelDialog} @primaryAction=${this.confirmDialog}
				@change=${(e: Event) => e.stopPropagation()} @input=${(e: Event) => e.stopPropagation()}>
				${!draft ? html.nothing : html`
					<div class="custom-reminder">
						<mitra-number-field class="count" min="1" aria-label=${t('Amount')} .value=${draft.count}
							@change=${(e: CustomEvent<number>) => this.draft = { ...draft, count: e.detail }}
						></mitra-number-field>
						<mitra-select label=${t('Unit')} .value=${draft.unit} @change=${(e: CustomEvent<CustomUnit>) => this.draft = { ...draft, unit: e.detail }}>
							${(Object.keys(UNIT_MINUTES) as Array<CustomUnit>).map(unit => html`<mitra-option .value=${unit}>${unitLabel(unit)}</mitra-option>`)}
						</mitra-select>
						<span>${t('before')}</span>
					</div>
				`}
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-reminders-field': RemindersField
	}
}
