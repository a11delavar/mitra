import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Entry, TaskStatus } from 'shared'

/** What to do with the leftovers; `undefined` (cancelling the dialog) leaves them exactly as they are. */
export type SubtaskClosure = TaskStatus.Done | TaskStatus.Cancelled

/**
 * Prompts whether to mark remaining open subtasks as Done or Cancelled when their parent task is closed.
 * Dismissing leaves subtasks untouched (RFC 5545 allows open subtasks under a completed parent).
 */
@component('mitra-dialog-close-subtasks')
export class DialogCloseSubtasks extends DialogComponent<{ readonly entry: Entry, readonly outstanding: number }, SubtaskClosure | undefined> {
	/** Defaults to the parent's closed state (Done or Cancelled). */
	@state() private closure: SubtaskClosure = TaskStatus.Cancelled

	protected override createRenderRoot() { return this }

	override connected() {
		this.closure = this.parameters.entry.status === TaskStatus.Cancelled ? TaskStatus.Cancelled : TaskStatus.Done
	}

	private get options(): ReadonlyArray<{ closure: SubtaskClosure, label: string }> {
		const count = this.parameters.outstanding
		return [
			{ closure: TaskStatus.Done, label: t('Mark the ${count:pluralityNumber} remaining subtasks as done', { count }) },
			{ closure: TaskStatus.Cancelled, label: t('Cancel the ${count:pluralityNumber} remaining subtasks', { count }) },
		]
	}

	static override get styles() {
		return css`
			mitra-dialog-close-subtasks {
				p {
					margin: 0 0 0.875rem;
					font-size: 0.875rem;
					color: var(--color-text);
					text-wrap: pretty;
				}

				.closures {
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
			<mitra-dialog heading=${t('Subtasks still open')} primaryButtonText=${t('OK')} primaryOnEnter>
				<p>${t('"${heading}" is closed, but ${count:pluralityNumber} of its subtasks are still open.', {
					heading: this.parameters.entry.heading,
					count: this.parameters.outstanding,
				})}</p>
				<div class="closures">
					${this.options.map(option => html`
						<label>
							<input type="radio" name="subtask-closure" .checked=${this.closure === option.closure}
								@change=${() => this.closure = option.closure}>
							<span>${option.label}</span>
						</label>
					`)}
				</div>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return this.closure
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-close-subtasks': DialogCloseSubtasks
	}
}
