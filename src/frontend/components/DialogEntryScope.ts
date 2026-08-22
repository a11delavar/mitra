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

/** Combined scope dialog for recurring series and hierarchy subtrees. */
@component('mitra-dialog-entry-scope')
export class DialogEntryScope extends DialogComponent<EntryScopeParameters, EntryScope | undefined> {
	private static get options(): ReadonlyArray<{ scope: RecurrenceScope, label: string }> {
		return [
			{ scope: 'this', label: t('This entry') },
			{ scope: 'following', label: t('This and following entries') },
			{ scope: 'all', label: t('All entries') },
		]
	}

	/** Platform-conventional label for the bypass modifier key. */
	private static get modifier() {
		return navigator.userAgent.includes('Mac') ? '⌘' : t('Ctrl')
	}

	@state() private scope: RecurrenceScope = 'this'
	@state() private subtasks = false

	protected override createRenderRoot() { return this }

	private get heading() {
		switch (this.parameters.intent) {
			case 'delete':
				return this.parameters.series ? t('Delete repeating entry') : t('Delete entry')
			case 'move':
				return this.parameters.series ? t('Move repeating entry') : t('Move entry')
			default:
				return this.parameters.series ? t('Edit repeating entry') : t('Edit entry')
		}
	}

	private get subtaskLabel() {
		const count = this.parameters.subtasks
		switch (this.parameters.intent) {
			case 'delete':
				return t('Also delete its ${count:pluralityNumber} subtasks', { count })
			case 'move':
				return t('Also move its ${count:pluralityNumber} subtasks by the same amount', { count })
			default:
				return t('Apply to its ${count:pluralityNumber} subtasks too', { count })
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-entry-scope {
				.scopes {
					display: flex;
					flex-direction: column;
					gap: 0.75rem;

					label {
						display: flex;
						align-items: center;
						gap: 0.625rem;
						font-size: 0.875rem;
						color: var(--color-text);
						cursor: pointer;
					}
				}

				.subtasks {
					margin-block-start: 0.75rem;

					&:not(:first-child) {
						padding-block-start: 0.75rem;
						border-block-start: 1px solid var(--color-border);
					}
				}

				.hint {
					margin-block: 1rem 0;
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
			<mitra-dialog heading=${this.heading} primaryButtonText=${t('OK')} primaryOnEnter>
				${!this.parameters.series ? html.nothing : html`
					<div class="scopes">
						${DialogEntryScope.options.map(option => html`
							<label>
								<input type="radio" name="recurrence-scope" .checked=${this.scope === option.scope}
									@change=${() => this.scope = option.scope}>
								<span>${option.label}</span>
							</label>
						`)}
					</div>
				`}
				${!this.parameters.subtasks ? html.nothing : html`
					<div class="scopes subtasks">
						<label>
							<input type="checkbox" .checked=${this.subtasks}
								@change=${(e: Event) => this.subtasks = (e.target as HTMLInputElement).checked}>
							<span>${this.subtaskLabel}</span>
						</label>
					</div>
				`}
				<p class="hint">${t('Tip: hold ${modifier} to skip this dialog and apply to this entry only', { modifier: DialogEntryScope.modifier })}</p>
			</mitra-dialog>
		`
	}

	protected override primaryAction(): EntryScope {
		return { recurrence: this.parameters.series ? this.scope : undefined, subtasks: this.subtasks }
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-entry-scope': DialogEntryScope
	}
}
