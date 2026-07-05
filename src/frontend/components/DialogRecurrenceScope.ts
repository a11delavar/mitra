import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry, type RecurrenceScope } from 'shared'

/**
 * The scope chooser for edits and deletes of a recurring occurrence: this entry only (detaching it from
 * the series), this and all following entries (splitting the series in two), or every entry of the
 * series. Confirms with the chosen scope; cancelling resolves `undefined` — the store then reverts the
 * edit or skips the delete.
 */
@component('mitra-dialog-recurrence-scope')
export class DialogRecurrenceScope extends DialogComponent<{ readonly entry: Entry, readonly intent: 'edit' | 'delete' }, RecurrenceScope | undefined> {
	private static readonly options: ReadonlyArray<{ scope: RecurrenceScope, label: string }> = [
		{ scope: 'this', label: 'This entry' },
		{ scope: 'following', label: 'This and following entries' },
		{ scope: 'all', label: 'All entries' },
	]

	@state() private scope: RecurrenceScope = 'this'

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-recurrence-scope {
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
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading="${this.parameters.intent === 'delete' ? 'Delete' : 'Edit'} repeating entry" primaryButtonText="OK" primaryOnEnter>
				<div class="scopes">
					${DialogRecurrenceScope.options.map(option => html`
						<label>
							<input type="radio" name="recurrence-scope" .checked=${this.scope === option.scope}
								@change=${() => this.scope = option.scope}>
							<span>${option.label}</span>
						</label>
					`)}
				</div>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return this.scope
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-recurrence-scope': DialogRecurrenceScope
	}
}
