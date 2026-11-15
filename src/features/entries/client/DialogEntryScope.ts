import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { ShiftStrategy, type EntryPlan } from '#features/relations'
import { EntryOccurrenceChangeScope } from '#features/recurrence'
import { type Entry } from '../Entry.js'
import { EntryStatus } from '../EntryStatus.js'
import { EntryStore } from './EntryStore.js'

export interface ShiftOption {
	readonly strategy: ShiftStrategy
	readonly plan: EntryPlan
}

/** Scope for edit, move, or delete across recurrence, hierarchy, and dependency axes. */
export interface EntryScope {
	readonly recurrence?: EntryOccurrenceChangeScope
	readonly subtasks: boolean
	readonly shift?: ShiftStrategy
	/** A deletion turned into cancelling this date alone, which a routine counts as not kept rather than forgets. */
	readonly cancel?: boolean
}

export interface EntryScopeParameters {
	readonly entry: Entry
	readonly intent: 'edit' | 'move' | 'delete'
	readonly series: boolean
	readonly subtasks: number
	readonly shifts?: ReadonlyArray<ShiftOption>
	/** Whether a deletion may cancel the date instead: an entry of a routine, on a calendar that keeps Cancelled. */
	readonly cancels?: boolean
}

/**
 * Scope dialog for recurring series, subtasks, and dependent shifts.
 */
@component('mitra-dialog-entry-scope')
export class DialogEntryScope extends DialogComponent<EntryScopeParameters, EntryScope | undefined> {
	private static get modifier() {
		return navigator.userAgent.includes('Mac') ? '⌘' : t('Ctrl')
	}

	@state() private recurrence = EntryOccurrenceChangeScope.This
	@state() private subtasks = false
	@state() private step = 0

	protected override createRenderRoot() { return this }

	protected override cancellationAction() {
		return undefined
	}

	private get questions() {
		return [
			...this.parameters.cancels && !this.parameters.series ? ['cancel' as const] : [],
			...this.parameters.series ? ['recurrence' as const] : [],
			...this.parameters.subtasks ? ['subtasks' as const] : [],
			...(this.parameters.shifts?.length ?? 0) > 1 ? ['dependents' as const] : [],
		]
	}

	private get question() { return this.questions[this.step] }

	private get entryIcon() { return this.parameters.entry.type.isTask ? 'calendar-check' : 'calendar' }

	private get heading() {
		if (this.question === 'cancel') {
			return t('Cancel or delete?')
		}
		if (this.question === 'dependents') {
			return t('Move dependent entries too?')
		}
		if (this.question === 'subtasks') {
			switch (this.parameters.intent) {
				case 'delete': return t('Delete subtasks too?')
				case 'move': return t('Move subtasks too?')
				default: return t('Apply to subtasks too?')
			}
		}
		switch (this.parameters.intent) {
			case 'delete':
				return this.parameters.series ? t('Delete repeating entry') : t('Delete entry')
			case 'move':
				return this.parameters.series ? t('Move repeating entry') : t('Move entry')
			default:
				return this.parameters.series ? t('Edit repeating entry') : t('Edit entry')
		}
	}

	private chooseRecurrence(recurrence: EntryOccurrenceChangeScope) {
		this.recurrence = recurrence
		this.answered()
	}

	private cancel() {
		this.close({ recurrence: this.parameters.series ? EntryOccurrenceChangeScope.This : undefined, subtasks: false, cancel: true })
	}

	private chooseSubtasks(subtasks: boolean) {
		this.subtasks = subtasks
		this.answered()
	}

	private chooseShift(shift: ShiftStrategy) {
		this.close({ ...this.answer, shift: shift === ShiftStrategy.None ? undefined : shift })
	}

	private get answer(): EntryScope {
		return { recurrence: this.parameters.series ? this.recurrence : undefined, subtasks: this.subtasks }
	}

