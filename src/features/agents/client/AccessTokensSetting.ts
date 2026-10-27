import { html } from '@a11d/lit'
import { Setting, setting, type SettingStorage } from '#features/settings/client/Setting.js'
import { session } from '#infrastructure/http/PageSession.js'
import { accessTokenIssued } from './accessTokens.js'
import { DialogNewAccessToken } from './DialogNewAccessToken.js'
import { DialogAccessToken } from './DialogAccessToken.js'
import './AccessTokenList.js'

/** The tokens AI connectors connect with where people sign in; without accounts, the address alone is enough. Nothing here is a preference. */
@setting()
export class AccessTokensSetting extends Setting<undefined> {
	readonly heading = t('Access tokens')
	readonly icon = 'key-round'
	readonly keywords = undefined
	readonly page = 'ai'
	readonly fallback = undefined

	protected readonly storage: SettingStorage<undefined> = { read: () => undefined, write: () => undefined }

	override get applies() {
		const meta = session.instance
		return meta?.mcp !== false && !meta?.demo && !!meta?.signIn
	}

	override get hint() {
		return t('One for each connection, so you can revoke each on its own')
	}

	/** Made in one dialog and shown, once, in the next; the list behind has it as soon as it exists. */
	private async create() {
		try {
			const issued = await new DialogNewAccessToken().confirm()
			window.dispatchEvent(new Event(accessTokenIssued))
			await new DialogAccessToken(issued).confirm()
		} catch {
			// Cancelled.
		}
	}

	override get control() {
		return html`<mitra-button @click=${() => this.create()}>${t('New token')}</mitra-button>`
	}

	override get details() {
		return html`<mitra-access-tokens></mitra-access-tokens>`
	}
}
