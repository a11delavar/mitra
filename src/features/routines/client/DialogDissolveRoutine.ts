import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'

/** Asks whether a routine is none after all: its entries leave it, and their title never gathers into one again. */
@component('mitra-dialog-dissolve-routine')
export class DialogDissolveRoutine extends DialogComponent<{ readonly name: string }, boolean> {
	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-dissolve-routine p {
				margin: 0;
				font-size: 0.875rem;
				color: var(--color-text);
				text-wrap: pretty;
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Not a routine?')}>
				<p>${t('"${name}" leaves the Routines tab, and entries with its title are no longer gathered into a routine. Its entries stay on your calendar.', { name: this.parameters.name })}</p>
				<mitra-choices>
					<mitra-choice autofocus icon="repeat" @click=${() => this.close(false)}>${t('Keep it')}</mitra-choice>
					<mitra-choice icon="circle-off" @click=${() => this.close(true)}>${t('Not a routine')}</mitra-choice>
				</mitra-choices>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-dissolve-routine': DialogDissolveRoutine
	}
}