	private answered() {
		if (this.step < this.questions.length - 1) {
			this.step++
		} else {
			this.close(this.answer)
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-entry-scope {
				--mitra-dialog-width: min(28rem, 92vw);

				/* Beside the scopes it is no scope of its own, so it takes a row of its own under them. */
				.recurrence > .cancel {
					flex-basis: 100%;
				}

				.count {
					display: block;
					margin-block-start: 0.125rem;
					font-weight: 400;
					color: var(--color-text-muted);
				}

				.hint {
					margin: 0;
					font-size: 0.75rem;
					color: var(--color-text-muted);
					text-wrap: balance;
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
		return html`
			<mitra-dialog heading=${this.heading}>
				${this.step === 0 ? html.nothing : html`
					<mitra-icon-button slot="leading" icon="arrow-left" label=${t('Back')}
						@click=${() => this.step--}
					></mitra-icon-button>
				`}
				${this.question === 'cancel' ? this.cancelChoices : this.question === 'dependents' ? this.dependentsChoices : this.question === 'subtasks' ? this.subtasksChoices : this.recurrenceChoices}
				${this.step > 0 ? html.nothing : html`
					<p class="hint">${t('Tip: hold ${modifier} to skip this dialog and apply to this entry only', { modifier: DialogEntryScope.modifier })}</p>
				`}
			</mitra-dialog>
		`
	}

	/** Cancelling reaches this date alone, so it is one choice beside the deletion, never a scope of its own. */
	private get cancelChoice() {
		return !this.parameters.cancels ? html.nothing : html`
			<mitra-choice class="cancel" icon=${EntryStatus.Cancelled.iconFor(this.parameters.entry.type)} @click=${() => this.cancel()}>
				<span>${t('Mark it cancelled')}<span class="count">${t('Its routine counts it as not kept')}</span></span>
			</mitra-choice>
		`
	}

	private get cancelChoices() {
		return html`
			<mitra-choices>
				${this.cancelChoice}
				<mitra-choice autofocus icon="trash-2" @click=${() => this.answered()}>${t('Delete')}</mitra-choice>
			</mitra-choices>
		`
	}

	private get recurrenceChoices() {
		return html`
			<mitra-choices class="recurrence">
				<mitra-choice autofocus icon=${this.entryIcon} @click=${() => this.chooseRecurrence(EntryOccurrenceChangeScope.This)}>${t('This entry')}</mitra-choice>
				${EntryStore.occurrenceOf(this.parameters.entry).first ? html.nothing : html`
					<mitra-choice icon="chevrons-right" @click=${() => this.chooseRecurrence(EntryOccurrenceChangeScope.Following)}>${t('This and following entries')}</mitra-choice>
				`}
				<mitra-choice icon="repeat" @click=${() => this.chooseRecurrence(EntryOccurrenceChangeScope.All)}>${t('All entries')}</mitra-choice>
				${this.parameters.intent === 'delete' ? this.cancelChoice : html.nothing}
			</mitra-choices>
		`
	}

	/** Renders choice cards for distinct shift outcomes. */
	private get dependentsChoices() {
		const options = this.parameters.shifts ?? []
		const preferred = options.find(option => option.strategy === ShiftStrategy.Minimum) ?? options[0]
		return html`
			<mitra-choices>
				${options.map(option => html`
					<mitra-choice
						?autofocus=${option === preferred}
						icon=${option.strategy === ShiftStrategy.None ? this.entryIcon : option.strategy.icon}
						@click=${() => this.chooseShift(option.strategy)}
					>
						${option.strategy.format()}
						${!option.plan.count ? html.nothing : html`<span class="count">${t('${count:pluralityNumber} entries', { count: option.plan.count })}</span>`}
					</mitra-choice>
				`)}
			</mitra-choices>
		`
	}

	private get subtasksChoices() {
		const count = this.parameters.subtasks
		return html`
			<mitra-choices>
				<mitra-choice autofocus icon=${this.entryIcon} @click=${() => this.chooseSubtasks(false)}>${t('Only this entry')}</mitra-choice>
				<mitra-choice icon="list-tree" @click=${() => this.chooseSubtasks(true)}>${t('This and its ${count:pluralityNumber} subtasks', { count })}</mitra-choice>
			</mitra-choices>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-entry-scope': DialogEntryScope
	}
}
