import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { type Source } from '../Source.js'
import { canCopyEntriesOut, countSourceEntries, deleteSource, fetchIntegrations } from '../../../infrastructure/http/Api.js'
import { DialogSourceMigration } from '../../migration/client/DialogSourceMigration.js'

/**
 * Confirmation dialog for permanently deleting a local Mitra calendar and its entries.
 */
@component('mitra-dialog-source-deletion')
export class DialogSourceDeletion extends DialogComponent<{ readonly source: Source }, boolean> {
	/** Asks first only if the calendar has entries to lose. */
	static async confirmAndDelete(source: Source) {
		const hasEntries = await countSourceEntries(source.id) > 0
		if (hasEntries && await new DialogSourceDeletion({ source }).confirm().catch(() => false) !== true) {
			return false
		}
		await deleteSource(source.id)
		await fetchIntegrations()
		return true
	}

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-source-deletion {
				--mitra-dialog-width: min(28rem, 92vw);

				.warning {
					margin: 0 0 1rem;
					font-size: 0.8125rem;
					color: var(--color-text-muted);
					text-wrap: balance;
				}
			}
		`
	}

	private async migrate() {
		this.close(false)
		await new DialogSourceMigration({ source: this.parameters.source }).confirm().catch(() => void 0)
	}

	protected override get template() {
		const { source } = this.parameters
		return html`
			<mitra-dialog heading=${t('Delete "${name}"?', { name: source.name })}>
				<p class="warning">${t('All entries in this calendar will be deleted too. This can\'t be undone.')}</p>
				<mitra-choices>
					${canCopyEntriesOut(source) ? html`
						<mitra-choice autofocus icon="folder-input" @click=${() => this.migrate()}>${t('Move entries first…')}</mitra-choice>
					` : html`
						<mitra-choice autofocus icon="calendar" @click=${() => this.close(false)}>${t('Keep the calendar')}</mitra-choice>
					`}
					<mitra-choice icon="trash-2" @click=${() => this.close(true)}>${t('Delete')}</mitra-choice>
				</mitra-choices>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-source-deletion': DialogSourceDeletion
	}
}
