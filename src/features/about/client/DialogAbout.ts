import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { fetchChangelog, getMeta, getUser, isBundleStale, setSeenVersion } from '../../../infrastructure/http/Api.js'
import { type ChangelogSection } from '../Changelog.js'
const repository = 'https://github.com/a11delavar/mitra'

function runningVersion() {
	return getMeta()?.version ?? mitra.version
}

/**
 * Returns whether the instance is running a newer version than last seen by the user.
 */
export function hasUnseenChanges() {
	const seen = getUser()?.lastSeenVersion
	return !!seen && seen !== runningVersion()
}

/** Record the running version as seen and dismiss the update dot. */
export function markChangesSeen() {
	if (getUser()?.lastSeenVersion === runningVersion()) {
		return
	}
	setSeenVersion(runningVersion())
		.then(() => document.querySelector('mitra-sidebar')?.requestUpdate())
		.catch(() => void 0)
}

/**
 * The About dialog displaying instance identity and release notes.
 */
@component('mitra-dialog-about')
export class DialogAbout extends DialogComponent {
	@state() private sections?: Array<ChangelogSection>

	protected override async connected() {
		markChangesSeen()
		this.sections = await fetchChangelog().catch(() => new Array<ChangelogSection>())
	}

	protected override createRenderRoot() { return this }

	private get meta() {
		return getMeta()
	}

	private get version() {
		return runningVersion()
	}

	private get commit() {
		return this.meta?.commit || mitra.commit
	}

