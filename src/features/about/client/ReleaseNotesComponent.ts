import { Component, component, css, html, ifDefined, property, unsafeHTML } from '@a11d/lit'
import { linesOf, type ChangelogCategory } from '../Changelog.js'
import { Release } from '../Release.js'
import { ReleaseDocs, type ReleaseCapture, type ReleaseHighlight } from '../ReleaseNotes.js'
import { releaseNotes } from '../releaseNotes.css.js'
import { Localizer } from '@3mo/localization'
import { docsBase, languages, localized, site, withBase } from '../../../../website/site.mjs'

const repository = 'https://github.com/a11delavar/mitra'
/** A page of the website, in the app's language where the website has it. */
const onWebsite = (route: string) => {
	const language = Localizer.locales.current.language
	return new URL(withBase(languages.includes(language) ? localized(route, language) : route), site).href
}
const docsPage = (page: string) => onWebsite(`/${docsBase}/${page}`)

/**
 * Marked up with the website's classes so both wear `releaseNotes.css.ts`. Only the captures the build carries show
 * (`files`), so an older release reads as text.
 */
@component('mitra-release-notes')
export class ReleaseNotesComponent extends Component {
	@property({ type: Object }) release!: Release
	@property({ type: Array }) files: ReadonlyArray<string> = []

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			${releaseNotes}

