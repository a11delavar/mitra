import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'

/** Asks before a batch of entries goes: unlike the one open in its editor, none of them is in view. `series` counts those standing for a whole series. */
@component('mitra-dialog-delete-entries')
export class DialogDeleteEntries extends DialogComponent<{ readonly count: number, readonly series?: number }, boolean> {
	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-delete-entries {
				--mitra-dialog-width: min(24rem, 92vw);

				p {
					margin: 0 0 1rem;
					color: var(--color-text-muted);
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Delete ${count:pluralityNumber} entries?', { count: this.parameters.count })}>
				${!this.parameters.series ? html.nothing : html`
					<p>${t('${count:pluralityNumber} repeating entries: every occurrence goes too.', { count: this.parameters.series })}</p>
				`}
				<mitra-choices>
					<mitra-choice autofocus icon="trash-2" @click=${() => this.close(true)}>${t('Delete')}</mitra-choice>
					<mitra-choice icon="x" @click=${() => this.close(false)}>${t('Keep')}</mitra-choice>
				</mitra-choices>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-delete-entries': DialogDeleteEntries
	}
}
