import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry } from 'shared'

/** Dialog prompting whether to mark a parent task completed when its final subtask finishes. */
@component('mitra-dialog-complete-parent')
export class DialogCompleteParent extends DialogComponent<{ readonly parent: Entry }, boolean | undefined> {
	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-complete-parent {
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
			<mitra-dialog heading=${t('All subtasks done')} primaryButtonText=${t('Mark as done')} primaryOnEnter>
				<p>${t('Every subtask of "${heading}" is done. Mark it as done too?', { heading: this.parameters.parent.heading })}</p>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return true
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-complete-parent': DialogCompleteParent
	}
}
