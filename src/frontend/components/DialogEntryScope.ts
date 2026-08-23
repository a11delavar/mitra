import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry, type EntryPlan, type RecurrenceScope, ShiftStrategy } from 'shared'

/** One way this gesture could carry to the entries that depend on the moved one, with the plan it
 * would apply — the count on its card, and what the caller writes if it is picked. */
export interface ShiftOption {
	readonly strategy: ShiftStrategy
	readonly plan: EntryPlan
}

/** Scope for edit, move, or delete across the recurrence, hierarchy and dependency axes. */
export interface EntryScope {
	readonly recurrence?: RecurrenceScope
	readonly subtasks: boolean
	/** How the dependents follow. Absent when nothing depends on the entry, or nothing would move. */
	readonly shift?: ShiftStrategy
}

export interface EntryScopeParameters {
	readonly entry: Entry
	readonly intent: 'edit' | 'move' | 'delete'
	/** Ask the recurrence question — the entry is an occurrence of a series. */
	readonly series: boolean
	/** How many entries sit beneath this one; 0 asks no hierarchy question at all. */
	readonly subtasks: number
	/** The DISTINCT outcomes for the entries downstream of this one; fewer than two asks nothing. */
	readonly shifts?: ReadonlyArray<ShiftOption>
}

/**
 * Combined scope dialog for recurring series and hierarchy subtrees. Each axis is a question of its own
 * and gets a screen of its own: picking a card answers it and then either asks the next one or closes.
 */
@component('mitra-dialog-entry-scope')
export class DialogEntryScope extends DialogComponent<EntryScopeParameters, EntryScope | undefined> {
	/** Platform-conventional label for the bypass modifier key. */
	private static get modifier() {
		return navigator.userAgent.includes('Mac') ? '⌘' : t('Ctrl')
	}

	@state() private recurrence: RecurrenceScope = 'this'
	@state() private subtasks = false
	@state() private step = 0

	protected override createRenderRoot() { return this }

	/** The questions this gesture actually raises, in the order they are asked. */
	private get questions() {
		return [
			...this.parameters.series ? ['recurrence' as const] : [],
			...this.parameters.subtasks ? ['subtasks' as const] : [],
			...(this.parameters.shifts?.length ?? 0) > 1 ? ['dependents' as const] : [],
		]
	}

	private get question() { return this.questions[this.step] }

	/** The entry's own glyph, which stands for "this one alone" on both screens. */
	private get entryIcon() { return this.parameters.entry.type.isTask ? 'calendar-check' : 'calendar' }

	private get heading() {
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

	private chooseRecurrence(recurrence: RecurrenceScope) {
		this.recurrence = recurrence
		this.answered()
	}

	private chooseSubtasks(subtasks: boolean) {
		this.subtasks = subtasks
		this.answered()
	}

	private chooseShift(shift: ShiftStrategy) {
		// The narrow answer is the absence of one, so a caller never has to know the vocabulary to skip it.
		this.close({ ...this.answer, shift: shift === ShiftStrategy.None ? undefined : shift })
	}

	private get answer(): EntryScope {
		return { recurrence: this.parameters.series ? this.recurrence : undefined, subtasks: this.subtasks }
	}

	/** On to the next question, or out with what has been answered so far. */
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
				/* One width for every question, so answering the first one doesn't resize the dialog. */
				--mitra-dialog-width: min(28rem, 92vw);

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
				${this.question === 'dependents' ? this.dependentsChoices : this.question === 'subtasks' ? this.subtasksChoices : this.recurrenceChoices}
				${this.step > 0 ? html.nothing : html`
					<p class="hint">${t('Tip: hold ${modifier} to skip this dialog and apply to this entry only', { modifier: DialogEntryScope.modifier })}</p>
				`}
			</mitra-dialog>
		`
	}

	/** On the series' first occurrence "this and following" IS the whole series, so it isn't offered. */
	private get recurrenceChoices() {
		return html`
			<mitra-choices>
				<mitra-choice autofocus icon=${this.entryIcon} @click=${() => this.chooseRecurrence('this')}>${t('This entry')}</mitra-choice>
				${this.parameters.entry.isSeriesStart ? html.nothing : html`
					<mitra-choice icon="chevrons-right" @click=${() => this.chooseRecurrence('following')}>${t('This and following entries')}</mitra-choice>
				`}
				<mitra-choice icon="repeat" @click=${() => this.chooseRecurrence('all')}>${t('All entries')}</mitra-choice>
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
