import { Component, component, eventListener, html } from '@a11d/lit'
import { Task } from '@lit/task'
import { type AccessToken } from '../../identity/AccessToken.js'
import { ClockController } from '../../time/client/ClockController.js'
import { accessTokenIssued, fetchAccessTokens, revokeAccessToken } from './accessTokens.js'

/** The access tokens the user has given agents, laid out as its setting's list. */
@component('mitra-access-tokens')
export class AccessTokenList extends Component {
	protected readonly clock = new ClockController(this)

	private readonly tokens = new Task(this, {
		args: () => [] as const,
		task: () => fetchAccessTokens(),
	})

	protected override createRenderRoot() { return this }

	@eventListener({ target: window, type: accessTokenIssued })
	handleIssued() {
		void this.tokens.run()
	}

	private async revoke(accessToken: AccessToken) {
		await revokeAccessToken(accessToken.id)
		await this.tokens.run()
	}

	protected override get template() {
		return html`
			${this.tokens.render({
				pending: () => html.nothing,
				error: () => html`<p class="note">${t('Could not load your access tokens.')}</p>`,
				complete: tokens => !tokens.length
					? html`<p class="note">${t('No access tokens yet.')}</p>`
					: html`<ul>${tokens.map(token => this.getTokenTemplate(token))}</ul>`,
			})}
		`
	}

	private getTokenTemplate(token: AccessToken) {
		return html`
			<li>
				<mitra-icon icon="bot"></mitra-icon>
				<span class="text">
					<span class="label">${token.name}</span>
					<span class="hint">
						${t('created ${date}', { date: new DateTime(token.createdAt).since().format() })}
						·
						${token.lastUsedAt ? t('last used ${date}', { date: new DateTime(token.lastUsedAt).since().format() }) : t('never used')}
					</span>
				</span>
				<span class="end">
					<span class="chip">${token.writes ? t('Read and write') : t('Read only')}</span>
					<mitra-popover-container>
						<mitra-icon-button size="small" icon="more-horizontal" label=${t('Options')}></mitra-icon-button>
						<mitra-menu slot="popover">
							<mitra-menu-item icon="x" variant="danger" @click=${() => this.revoke(token)}>${t('Revoke this token')}</mitra-menu-item>
						</mitra-menu>
					</mitra-popover-container>
				</span>
			</li>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-access-tokens': AccessTokenList
	}
}
