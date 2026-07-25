import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { fetchChangelog, getMeta, getUser, isBundleStale, setSeenVersion } from './Api.js'
import type { ChangelogSection } from 'shared'

/** Where the project lives — the identity block's repository and commit links. The DERIVED links
 * (this build's release page, each version's notes) come pre-resolved from the server; only these
 * two static ones are built here. */
const repository = 'https://github.com/a11delavar/mitra'

/** The version this tab treats as running: the server's answer, falling back to the bundle's baked-in
 * constant only until `/meta` arrives. A plain value read — nothing is derived from its shape. */
function runningVersion() {
	return getMeta()?.version ?? mitra.version
}

/**
 * Whether the instance has moved to a version the user hasn't looked at yet — what the sidebar's
 * news dot renders. Deliberately quiet: the dot is the ONLY unprompted signal; the dialog itself
 * never opens on its own — the calendar is a tool, news waits until asked. A user with no recorded
 * version yet (fresh install / first sign-in) reads as nothing new, not as everything new.
 */
export function hasUnseenChanges() {
	const seen = getUser()?.lastSeenVersion
	return !!seen && seen !== runningVersion()
}

/** Record the running version as seen and put the sidebar's news dot out. Fire-and-forget: a failed
 * write just re-lights the dot next boot. */
export function markChangesSeen() {
	if (getUser()?.lastSeenVersion === runningVersion()) {
		return
	}
	setSeenVersion(runningVersion())
		// The sidebar renders off the module-level user cache — nudge it like the dialogs do.
		.then(() => document.querySelector('mitra-sidebar')?.requestUpdate())
		.catch(() => void 0)
}

/**
 * The About dialog: the instance's identity (name, exact running version, the facts a bug report
 * needs) as a header, and the changelog shipped inside the running image below it — rendered in-app,
 * offline, including right after an update. One dialog, one scroll: opening it IS reading the news,
 * so it clears the sidebar's dot. Opened from the sidebar's brand row and the palette's About /
 * What's-New commands; never automatically.
 */
@component('mitra-dialog-about')
export class DialogAbout extends DialogComponent {
	@state() private sections?: Array<ChangelogSection>

	protected override async connected() {
		// Opening IS the acknowledgement — any entry point clears the dot, read or skimmed.
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

	/** The running version split for display: the tag as the headline, the describe trailer
	 * (`-33-g3919478-dirty`) as muted build metadata beside it — a dev build reads as
	 * "v0.3.0 +33 · modified" instead of a raw git-describe string. The raw string stays
	 * in the tooltip and the Copy line, where precision matters. */
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

				/* The header: the mark pinned to the inline-start, the build's facts filling toward the
				   inline-end — identity read left-to-right, not stacked under the logo. */
				.identity {
					display: flex;
					align-items: center;
					gap: 1rem;
					/* Keep the top row clear of the dialog's floating close button (no title bar). */
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

					/* The version — muted, sitting quietly beside the name. */
					.version {
						font-size: 0.8125rem;
						color: var(--color-text-muted);
						user-select: text;

						/* The describe trailer of a dev build ("+33 · modified") — build metadata, not
						   part of the version's name. */
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

							/* Reference links (the commit, the repository) wear the changelog hashes'
							   look — muted with a waking underline — so they read as links instead of
							   default text; the hash itself is a monospace code reference. */
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

				/* The actionable face of the sidebar's update dot: one accent-tinted row between the
				   header and the notes — a link to the release/compare page, or a reload button. */
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

				/* The release notes below the header — its own scroll region, bled to the dialog's
				   edges so the scrollbar rides the dialog border and the sticky version rows span
				   the full width; summaries and notes re-add the padding inside themselves. */
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
						/* The dialog's own padding, re-added inside the full-bleed scroller — it keeps
						   the chevron clear of the scroll edge and lets the row surface run edge to edge. */
						padding-block: 0.625rem;
						padding-inline: var(--mitra-dialog-padding);
						cursor: pointer;
						list-style: none;
						font-size: 0.875rem;
						transition: background 0.2s ease;

						/* The browser's default focus ring is a hard white halo that fights the monochrome
						   surface — replace it with a slightly firmer background and a faint inset outline
						   that hugs the row's rounded corners (an inset shadow never clips against the
						   scroll container the way an outward ring would). */
						&:focus-visible {
							outline: none;
							box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--color-text) 28%, transparent);
						}

						&::-webkit-details-marker {
							display: none;
						}

						/* A hand-rolled chevron so the marker matches the app's iconography scale. */
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

				/* Bodies indented past the chevron so they align with their version labels. */
				.notes {
					padding-inline: calc(var(--mitra-dialog-padding) + 1rem) var(--mitra-dialog-padding);
					padding-block: 0.25rem 0.875rem;
				}

				/* One block per changelog category — the server tags each with its type (see
				   shared/Changelog.ts). The stylesheet alone decides what shows: the three
				   purely-technical categories the reader never needs are hidden here, not in JS. */
				.category {
					& + .category {
						margin-block-start: 0.75rem;
					}

					&[data-type="chores"],
					&[data-type="refactors"],
					&[data-type="infrastructure"] {
						display: none;
					}

					/* A quiet section label in the title case it was authored in; the emoji baked into the
					   title carries what little color the monochrome surface allows. */
					h4 {
						margin: 0 0 0.35rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					mitra-markdown {
						font-size: 0.8125rem;

						/* The only links in a changelog body are the trailing commit hashes. The app's
						   accent IS its text color (monochrome theme), so Markdown's default accent-colored
						   link is invisible as one — set them apart as monospace commit references instead:
						   muted, smaller, a faint underline that wakes up on hover. */
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

				/* Each version's notes on GitHub — a quiet trail at the foot of its body. */
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

				/* The header's identity links (version, commit, repository). */
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

				/* One focus language for every link in the dialog: the browser's hard white halo is
				   replaced with a quiet rounded ring that follows the text box. */
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

	/** The detail behind the sidebar's update dot. The stale tab wins — this very tab runs an older
	 * bundle than the server, so one reload IS the update (and usually clears the rest). Otherwise
	 * the pending update links where its story lives: the release page (whose body is the changelog
	 * section, per release.yml), or the compare view for dev builds. */
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
