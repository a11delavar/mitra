import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { getMeta } from './Api.js'

/** Where the project lives — every link in the dialog (commit, releases) hangs off this. */
const repository = 'https://github.com/a11delavar/mitra'

/**
 * The About dialog: the instance's identity — its name, the exact running version — and the facts a
 * bug report needs (commit, runtime). Opened from the sidebar's brand row and the palette's About
 * command; the primary button copies everything as one line.
 */
@component('mitra-dialog-about')
export class DialogAbout extends DialogComponent {
	private get meta() {
		return getMeta()
	}

	/** The server's answer wins over the bundle's baked-in constants — after an update with a stale
	 * service-worker cache, the server is the one that's actually newer. */
	private get version() {
		return this.meta?.version ?? mitra.version
	}

	private get commit() {
		return this.meta?.commit || mitra.commit
	}

	/** A version that names a tag links to its GitHub release page; describe strings and dirty builds don't. */
	private get releaseUrl() {
		return /^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(this.version) && !this.version.endsWith('-dirty')
			? `${repository}/releases/tag/${this.version}`
			: undefined
	}

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-about {
				.identity {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.25rem;
					padding-block: 0.75rem 0.5rem;

					img {
						width: 2.75rem;
						height: 2.75rem;
						margin-bottom: 0.5rem;
					}

					.name {
						font-size: 1rem;
						font-weight: 650;
						letter-spacing: -0.01em;
						color: var(--color-text);
					}

					.version {
						font-size: 0.75rem;
						color: var(--color-text-muted);
						user-select: text;
					}
				}

				.facts {
					display: grid;
					grid-template-columns: auto 1fr;
					row-gap: 0.625rem;
					column-gap: 2.5rem;
					font-size: 0.8125rem;
					border-top: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					padding-top: 1.125rem;

					.label {
						color: var(--color-text-muted);
					}

					.value {
						justify-self: end;
						min-width: 0;
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
						color: var(--color-text);
						user-select: text;
					}
				}

				a {
					color: inherit;
					text-decoration: underline;
					text-underline-offset: 3px;
					text-decoration-color: color-mix(in srgb, currentColor 30%, transparent);
					transition: text-decoration-color 0.15s ease;

					&:hover {
						text-decoration-color: currentColor;
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('About')} primaryButtonText=${t('Copy')}>
				<div class="identity">
					<img src="/android-chrome-192x192.png" alt="">
					<span class="name">${this.meta?.name ?? 'Mitra'}</span>
					<span class="version" title=${this.version}>
						${!this.releaseUrl ? this.version : html`<a href=${this.releaseUrl} target="_blank" rel="noreferrer">${this.version}</a>`}
					</span>
				</div>
				<div class="facts">
					<span class="label">${t('Commit')}</span>
					<span class="value">
						${!this.commit ? '—' : html`<a href="${repository}/commit/${this.commit}" target="_blank" rel="noreferrer">${this.commit}</a>`}
					</span>
					<span class="label">Node.js</span>
					<span class="value">${this.meta?.node ?? '—'}</span>
					<span class="label">${t('Repository')}</span>
					<span class="value"><a href=${repository} target="_blank" rel="noreferrer">a11delavar/mitra</a></span>
				</div>
			</mitra-dialog>
		`
	}

	protected override primaryAction() {
		return navigator.clipboard.writeText(`Mitra ${this.version}${this.commit ? ` (${this.commit})` : ''} · Node.js ${this.meta?.node ?? '?'}`)
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-about': DialogAbout
	}
}
