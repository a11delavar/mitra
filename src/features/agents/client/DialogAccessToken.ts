import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { docsPage } from '#features/about/client/website.js'
import { mcpAddress } from './accessTokens.js'

/** Shows a token just made, the one time it is ever shown, beside the address an agent sends it to. */
@component('mitra-dialog-access-token')
export class DialogAccessToken extends DialogComponent<{ readonly name: string, readonly token: string }, void> {
	@state() private copied?: string

	protected override createRenderRoot() { return this }

	private async copy(text: string) {
		await navigator.clipboard.writeText(text)
		this.copied = text
	}

	static override get styles() {
		return css`
			mitra-dialog-access-token {
				--mitra-dialog-width: min(40rem, 92vw);
			}

			mitra-dialog-access-token mitra-dialog {
				> a {
					font-size: 0.8125rem;
					color: var(--color-text);
					text-decoration: underline;
					text-underline-offset: 3px;
					text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);

					&:hover {
						text-decoration-color: currentColor;
					}
				}

				p {
					margin: 0 0 0.75rem;
					font-size: 0.875rem;
					text-wrap: pretty;
				}

				/* A value to take away: a field's tint and hairline, its caption above, its copy button inside. */
				.copyable {
					display: grid;
					gap: 0.375rem;
					margin-block-end: 0.875rem;

					> .caption {
						display: flex;
						align-items: center;
						gap: 0.375rem;
						font-size: 0.75rem;
						font-weight: 500;
						color: var(--color-text-muted);
					}

					> .value {
						display: grid;
						grid-template-columns: minmax(0, 1fr) auto;
						align-items: start;
						gap: 0.5rem;
						padding-block: 0.625rem;
						padding-inline: 0.75rem 0.375rem;
						border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
						border-radius: 6px;
						background: color-mix(in srgb, var(--color-text) 5%, transparent);

						> code {
							align-self: center;
							font-family: ui-monospace, 'Cascadia Code', monospace;
							font-size: 0.8125rem;
							line-height: 1.5;
							overflow-wrap: anywhere;
							user-select: all;
							-webkit-user-select: all;
						}

						> mitra-icon-button {
							margin-block: -0.25rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${this.parameters.name} primaryButtonText=${t('Done')} primaryOnEnter>
				<p>${t('Copy this token now: it is shown only once.')}</p>
				${this.getCopyableTemplate('link', t('Address'), mcpAddress(), t('Copy the address'))}
				${this.getCopyableTemplate('key-round', t('Token'), this.parameters.token, t('Copy the token'))}
				<a href=${docsPage('ai-connectors')} target="_blank" rel="noreferrer">${t('How to connect')}</a>
			</mitra-dialog>
		`
	}

	private getCopyableTemplate(icon: string, caption: unknown, text: string, label: string) {
		return html`
			<div class="copyable">
				<span class="caption">
					<mitra-icon icon=${icon}></mitra-icon>
					${caption}
				</span>
				<div class="value">
					<code>${text}</code>
					<mitra-icon-button size="small" icon=${this.copied === text ? 'check' : 'copy'} label=${label} @click=${() => this.copy(text)}></mitra-icon-button>
				</div>
			</div>
		`
	}

	protected override primaryAction() {
		return undefined
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-access-token': DialogAccessToken
	}
}