	private get versionParts() {
		const [, base, ahead, dirty] = /^(.*?)(?:-(\d+)-g[0-9a-f]+)?(-dirty)?$/.exec(this.version) ?? []
		return {
			base: base || this.version,
			extras: [ahead && `+${ahead}`, dirty && t('modified')].filter(Boolean).join(' · '),
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-about {
				mitra-dialog::part(dialog) {
					width: min(540px, 92vw);
					max-width: min(540px, 92vw);
				}

				.identity {
					display: flex;
					align-items: center;
					gap: 1rem;
					padding-inline-end: 1.5rem;

					.logo {
						width: 3rem;
						height: 3rem;
						flex-shrink: 0;
					}

					.details {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 0.5rem;
					}

					.version {
						font-size: 0.8125rem;
						color: var(--color-text-muted);
						user-select: text;

						.build {
							margin-inline-start: 0.5rem;
							font-size: 0.6875rem;
							font-weight: 500;
							color: var(--color-text-muted);
						}
					}

					.title {
						display: flex;
						align-items: baseline;
						gap: 0.5rem;
						flex-wrap: wrap;

						.name {
							font-size: 1.0625rem;
							font-weight: 650;
							letter-spacing: -0.01em;
							color: var(--color-text);
						}
					}

					.facts {
						margin: 0;
						display: grid;
						grid-template-columns: auto 1fr;
						row-gap: 0.25rem;
						column-gap: 1rem;
						font-size: 0.75rem;

						dt {
							color: var(--color-text-muted);
						}

						/* Values sit right after their labels — spreading them to the far edge made the
						   header read wider than it is. */
						dd {
							margin: 0;
							min-width: 0;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							color: var(--color-text);
							user-select: text;

							a {
								color: inherit;

								&:hover {
									color: var(--color-text);
								}

								&.code {
									font-family: ui-monospace, 'Cascadia Code', monospace;
								}
							}
						}
					}
				}

				.update {
					all: unset;
					box-sizing: border-box;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.375rem;
					width: 100%;
					padding: 0.5rem 0.75rem;
					border-radius: var(--border-radius);
					font-size: 0.8125rem;
					color: var(--color-text);
					cursor: pointer;
					background: color-mix(in srgb, var(--color-accent) 8%, transparent);

					&:hover {
						background: color-mix(in srgb, var(--color-accent) 12%, transparent);
					}
				}

				.sections {
					max-height: min(30rem, 65vh);
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					margin-inline: calc(-1 * var(--mitra-dialog-padding));
					border-top: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					scrollbar-width: thin;
					scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;
				}

				.empty {
					color: var(--color-text-muted);
					font-size: 0.8125rem;
					text-align: center;
					padding-block: 1.5rem;
				}

				details {
					border-top: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					interpolate-size: allow-keywords;

					&:first-child {
						border-top: none;
					}

					&::details-content {
						transition: block-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, content-visibility 0.3s allow-discrete;
						block-size: 0;
						opacity: 0;
						overflow: hidden;
					}
					&[open]::details-content {
						block-size: auto;
						opacity: 1;
					}

					summary {
						position: sticky;
						top: 0;
						z-index: 1;
						background: var(--color-background);
						display: flex;
						align-items: center;
						gap: 0.625rem;
						padding-block: 0.625rem;
						padding-inline: var(--mitra-dialog-padding);
						cursor: pointer;
						list-style: none;
						font-size: 0.875rem;
						transition: background 0.2s ease;

						&:focus-visible {
							outline: none;
							box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--color-text) 28%, transparent);
						}

						&::-webkit-details-marker {
							display: none;
						}

						&::before {
							content: '';
							width: 0.375rem;
							height: 0.375rem;
							flex-shrink: 0;
							border-inline-end: 1.5px solid var(--color-text-muted);
							border-block-end: 1.5px solid var(--color-text-muted);
							transform: rotate(-45deg);
							transition: transform 0.15s ease;
						}

						.version {
							font-weight: 600;
							color: var(--color-text);
						}

						.build {
							font-size: 0.6875rem;
							color: var(--color-text-muted);
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
						}

						.date {
							margin-inline-start: auto;
							font-size: 0.75rem;
							color: var(--color-text-muted);
							flex-shrink: 0;
						}
					}

					&[open] summary::before {
						transform: rotate(45deg);
					}

					&[data-current] summary .version::after {
						content: '•';
						margin-inline-start: 0.375rem;
						color: var(--color-accent);
					}
				}

				.notes {
					padding-inline: calc(var(--mitra-dialog-padding) + 1rem) var(--mitra-dialog-padding);
					padding-block: 0.25rem 0.875rem;
				}

				.category {
					& + .category {
						margin-block-start: 0.75rem;
					}

					&[data-type="chores"],
					&[data-type="refactors"],
					&[data-type="infrastructure"] {
						display: none;
					}

					h4 {
						margin: 0 0 0.35rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					mitra-markdown {
						font-size: 0.8125rem;

						a {
							font-family: ui-monospace, 'Cascadia Code', monospace;
							font-size: 0.85em;
							color: var(--color-text-muted);
							text-decoration: underline;
							text-underline-offset: 2px;
							text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
							transition: color 0.15s ease, text-decoration-color 0.15s ease;

							&:hover {
								color: var(--color-text);
								text-decoration-color: currentColor;
							}
						}
					}
				}

				a.section-link {
					display: inline-block;
					margin-block-start: 0.75rem;
					font-size: 0.75rem;
					color: var(--color-text-muted);
					text-decoration: underline;
					text-underline-offset: 3px;
					text-decoration-color: color-mix(in srgb, currentColor 30%, transparent);
					transition: color 0.15s ease, text-decoration-color 0.15s ease;

					&:hover {
						color: var(--color-text);
						text-decoration-color: currentColor;
					}
				}

				.identity a {
					color: inherit;
					text-decoration: underline;
					text-underline-offset: 3px;
					text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
					transition: color 0.15s ease, text-decoration-color 0.15s ease;

					&:hover {
						text-decoration-color: currentColor;
					}
				}

				a:focus-visible {
					outline: 2px solid color-mix(in srgb, var(--color-text) 35%, transparent);
					outline-offset: 2px;
					border-radius: 3px;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading='' primaryButtonText=${t('Copy')}>
				<header class="identity">
					<img class="logo" src="/android-chrome-192x192.png" alt="">
					<div class="details">
						<div class="title">
							<span class="name">${this.meta?.name ?? 'Mitra'}</span>
							<span class="version" title=${this.version}>
								${!this.meta?.releaseUrl
				? this.versionParts.base
				: html`<a href=${this.meta.releaseUrl} target="_blank" rel="noreferrer">${this.versionParts.base}</a>`}
								${!this.versionParts.extras ? html.nothing : html`<span class="build">${this.versionParts.extras}</span>`}
							</span>
						</div>
						<dl class="facts">
							<dt>${t('Commit')}</dt>
							<dd>${!this.commit ? '—' : html`<a class="code" href="${repository}/commit/${this.commit}" target="_blank" rel="noreferrer">${this.commit}</a>`}</dd>
							<dt>Node.js</dt>
							<dd>${this.meta?.node ?? '—'}</dd>
							<dt>${t('Repository')}</dt>
							<dd><a href=${repository} target="_blank" rel="noreferrer">a11delavar/mitra</a></dd>
						</dl>
					</div>
				</header>
				${this.updateTemplate}
				<div class="sections">
					${!this.sections ? html.nothing : !this.sections.length
				? html`<div class="empty">${t('No release notes available')}</div>`
				: this.sections.map(section => this.getSectionTemplate(section))}
				</div>
			</mitra-dialog>
		`
	}

	private get updateTemplate() {
		if (isBundleStale()) {
			return html`<button class="update" @click=${() => location.reload()}>${t('Reload to finish updating')}</button>`
		}
		const update = this.meta?.update
		return !update ? html.nothing : html`
			<a class="update" href=${update.url} target="_blank" rel="noreferrer">
				${update.commits
					? t('New dev build — ${count:pluralityNumber} commits ahead', { count: update.commits })
					: t('Update available: ${version}', { version: update.version })}
				→
			</a>
		`
	}

	private getSectionTemplate(section: ChangelogSection) {
		return html`
			<details ?open=${section.current} ?data-current=${section.current}>
				<summary>
					<span class="version">${section.version === 'unreleased' ? t('Unreleased') : section.version}</span>
					${section.version !== 'unreleased' || !section.current ? html.nothing : html`<span class="build" title=${this.version}>${this.version}</span>`}
					${!section.date ? html.nothing : html`<span class="date">${section.date}</span>`}
				</summary>
				<div class="notes">
					${section.categories.map(category => html`
						<div class="category" data-type=${category.type}>
							<h4>${category.title}</h4>
							<mitra-markdown .value=${category.markdown}></mitra-markdown>
						</div>
					`)}
					<a class="section-link" href=${section.url} target="_blank" rel="noreferrer">${t('View on GitHub')}</a>
				</div>
			</details>
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
