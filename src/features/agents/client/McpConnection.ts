import { Component, component, html, state } from '@a11d/lit'
import { docsPage } from '#features/about/client/website.js'
import { session } from '#infrastructure/http/PageSession.js'
import { mcpAddress } from './accessTokens.js'

/** Where agents connect, laid out as its setting's list, and where the documentation says how each client does. */
@component('mitra-mcp-connection')
export class McpConnection extends Component {
	@state() private copied = false

	protected override createRenderRoot() { return this }

	private async copy() {
		await navigator.clipboard.writeText(mcpAddress())
		this.copied = true
	}

	protected override get template() {
		return html`
			<ul>
				<li>
					<mitra-icon icon="link"></mitra-icon>
					<code>${mcpAddress()}</code>
					<span class="end">
						<mitra-icon-button size="small" icon=${this.copied ? 'check' : 'copy'} label=${t('Copy the address')} @click=${() => this.copy()}></mitra-icon-button>
					</span>
				</li>
			</ul>
			<p class="note">
				${session.instance.signIn ? html.nothing : t('People do not sign in to this Mitra, so connectors need no token. Anyone who can reach this address can use it.')}
				<a href=${docsPage('ai-connectors')} target="_blank" rel="noreferrer">${t('How to connect')}</a>
			</p>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-mcp-connection': McpConnection
	}
}
