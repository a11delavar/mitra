import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry, type RecurrenceScope } from 'shared'

/** Scope for edit, move, or delete across recurrence and hierarchy axes. */
export interface EntryScope {
	readonly recurrence?: RecurrenceScope
	readonly subtasks: boolean
}

export interface EntryScopeParameters {
	readonly entry: Entry
	readonly intent: 'edit' | 'move' | 'delete'
	/** Ask the recurrence question — the entry is an occurrence of a series. */
	readonly series: boolean
	/** How many entries sit beneath this one; 0 asks no hierarchy question at all. */
	readonly subtasks: number
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
	@state() private step = 0

	protected override createRenderRoot() { return this }

	/** The questions this gesture actually raises, in the order they are asked. */
	private get questions() {
		return [
			...this.parameters.series ? ['recurrence' as const] : [],
			...this.parameters.subtasks ? ['subtasks' as const] : [],
		]
	}

	private get question() { return this.questions[this.step] }

	/** The entry's own glyph, which stands for "this one alone" on both screens. */
	private get entryIcon() { return this.parameters.entry.type.isTask ? 'calendar-check' : 'calendar' }

	private get heading() {
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
		if (this.questions.length > 1) {
			this.step++
		} else {
			this.close({ recurrence, subtasks: false })
		}
	}

	private chooseSubtasks(subtasks: boolean) {
		this.close({ recurrence: this.parameters.series ? this.recurrence : undefined, subtasks })
	}

	static override get styles() {
		return css`
			mitra-dialog-entry-scope {
				/* One width for every question, so answering the first one doesn't resize the dialog. */
				--mitra-dialog-width: min(28rem, 92vw);

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
				${this.question === 'subtasks' ? this.subtasksChoices : this.recurrenceChoices}
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
