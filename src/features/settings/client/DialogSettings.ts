import { component, html, css, state, query, repeat, type PropertyValues, ifDefined } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { activated } from '../../../design/activated.css.js'
import { focusRing } from '../../../design/focusRing.css.js'
import { settings, settingsPage, settingsPages, type Setting, type SettingsPageId } from './Setting.js'
import { SettingsStore } from './SettingsStore.js'
import { type SettingRow } from './SettingRow.js'

export interface SettingsParameters {
	/** Open on a specific setting row (e.g. from palette). */
	readonly focus?: Setting<unknown>
}

/** Settings dialog with page navigation rail and unified search across pages and setting keys. */
@component('mitra-dialog-settings')
export class DialogSettings extends DialogComponent<SettingsParameters> {
	@state() private page: SettingsPageId = DialogSettings.lastPage
	@state() private query = ''
	/** Single-pane drilldown state for narrow viewports. */
	@state() private drilled = false

	readonly store = new SettingsStore(this)

	@query('mitra-setting-row[focused]') private readonly focusedRow?: SettingRow

	/** Local storage key for persisting active page across dialog openings. */
	private static readonly lastPageKey = 'Mitra.Settings.Page'

	private static get lastPage() {
		const stored = localStorage.getItem(DialogSettings.lastPageKey) as SettingsPageId | null
		return stored && settingsPages.includes(stored) ? stored : 'general'
	}

	protected override createRenderRoot() { return this }

	protected override connected() {
		if (this.parameters.focus) {
			this.page = this.parameters.focus.page
			this.drilled = true
		}
	}

	protected override firstUpdated(props: PropertyValues) {
		super.firstUpdated(props)
		this.focusedRow?.scrollIntoView({ block: 'center' })
	}

	private setPage(page: SettingsPageId) {
		this.page = page
		this.drilled = true
		localStorage.setItem(DialogSettings.lastPageKey, page)
	}

	private get available() {
		return settings().filter(setting => setting.applies)
	}

	private settingsOf(page: SettingsPageId) {
		return this.available.filter(setting => setting.page === page)
	}

	private get pages() {
		return settingsPages.filter(page => this.settingsOf(page).length)
	}

	private get searching() {
		return !!this.query.trim()
	}

	private get results() {
		return this.pages
			.map(page => ({ page, settings: this.settingsOf(page).filter(setting => setting.matches(this.query)) }))
			.filter(group => group.settings.length)
	}

