import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry } from '../../entries/Entry.js'

/**
 * Prompts whether to mark completed parent tasks when their final subtasks finish.
 * Multi-level chains are batched into a single prompt. `parents` is ordered deepest-first.
 */
@component('mitra-dialog-complete-parent')
export class DialogCompleteParent extends DialogComponent<{ readonly parents: ReadonlyArray<Entry> }, boolean | undefined> {
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

	private get nearest() { return this.parameters.parents[0]! }
	private get above() { return this.parameters.parents.length - 1 }

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('All subtasks done')} primaryButtonText=${this.above ? t('Mark all as done') : t('Mark as done')} primaryOnEnter>
				<p>${this.above
					? t('Every subtask of "${heading}" is done, which completes ${count:pluralityNumber} more tasks above it. Mark them all as done?', { heading: this.nearest.heading, count: this.above })
					: t('Every subtask of "${heading}" is done. Mark it as done too?', { heading: this.nearest.heading })
					}</p>
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
