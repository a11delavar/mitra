import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { fetchChangelog, getMeta, getUser, setSeenVersion, type ChangelogSection } from './Api.js'

/** Where the project lives — the footer's link target. */
const repository = 'https://github.com/a11delavar/mitra'

/** The version the instance actually runs — the server's answer beats the bundle's baked-in constant
 * (after an update, a stale service-worker cache is the one that's older). */
function runningVersion() {
	return getMeta()?.version ?? mitra.version
}

/** Whether the running build is exactly a release tag (`v0.3.0`), as opposed to a describe string,
 * a dirty tree, or a git-less `dev`. */
function isReleaseVersion(version: string) {
	return /^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) && !version.endsWith('-dirty')
}

/** Which changelog section describes the running build: the tag's own section on releases, the
 * `unreleased` one (what a dev image's CI prepend covers) for everything else. */
function currentSectionVersion() {
	const version = runningVersion()
	return isReleaseVersion(version) ? version.replace(/^v/, '') : 'unreleased'
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
 * The What's-New dialog: the changelog shipped inside the running image, rendered in-app — offline,
 * including right after an update. Deliberately its own dialog, not a section of About: About stays
 * a glanceable identity card; this one scrolls. Opened from the palette's What's-New command and the
 * About dialog's footer link — never automatically.
 */
@component('mitra-dialog-whats-new')
export class DialogWhatsNew extends DialogComponent {
	@state() private sections?: Array<ChangelogSection>

	protected override async connected() {
		// Opening IS the acknowledgement — any entry point clears the dot, read or skimmed.
		markChangesSeen()
		this.sections = await fetchChangelog().catch(() => new Array<ChangelogSection>())
	}

	protected override createRenderRoot() { return this }

	/** The section describing the running build — expanded; the rest start collapsed. Falls back to
	 * the newest section when nothing matches exactly (e.g. a local dev build whose committed
	 * changelog carries no `[Unreleased]` section). */
	private get currentSection() {
		return this.sections?.find(section => section.version === currentSectionVersion()) ?? this.sections?.[0]
	}

	/** GitHub's copy of the same notes: the release page when the build is a tag, the releases index
	 * otherwise (an unreleased section has no page of its own). */
	private get gitHubUrl() {
		const version = runningVersion()
		return isReleaseVersion(version) ? `${repository}/releases/tag/${version}` : `${repository}/releases`
	}

	static override get styles() {
		return css`
			/* Comfortable bullet width: slightly wider than About's identity card. */
			mitra-dialog-whats-new mitra-dialog::part(dialog) {
				width: min(480px, 92vw);
				max-width: min(480px, 92vw);
			}

			mitra-dialog-whats-new {
				.sections {
					max-height: min(28rem, 60vh);
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					scrollbar-width: thin;
					scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;
					/* The scrollbar rides the dialog's padding edge instead of squeezing the notes. */
					margin-inline-end: -0.75rem;
					padding-inline-end: 0.75rem;
				}

				.empty {
					color: var(--color-text-muted);
					font-size: 0.8125rem;
					text-align: center;
					padding-block: 1.5rem;
				}

				details {
					border-top: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);

					&:first-child {
						border-top: none;
					}

					summary {
						display: flex;
						align-items: center;
						gap: 0.625rem;
						padding-block: 0.625rem;
						cursor: pointer;
						list-style: none;
						font-size: 0.875rem;

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

					mitra-markdown {
						font-size: 0.8125rem;
						padding-block-end: 0.875rem;
						/* Indented past the chevron so bodies align with their version labels. */
						padding-inline-start: 1rem;

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

				a.github {
					margin-inline-end: auto;
					align-self: center;
					font-size: 0.8125rem;
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
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('What\'s New')}>
				<div class="sections">
					${!this.sections ? html.nothing : !this.sections.length
						? html`<div class="empty">${t('No release notes available')}</div>`
						: this.sections.map(section => this.getSectionTemplate(section))}
				</div>
				<a slot="footer" class="github" href=${this.gitHubUrl} target="_blank" rel="noreferrer">${t('View on GitHub')}</a>
			</mitra-dialog>
		`
	}

	private getSectionTemplate(section: ChangelogSection) {
		const current = section === this.currentSection
		return html`
			<details ?open=${current} ?data-current=${current}>
				<summary>
					<span class="version">${section.version === 'unreleased' ? t('Unreleased') : section.version}</span>
					${section.version !== 'unreleased' || !current ? html.nothing : html`<span class="build" title=${runningVersion()}>${runningVersion()}</span>`}
					${!section.date ? html.nothing : html`<span class="date">${section.date}</span>`}
				</summary>
				<mitra-markdown .value=${section.markdown}></mitra-markdown>
			</details>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-whats-new': DialogWhatsNew
	}
}
