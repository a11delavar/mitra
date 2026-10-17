import { component, html, css, ifDefined, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Localizer } from '@3mo/localization'
import { fetchReleases, getMeta, getUser, isBundleStale, setSeenVersion } from '../../../infrastructure/http/Api.js'
import { type ChangelogSection } from '../Changelog.js'
import { Release, type ReleaseFolder } from '../Release.js'
import { ReleaseNotes } from '../ReleaseNotes.js'
import { ReleaseNotesComponent } from './ReleaseNotesComponent.js'
import { releaseColors } from '../releaseNotes.css.js'
import { activated } from '../../../design/activated.css.js'
import { focusRing } from '../../../design/focusRing.css.js'
import { scrollbar } from '../../../design/scrollbar.css.js'
const repository = 'https://github.com/a11delavar/mitra'

/**
 * The About dialog, shaped like Settings: the instance and its releases in the rail, the chosen release beside it
 * (`mitra-release-notes`). The running release opens first.
 */
@component('mitra-dialog-about')
export class DialogAbout extends DialogComponent {
	static get runningVersion() {
		return getMeta()?.version ?? mitra.version
	}

	/** Whether the running release is news to the user, which the sidebar marks with a dot. */
	static get hasNews() {
		return !!getUser()?.hasMissed(DialogAbout.runningVersion)
	}

	/** Records the running release as seen, which takes the dot away. */
	static markSeen() {
		if (getUser()?.hasSeen(DialogAbout.runningVersion)) {
			return
		}
		setSeenVersion(DialogAbout.runningVersion)
			.then(() => document.querySelector('mitra-sidebar')?.requestUpdate())
			.catch(() => void 0)
	}

	@state() private releases?: Array<Release>
	@state() private folders = new Map<string, ReleaseFolder>()
	@state() private current?: ChangelogSection
	@state() private selected?: Release
	@state() private copied = false
	/** On a phone, whether the release fills the dialog rather than the rail. */
	@state() private drilled = true

	protected override async connected() {
		DialogAbout.markSeen()
		const { sections, folders } = await fetchReleases().catch(() => ({ sections: new Array<ChangelogSection>(), folders: new Array<ReleaseFolder>() }))
		this.folders = new Map(folders.map(folder => [folder.version, folder]))
		this.current = sections.find(section => section.current)
		this.releases = Release.list(sections, new Map(folders.map(folder => [folder.version, DialogAbout.notesOf(folder)])))
		this.selected = this.releases.find(release => !!this.current && release.sections.includes(this.current)) ?? this.releases[0]
		// The list arrives after the dialog took its focus, which landed on the commit link instead.
		await this.updateComplete
		this.querySelector<HTMLElement>('.releases [aria-current]')?.focus()
	}

	protected override createRenderRoot() { return this }

	/** A release's notes in the app's language where translated, else in English. */
	private static notesOf(folder: ReleaseFolder) {
		const english = ReleaseNotes.parse(folder.markdown)
		const translation = folder.translations[Localizer.locales.current.language]
		return (translation && english.translation(translation)) || english
	}

	private get meta() {
		return getMeta()
	}

