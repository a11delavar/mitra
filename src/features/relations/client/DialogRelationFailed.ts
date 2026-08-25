import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'

/** Alerts the user when a relationship cannot be saved. */
@component('mitra-dialog-relation-failed')
export class DialogRelationFailed extends DialogComponent<{ readonly message: string }, void> {
	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-relation-failed {
				p {
					margin: 0;
					font-size: 0.875rem;
					color: var(--color-text);
					text-wrap: pretty;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('This relationship could not be saved')} primaryButtonText=${t('Close')} primaryOnEnter>
				<p>${this.parameters.message}</p>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return undefined
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-relation-failed': DialogRelationFailed
	}
}
