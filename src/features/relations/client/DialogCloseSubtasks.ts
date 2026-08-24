import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry, TaskStatus } from '../../entries/Entry.js'
import { taskStatusIcon } from '../../entries/client/TaskStatus.js'

/** What to do with the leftovers; `undefined` (cancelling the dialog) leaves them exactly as they are. */
export type SubtaskClosure = TaskStatus.Done | TaskStatus.Cancelled

/**
 * Prompts whether to mark remaining open subtasks as Done or Cancelled when their parent task is closed.
 * Dismissing leaves subtasks untouched (RFC 5545 allows open subtasks under a completed parent).
 */
@component('mitra-dialog-close-subtasks')
export class DialogCloseSubtasks extends DialogComponent<{ readonly entry: Entry, readonly outstanding: number }, SubtaskClosure | undefined> {
	protected override createRenderRoot() { return this }

	/** The parent's own closed state leads, since it is the likelier answer — and leading means it is
	 * the card that takes focus, not a preselected radio. */
	private get options(): ReadonlyArray<SubtaskClosure> {
		return this.parameters.entry.status === TaskStatus.Cancelled
			? [TaskStatus.Cancelled, TaskStatus.Done]
			: [TaskStatus.Done, TaskStatus.Cancelled]
	}

	private label(closure: SubtaskClosure) {
		return closure === TaskStatus.Done ? t('Mark as done') : t('Mark as cancelled')
	}

	static override get styles() {
		return css`
			mitra-dialog-close-subtasks {
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
			<mitra-dialog heading=${t('Subtasks still open')}>
				<p>${t('"${heading}" is closed, but ${count:pluralityNumber} of its subtasks are still open.', {
					heading: this.parameters.entry.heading,
					count: this.parameters.outstanding,
				})}</p>
				<mitra-choices>
					${this.options.map((closure, index) => html`
						<mitra-choice ?autofocus=${index === 0} icon=${taskStatusIcon.get(closure)!} @click=${() => this.close(closure)}>${this.label(closure)}</mitra-choice>
					`)}
				</mitra-choices>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-close-subtasks': DialogCloseSubtasks
	}
}