	private get version() {
		return DialogAbout.runningVersion
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
				--mitra-dialog-width: min(80rem, 94vw);
				/* The panes fill the dialog to its edge, so the close button takes back the padding other dialogs give it. */
				--mitra-dialog-header-inset: 1.25rem;
				${releaseColors}

				mitra-dialog::part(dialog) {
					padding: 0;
					overflow: clip;
				}

				.panels {
					container: about / inline-size;
					display: grid;
					grid-template-columns: 15rem minmax(0, 1fr);
					block-size: min(58rem, 90dvh);
				}

				/* A shallow light in the mark's gold over the rail's top. Eased in many stops, since a straight fade at so low
				   an alpha shows its steps; the whole rail carries it, so no box edge cuts it off. */
				.rail {
					/* A light ground swallows a pale gold, so it takes a deeper tone and twice the strength there. */
					--gold: light-dark(rgb(226 148 40 / 0.2), rgb(240 176 80 / 0.13));
					display: flex;
					flex-direction: column;
					gap: 1.25rem;
					min-block-size: 0;
					padding: 0.875rem;
					border-inline-end: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
					background: radial-gradient(ellipse 130% 22rem at 50% 4.5rem in oklab,
						var(--gold),
						color-mix(in oklab, var(--gold) 82%, transparent) 12%,
						color-mix(in oklab, var(--gold) 60%, transparent) 25%,
						color-mix(in oklab, var(--gold) 38%, transparent) 40%,
						color-mix(in oklab, var(--gold) 20%, transparent) 55%,
						color-mix(in oklab, var(--gold) 8%, transparent) 72%,
						transparent) no-repeat var(--mitra-dialog-rail);
				}

				/* The instance, typeset rather than boxed, under a shallow light in the mark's gold. */
				.identity {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.375rem;
					padding: 1.75rem 0.5rem 0.5rem;
					text-align: center;

					.logo {
						inline-size: 4rem;
						block-size: 4rem;
						margin-block-end: 0.5rem;
					}

					.name {
						font-size: 1.375rem;
						font-weight: 700;
						letter-spacing: -0.02em;
						line-height: 1.1;
					}

					.version {
						display: flex;
						align-items: center;
						gap: 0.25rem;
						font-size: 0.8125rem;
						font-variant-numeric: tabular-nums;
						color: var(--color-text-muted);
						user-select: text;
						-webkit-user-select: text;

						.build {
							font-size: 0.6875rem;
						}

						mitra-icon-button {
							font-size: 0.75rem;
							opacity: 0.7;
						}
					}

					/* Keys end where values start, the pair centred under the name. */
					.facts {
						margin: 1rem 0 0;
						display: grid;
						grid-template-columns: auto auto;
						justify-content: center;
						gap: 0.375rem 0.75rem;
						font-size: 0.75rem;

						dt {
							text-align: end;
							color: var(--color-text-muted);
						}

						dd {
							margin: 0;
							text-align: start;
							color: var(--color-text);
							user-select: text;
							-webkit-user-select: text;

							.code {
								font-family: ui-monospace, 'Cascadia Code', monospace;
							}
						}
					}

					a {
						color: inherit;
						text-decoration: underline;
						text-underline-offset: 3px;
						text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);

						&:hover {
							text-decoration-color: currentColor;
						}
					}

					/* As narrow as the sidebar, so its words wrap rather than run past it ("Reload to finish updating"). */
					.update {
						inline-size: 100%;
						margin-block-start: 0.5rem;

						&::part(button) {
							white-space: normal;
							text-wrap: balance;
							text-align: center;
							padding-block: 0.375rem;
						}
					}
				}

				.releases {
					display: flex;
					flex-direction: column;
					gap: 1px;
					min-block-size: 0;
					overflow-y: auto;
					padding-block-start: 0.75rem;
					border-block-start: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
					${scrollbar};

					button {
						all: unset;
						box-sizing: border-box;
						display: flex;
						align-items: baseline;
						gap: 0.5rem;
						padding: 0.5rem 0.625rem;
						border-radius: 6px;
						font-size: 0.875rem;
						cursor: pointer;

						&[hidden] {
							display: none;
						}

						.version {
							font-weight: 600;
							font-variant-numeric: tabular-nums;
						}

						.mark {
							font-size: 0.6875rem;
							font-weight: 600;
						}

						.date {
							margin-inline-start: auto;
							font-size: 0.6875rem;
							color: var(--color-text-muted);
						}

						&:hover {
							${activated};
						}

						&[aria-current] {
							background: color-mix(in srgb, var(--color-accent) 12%, transparent);
						}

						&[data-state=latest] :is(.version, .mark) {
							color: var(--release-latest);
						}

						&[data-state=draft] :is(.version, .mark) {
							color: var(--release-dev);
						}

						&[data-state=planned] .version {
							color: var(--color-text-muted);
						}

						${focusRing};
					}
				}

				.release {
					display: flex;
					flex-direction: column;
					min-block-size: 0;
					/* The captures sit on what they were taken on. */
					background: var(--mitra-dialog-page);

					.bar {
						display: none;
					}

					mitra-release-notes {
						flex: 1;
						min-block-size: 0;
						overflow-y: auto;
						overscroll-behavior: contain;
						padding: 2.5rem 3rem 3rem;
						${scrollbar};
					}

					.empty {
						margin: auto;
						font-size: 0.8125rem;
						color: var(--color-text-muted);
					}
				}

