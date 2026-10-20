import { component, html, css, state, bind } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { AccessTokenScope } from '#features/identity'
import { createAccessToken } from './accessTokens.js'

/** Asks what a new access token is for and what it may do, and makes it, answering its name and the token itself. */
@component('mitra-dialog-new-access-token')
export class DialogNewAccessToken extends DialogComponent<void, { readonly name: string, readonly token: string }> {
	@state() tokenName = ''
	@state() tokenScope = AccessTokenScope.Read

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			/* Its own width, or it takes the settings dialog's it opens over. */
			mitra-dialog-new-access-token {
				--mitra-dialog-width: min(26rem, 92vw);

				mitra-dialog > .form {
					display: grid;
					gap: 0.75rem;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('New token')} primaryButtonText=${t('Create')} primaryOnEnter ?primaryButtonDisabled=${!this.tokenName.trim()}>
				<div class="form">
					<mitra-text-field autofocus maxlength="60" label=${t('Name')} placeholder=${t('What it is for, like Laptop or Claude')} ${bind(this, 'tokenName')}></mitra-text-field>
					<mitra-select label=${t('Access')} ${bind(this, 'tokenScope')}>
						<mitra-option .value=${AccessTokenScope.Read}>${t('Read only')}</mitra-option>
						<mitra-option .value=${AccessTokenScope.Write}>${t('Read and write')}</mitra-option>
					</mitra-select>
				</div>
			</mitra-dialog>
		`
	}

	protected override async primaryAction() {
		const name = this.tokenName.trim()
		const { token } = await createAccessToken(name, this.tokenScope)
		return { name, token }
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-new-access-token': DialogNewAccessToken
	}
}