			mitra-release-notes {
				display: block;

				> .release-notes {
					display: flex;
					flex-direction: column;
					gap: 4.5rem;
				}

				.hero {
					display: flex;
					flex-direction: column;
					gap: 1rem;

					.when {
						display: flex;
						align-items: baseline;
						gap: 0.5rem;
					}

					.version {
						font-size: 1.75rem;
						font-weight: 650;
						letter-spacing: -0.03em;
						line-height: 1;
						font-variant-numeric: tabular-nums;
					}

					.mark {
						font-size: 0.75rem;
						font-weight: 600;
					}

					.date {
						margin-inline-start: auto;
						font-size: 0.8125rem;
						color: var(--color-text-muted);
					}

					.title {
						margin: 0;
						font-size: 1.375rem;
						font-weight: 650;
						letter-spacing: -0.01em;
						text-wrap: pretty;
					}

					.prose {
						font-size: 1rem;
					}
				}
			}
		`
	}

	protected override get template() {
		const { release } = this
		return !release ? html.nothing : html`
			<article class="release-notes" data-state=${release.state}>
				<header class="hero">
					<div class="when">
						<span class="version">${release.unreleased ? t('Unreleased') : release.version}</span>
						${ReleaseNotesComponent.channelTemplate(release)}
						${ReleaseNotesComponent.whenTemplate(release, { dateStyle: 'medium' })}
					</div>
					${!release.notes ? html.nothing : html`
						<h2 class="title">${release.notes.title}</h2>
						<mitra-markdown class="prose" .value=${ReleaseDocs.linked(release.notes.intro, docsPage)}></mitra-markdown>
					`}
				</header>
				${!release.notes?.foreword ? html.nothing : html`
					<section class="letter">
						<mitra-markdown class="prose" .value=${ReleaseDocs.linked(release.notes.foreword.markdown, docsPage)}></mitra-markdown>
						${!release.notes.foreword.signature ? html.nothing : html`
							<a class="signature" href=${ifDefined(release.notes.foreword.signature.url)} target="_blank" rel="noreferrer">
								<img src=${ifDefined(release.notes.foreword.signature.avatar)} alt="" width="40" height="40" loading="lazy" decoding="async">
								${release.notes.foreword.signature.name}
							</a>
						`}
					</section>
				`}
				${release.highlights.map((highlight, index) => this.highlightTemplate(highlight, index))}
				${!release.notes?.contributors.length ? html.nothing : html`
					<section class="emitted">
						<h3 class="title">${t('Contributors')}</h3>
						<ul class="people">
							${release.notes.contributors.map(person => html`
								<li>
									<a href=${ifDefined(person.url)} target="_blank" rel="noreferrer">
										${person.avatar
											? html`<img src=${person.avatar} alt="" width="40" height="40" loading="lazy" decoding="async">`
											: html`<span class="initial" aria-hidden="true">${person.name.replace(/^@/, '')[0]}</span>`}
										${person.name}
									</a>
									${!person.role ? html.nothing : html`<small>${person.role}</small>`}
								</li>
							`)}
						</ul>
					</section>
				`}
				${!release.patches.length && !release.everything ? html.nothing : html`
					<section class="emitted changelog">
						${!release.patches.length ? html.nothing : html`
							<section class="patches">
								<h3 class="title">${t('Patches')}</h3>
								${release.patches.map(patch => html`
									<div class="patch">
										<b>${patch.version}</b>
										<span class="date">${!patch.date ? html.nothing : ReleaseNotesComponent.dateOf(patch.date).format({ dateStyle: 'medium' })}</span>
										${this.linesTemplate(patch.categories.flatMap(linesOf))}
									</div>
								`)}
							</section>
						`}
						${!release.everything ? html.nothing : this.everythingTemplate(release)}
					</section>
				`}
				<div class="links">
					${!release.notes?.date ? html.nothing : html`<a href=${onWebsite(`/releases/${release.version}/`)} target="_blank" rel="noreferrer">${t('Read on mitracal.com')}</a>`}
					${!release.everything || release.unreleased ? html.nothing : html`<a href=${`${repository}/releases/tag/v${release.everything.version}`} target="_blank" rel="noreferrer">${t('View on GitHub')}</a>`}
				</div>
			</article>
		`
	}

	/** Beside the version, which release it is to you: the latest, or the next (the `:latest` and `:dev` images). */
	static channelTemplate(release: Release) {
		return !release.channel ? html.nothing : html`<span class="mark">${release.channel === 'latest' ? t('Latest') : t('Next')}</span>`
	}

	/** Where the date goes, when it ships: the day, or how far it is. A dev build's own commits say so in their name. */
	static whenTemplate(release: Release, format: Intl.DateTimeFormatOptions) {
		return release.date
			? html`<span class="date">${ReleaseNotesComponent.dateOf(release.date).format(format)}</span>`
			: release.unreleased
				? html.nothing
				: html`<span class="date">${release.state === 'planned' ? t('Planned') : t('In progress')}</span>`
	}

	private highlightTemplate(highlight: ReleaseHighlight, index: number) {
		const page = highlight.docs?.page
		return html`
			<section class="highlight" data-side=${index % 2 ? 'start' : 'end'}>
				<div class="text">
					<h3 class="heading">
						${highlight.heading}
						${page === undefined ? html.nothing : html`
							<a class="docs" href=${docsPage(page)} target="_blank" rel="noreferrer" title=${t('Docs: ${page}', { page: highlight.docs!.label })}>
								<mitra-icon icon="book-open"></mitra-icon>
							</a>
						`}
					</h3>
					<mitra-markdown class="prose" .value=${ReleaseDocs.linked(highlight.markdown, docsPage)}></mitra-markdown>
				</div>
				${!highlight.capture ? html.nothing : this.captureTemplate(highlight.capture)}
			</section>
		`
	}

	/** Both takes of a capture the build carries; the stylesheet shows the one for the theme. */
	private captureTemplate(capture: ReleaseCapture) {
		const extension = this.files.includes(capture.file('light', 'mp4')) ? 'mp4' : this.files.includes(capture.file('light')) ? 'webp' : undefined
		if (!extension) {
			return html.nothing
		}
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches
		return html`
			<figure class="shot" role="img" aria-label=${capture.alt}>
				${(['light', 'dark'] as const).map(theme => {
					const folder = `/releases/${this.release.version}`
					const url = `${folder}/${capture.file(theme, extension)}`
					const poster = this.files.includes(capture.file(theme)) ? `${folder}/${capture.file(theme)}` : undefined
					return html`
						<a class=${theme} href=${url} target="_blank" rel="noreferrer">
							${extension === 'mp4'
								? html`<video src=${url} poster=${ifDefined(poster)} ?autoplay=${!still} muted loop playsinline preload="none" aria-hidden="true"></video>`
								: html`<img src=${url} alt="" loading="lazy" decoding="async">`}
						</a>
					`
				})}
			</figure>
		`
	}

	/** Every commit, folded; its heading counts them, the maintenance ones as one number. */
	private everythingTemplate(release: Release) {
		const maintenance = release.maintenanceCount ? t('${count:pluralityNumber} maintenance changes', { count: release.maintenanceCount }) : undefined
		const counts = [
			...release.counts.filter(count => !Release.maintenance.has(count.type)).map(count => ReleaseNotesComponent.countOf(count)),
			...maintenance ? [maintenance] : [],
		].join(' · ')
		return html`
			<details class="everything">
				<summary class="title">
					<mitra-icon icon="chevron-right"></mitra-icon>
					<h3>${release.unreleased ? t('Unreleased') : t('Everything in ${version}', { version: release.version })}</h3>
					<small>${counts}</small>
				</summary>
				${release.listed.map(category => html`
					<div class="category" data-type=${category.type}>
						<h4 class="label">${ReleaseNotesComponent.labelOf(category)}</h4>
						${this.linesTemplate(linesOf(category))}
					</div>
				`)}
				${!maintenance ? html.nothing : html`
					<p class="maintenance">${unsafeHTML(String(t('Plus ${link} on GitHub: tests, builds and chores.', { link: `<a href="${release.commitsUrl}" target="_blank" rel="noreferrer">${maintenance}</a>` })))}</p>
				`}
			</details>
		`
	}

	private linesTemplate(lines: ReturnType<typeof linesOf>) {
		return html`
			<ul class="lines">
				${lines.map(line => html`
					<li>
						<span>${line.subject}</span>
						${!line.url ? html.nothing : html`<a class="hash" href=${line.url} target="_blank" rel="noreferrer">${line.hash}</a>`}
					</li>
				`)}
			</ul>
		`
	}

	/** A changelog category in the reader's language, keyed on its type; one the dictionary lacks keeps cliff's title. */
	private static labelOf(category: ChangelogCategory) {
		const labels: Record<string, () => string> = {
			'features': () => t('Features'),
			'improvements': () => t('Improvements'),
			'documentation': () => t('Documentation'),
			'refactors': () => t('Refactors'),
			'tests': () => t('Tests'),
			'other': () => t('Other'),
		}
		return labels[category.type]?.() ?? category.title.replace(/^[^\p{L}]+/u, '').trim()
	}

	/** "24 features", a category's count of commits in the reader's language. */
	private static countOf(count: { type: string, count: number }) {
		const counts: Record<string, () => string> = {
			'features': () => t('${count:pluralityNumber} features', { count: count.count }),
			'improvements': () => t('${count:pluralityNumber} improvements', { count: count.count }),
			'documentation': () => t('${count:pluralityNumber} documentation changes', { count: count.count }),
			'refactors': () => t('${count:pluralityNumber} refactors', { count: count.count }),
		}
		return counts[count.type]?.() ?? t('${count:pluralityNumber} other changes', { count: count.count })
	}

	/** A release's day, which the reader's calendar then names. */
	private static dateOf(iso: string) {
		return new DateTime(`${iso}T00:00:00`)
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-release-notes': ReleaseNotesComponent
	}
}