				/* A phone shows the rail or the release, as Settings does its pages. The panels are the container, so only
				   what lies inside them may change here. */
				@container about (max-width: 40rem) {
					.rail, .release {
						grid-column: 1 / -1;
					}

					.panels[data-drilled] .rail,
					.panels:not([data-drilled]) .release {
						display: none;
					}

					.rail {
						border-inline-end: none;
					}

					.release {
						.bar {
							display: flex;
							align-items: center;
							/* Level with the close button, which sits over its end. */
							padding-block-start: var(--mitra-dialog-header-inset);
							padding-inline-start: var(--mitra-dialog-header-inset);
						}

						mitra-release-notes {
							padding: 1rem 1.25rem 2rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=''>
				<div class="panels" ?data-drilled=${this.drilled}>
					<aside class="rail">
						${this.identityTemplate}
						<nav class="releases" aria-label=${t('Releases')}>
							${(this.releases ?? []).map(release => this.entryTemplate(release))}
						</nav>
					</aside>
					<section class="release">
						<header class="bar">
							<mitra-icon-button icon="arrow-left" label=${t('Back')} @click=${() => this.drilled = false}></mitra-icon-button>
						</header>
						${this.releases && !this.selected ? html`<p class="empty">${t('No release notes available')}</p>` : html`
							<mitra-release-notes .release=${this.selected} .files=${this.folders.get(this.selected?.version ?? '')?.files ?? []}></mitra-release-notes>
						`}
					</section>
				</div>
			</mitra-dialog>
		`
	}

	private get identityTemplate() {
		return html`
			<header class="identity">
				<img class="logo" src="/android-chrome-192x192.png" alt="">
				<span class="name">${this.meta?.name ?? t('Mitra')}</span>
				<span class="version" title=${this.version}>
					${!this.meta?.releaseUrl
						? this.versionParts.base
						: html`<a href=${this.meta.releaseUrl} target="_blank" rel="noreferrer">${this.versionParts.base}</a>`}
					${!this.versionParts.extras ? html.nothing : html`<span class="build">${this.versionParts.extras}</span>`}
					<mitra-icon-button icon=${this.copied ? 'check' : 'copy'} label=${t('Copy')} @click=${() => this.copy()}></mitra-icon-button>
				</span>
				<dl class="facts">
					<dt>${t('Commit')}</dt>
					<dd>${!this.commit ? '—' : html`<a class="code" href="${repository}/commit/${this.commit}" target="_blank" rel="noreferrer">${this.commit}</a>`}</dd>
					<dt>Node.js</dt>
					<dd>${this.meta?.node ?? '—'}</dd>
					<dt>${t('Repository')}</dt>
					<dd><a href=${repository} target="_blank" rel="noreferrer">a11delavar/mitra</a></dd>
				</dl>
				${this.updateTemplate}
			</header>
		`
	}

	private get updateTemplate() {
		if (isBundleStale()) {
			return html`<mitra-button class="update" variant="primary" @click=${() => location.reload()}>${t('Reload to finish updating')}</mitra-button>`
		}
		const update = this.meta?.update
		return !update ? html.nothing : html`
			<mitra-button class="update" variant="primary" href=${update.url} target="_blank" title=${update.commits
				? t('New dev build: ${count:pluralityNumber} commits ahead', { count: update.commits })
				: t('Update available: ${version}', { version: update.version })}>
				${t('Update available')}
			</mitra-button>
		`
	}

	private entryTemplate(release: Release) {
		return html`
			<button data-state=${release.state} aria-current=${ifDefined(release === this.selected ? 'page' : undefined)} @click=${() => this.select(release)}>
				<span class="version">${release.unreleased ? t('Unreleased') : release.version}</span>
				${ReleaseNotesComponent.channelTemplate(release)}
				${ReleaseNotesComponent.whenTemplate(release, { day: 'numeric', month: 'short' })}
			</button>
		`
	}

	/** Another release starts at its top: the pane is the same element, so it would keep the last one's scroll. */
	private async select(release: Release) {
		this.selected = release
		this.drilled = true
		await this.updateComplete
		this.querySelector('mitra-release-notes')?.scrollTo({ top: 0 })
	}

	private async copy() {
		await navigator.clipboard.writeText(`Mitra ${this.version}${this.commit ? ` (${this.commit})` : ''} · Node.js ${this.meta?.node ?? '?'}`)
		this.copied = true
		setTimeout(() => this.copied = false, 1500)
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-about': DialogAbout
	}
}