	private handleSearchKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && this.searching) {
			e.preventDefault()
			e.stopPropagation()
			this.query = ''
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-settings {
				--mitra-dialog-width: min(46rem, 92vw);
				--settings-padding: 1.25rem;
				--mitra-dialog-header-inset: 0.5rem;
				--settings-height: min(24rem, 70vh);

				mitra-dialog::part(dialog) {
					padding: 0;
					overflow: clip;
				}

				.panels {
					container: settings / inline-size;
					display: grid;
					grid-template-columns: 14rem minmax(0, 1fr);
					block-size: var(--settings-height);
				}

				.pages {
					display: flex;
					flex-direction: column;
					min-block-size: 0;
					background: var(--color-background);
					border-inline-end: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
					padding: 0.75rem 0.375rem;

					> .search {
						position: relative;
						display: flex;
						align-items: center;
						margin-block-end: 0.75rem;

						> mitra-icon {
							position: absolute;
							inset-inline-start: 0.625rem;
							font-size: 0.9375rem;
							color: var(--color-text-muted);
							pointer-events: none;
						}

						input[type=search] {
							inline-size: 100%;
							padding-inline-start: 2rem;

							&::-webkit-search-cancel-button {
								display: none;
							}
						}
					}

					> nav {
						display: flex;
						flex-direction: column;
						gap: 1px;
						overflow-y: auto;
						padding-inline: 0.25rem;
						scrollbar-width: thin;
						scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;

						> .page[data-instance] {
							margin-block-start: auto;
							padding-block-start: 0.5rem;
							border-block-start: var(--border);
							border-radius: 0;
						}
					}

					.page {
						all: unset;
						box-sizing: border-box;
						display: flex;
						align-items: center;
						gap: 0.625rem;
						padding: 0.5rem 0.625rem;
						border-radius: 6px;
						font-size: 0.875rem;
						color: color-mix(in srgb, var(--color-text) 80%, transparent);
						cursor: pointer;

						&[hidden] {
							display: none;
						}

						mitra-icon {
							font-size: 1.0625rem;
							color: var(--color-text-muted);
						}

						&:hover {
							${activated};
							color: var(--color-text);
						}

						&[aria-current] {
							background: color-mix(in srgb, var(--color-accent) 12%, transparent);
							font-weight: 600;
							color: var(--color-text);

							mitra-icon {
								color: var(--color-text);
							}
						}

						${focusRing};
					}
				}

				.content {
					display: flex;
					flex-direction: column;
					min-block-size: 0;
					overflow-y: auto;
					overscroll-behavior: contain;
					background: var(--color-surface);
					padding-inline: var(--settings-padding);
					padding-block-end: var(--settings-padding);
					scrollbar-width: thin;
					scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;

					> header {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						position: sticky;
						inset-block-start: 0;
						/* Positioned header sits over rows without explicit z-index to avoid clashing with close button */
						background: var(--color-surface);
						padding-block: 1rem 0.875rem;
						padding-inline-end: 2rem;

						h3 {
							margin: 0;
							font-size: 1rem;
							font-weight: 650;
							letter-spacing: -0.01em;
						}

						.back {
							display: none;
						}
					}

					.group {
						padding-block: 0.75rem 0.25rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);

						&:first-of-type {
							padding-block-start: 0;
						}
					}

					.empty {
						padding-block: 2rem;
						text-align: center;
						font-size: 0.8125rem;
						color: var(--color-text-muted);
					}
				}

				.rows {
					display: flex;
					flex-direction: column;
				}

				@container settings (max-width: 40rem) {
					.pages, .content {
						grid-column: 1 / -1;
					}

					.pages {
						border-inline-end: none;

						> .search {
							margin-inline-end: 2.25rem;
						}
					}

					.panels:not([data-drilled]) .content,
					.panels[data-drilled] .pages {
						display: none;
					}

					.content > header .back {
						display: inline-flex;
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=''>
				<div class="panels" ?data-drilled=${this.drilled || this.searching}>
					${this.railTemplate}
					<div class="content">${this.searching ? this.resultsTemplate : this.pageTemplate}</div>
				</div>
			</mitra-dialog>
		`
	}

	private get railTemplate() {
		return html`
			<div class="pages">
				<div class="search">
					<mitra-icon icon="search"></mitra-icon>
					<input type="search" autofocus placeholder=${t('Search settings…')}
						.value=${this.query}
						@input=${(e: Event) => this.query = (e.target as HTMLInputElement).value}
						@keydown=${(e: KeyboardEvent) => this.handleSearchKeyDown(e)}
					>
				</div>
				<nav>
					${this.pages.map(page => {
						const { title, icon } = settingsPage(page)
						return html`
							<button class="page" ?data-instance=${page === 'administration'}
								aria-current=${ifDefined(!this.searching && page === this.page ? 'page' : undefined)}
								@click=${() => this.setPage(page)}
							>
								<mitra-icon icon=${icon}></mitra-icon>
								${title}
							</button>
						`
					})}
				</nav>
			</div>
		`
	}

	private get pageTemplate() {
		return html`
			<header>
				<mitra-icon-button class="back" icon="arrow-left" label=${t('Back')}
					@click=${() => this.drilled = false}></mitra-icon-button>
				<h3>${settingsPage(this.page).title}</h3>
			</header>
			${this.rowsTemplate(this.settingsOf(this.page))}
		`
	}

	private get resultsTemplate() {
		const results = this.results
		return html`
			<header>
				<mitra-icon-button class="back" icon="arrow-left" label=${t('Back')}
					@click=${() => this.query = ''}></mitra-icon-button>
				<h3>${t('Settings')}</h3>
			</header>
			${!results.length ? html`<div class="empty">${t('No matches')}</div>` : results.map(group => html`
				<div class="group">${settingsPage(group.page).title}</div>
				${this.rowsTemplate(group.settings)}
			`)}
		`
	}

	private rowsTemplate(settings: ReadonlyArray<Setting<unknown>>) {
		return html`
			<div class="rows">
				${repeat(settings, setting => setting.constructor.name, setting => html`
					<mitra-setting-row .setting=${setting} ?focused=${setting === this.parameters.focus}></mitra-setting-row>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-settings': DialogSettings
	}
}
