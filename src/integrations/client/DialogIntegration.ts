import { component, html, css, state, Binder, unsafeHTML, ifDefined } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Source } from '../../features/sources/Source.js'
import { integrationClasses, type Integration, type IntegrationClass } from '../Integration.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { CalDAV, Notion } from '../registerIntegrations.js'
import { discoverSources, createIntegration, updateIntegration, getIntegrations, fetchIntegrations, fetchGoogleAvailability, connectGoogle } from '../../infrastructure/http/Api.js'
import caldavLogo from '../caldav/logo.svg'
import googleLogo from '../google/logo.svg'
import appleLogo from '../apple/logo.svg'
import icsLogo from '../ics/logo.svg'
import notionLogo from '../notion/logo.svg'
import tempoLogo from '../tempo/logo.svg'

/** Resolves an integration class's `logo` name (see IntegrationClass) to its inlined SVG markup. The
 * marks render inline (`unsafeHTML`), not via `<img>`, so the monochrome ones inherit `currentColor`
 * and theme with the surface while Google keeps its own gradient. */
const logos: Record<string, string> = {
	caldav: caldavLogo,
	google: googleLogo,
	apple: appleLogo,
	ics: icsLogo,
	notion: notionLogo,
	tempo: tempoLogo,
}

@component('mitra-dialog-integration')
export class DialogIntegration extends DialogComponent<{ readonly id?: string, readonly preselectSources?: boolean }, Integration> {
	/** The integration being configured. Unset while the add flow is still on the type-select step —
	 * picking a type constructs a fresh entity of its final class, and going back simply discards it,
	 * so no in-between-types conversion ever happens. */
	@state() private entity?: Integration

	@state() private discovering = false
	@state() private discoveryError?: string

	/** Whether the deployment can connect Google accounts — gates the provider's add panel.
	 * Unset while the check is in flight; only the add flow offers connecting a new account. */
	@state() private googleAvailability?: { configured: boolean } | { error: string }

	private readonly binder = new Binder(this, 'entity')

	protected override createRenderRoot() { return this }

	private get isEdit() { return !!this.parameters.id }

	/** The class behind the current entity — its `label` titles the details step. */
	private get integrationClass(): IntegrationClass | undefined {
		return integrationClasses().find(integrationClass => integrationClass.type === this.entity?.type)
	}

	private selectType(integrationClass: IntegrationClass) {
		this.entity = new integrationClass({ sources: [] as any })
		// A discovery still in flight for a previously picked type must not bleed into this one.
		this.discovering = false
		this.discoveryError = undefined
	}

	/** Runs source discovery for the current entity — the Connect/Refresh action. */
	private async discover() {
		const entity = this.entity!
		this.discovering = true
		this.discoveryError = undefined
		try {
			const sources = await discoverSources(entity)
			// The user may have gone back (and picked another type) while this discovery was in
			// flight — a stale result must not land on the now-different entity.
			if (this.entity !== entity) {
				return
			}
			// A fresh add pre-selects everything found — the common case is "import my account", so
			// unticking is the exception, not ticking every box. An edit (or its Refresh) keeps the
			// persisted activation state instead. Notion is the deliberate exception: its sources are
			// VIEWS, and a database's views mostly overlap (All / Board / This week show the same
			// tasks), so ticking them all would render every task once per view — pre-select one view
			// per database and let overlaps be an explicit choice.
			if (!this.isEdit) {
				const seenDataSources = new Set<string>()
				for (const source of sources) {
					const dataSourceId = source.uri?.startsWith(Notion.uriPrefix) ? Notion.idsOf(source).dataSourceId : undefined
					source.enabled = !dataSourceId || !seenDataSources.has(dataSourceId)
					if (dataSourceId) {
						seenDataSources.add(dataSourceId)
					}
				}
			}
			entity.sources = sources as any
		} catch (error) {
			if (this.entity === entity) {
				this.discoveryError = error instanceof Error ? error.message : String(error)
			}
		} finally {
			if (this.entity === entity) {
				this.discovering = false
			}
		}
	}

	protected override connected() {
		if (!this.isEdit) {
			fetchGoogleAvailability()
				.then(availability => this.googleAvailability = availability)
				.catch((error: Error) => this.googleAvailability = { error: error.message })
			return
		}
		const integration = getIntegrations().find(integration => integration.id === this.parameters.id)
		if (integration) {
			// A provider the client doesn't model (e.g. the backend-only Dev) arrives as a plain
			// '@type'-less DTO without methods — fall back to a generic CalDAV-shaped copy for it.
			this.entity = integration.editableCopy?.() ?? new CalDAV({
				id: this.parameters.id,
				uri: integration.uri ?? '',
				credentials: { username: integration.credentials?.username ?? '', password: '' },
				sources: [...integration.sources].map(source => new Source({ uri: source.uri, entryTypes: source.entryTypes, name: source.name, enabled: source.enabled })) as any,
			})
			// Fresh from an OAuth connect (preselectSources): tick everything, like a fresh add — the
			// account was just authorized to import it. The sources are still persisted disabled
			// server-side (opt-in data flow); saving is what enables the ticked ones.
			if (this.parameters.preselectSources) {
				[...this.entity.sources].forEach(source => source.enabled = true)
			}
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-integration {
				/* The type-select grid earns more room than the default form dialog width. */
				&:has(.types) {
					--mitra-dialog-width: min(36rem, 92vw);
				}

				.types {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
					gap: 0.625rem;
					/* Built for a growing catalog: the grid scrolls before the dialog outgrows the screen. */
					max-height: min(24rem, 60vh);
					overflow-y: auto;

					.type {
						height: auto;
						flex-direction: column;
						align-items: flex-start;
						justify-content: flex-start;
						gap: 0.125rem;
						padding: 0.875rem;
						text-align: start;
						background: transparent;
						user-select: none;

						&:not(:disabled):hover {
							border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
						}

						.logo {
							display: inline-flex;
							font-size: 1.75rem;
							margin-block-end: 0.625rem;

							svg {
								width: 1em;
								height: 1em;
							}
						}

						.name {
							font-size: 0.875rem;
							font-weight: 600;
						}

						.description {
							font-size: 0.75rem;
							font-weight: 400;
							color: var(--color-text-muted);
						}
					}
				}

				.content {
					display: flex;
					flex-direction: column;
					gap: 1rem;

					> label {
						display: flex;
						flex-direction: column;
						gap: 0.3rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					.connect {
						align-self: flex-start;
					}

					.hint {
						margin: 0;
						font-size: 0.8125rem;
						color: var(--color-text-muted);
					}

					.error {
						margin: 0;
						font-size: 0.8125rem;
						color: #ff6b6b;
					}
				}

				.sources {
					display: flex;
					flex-direction: column;
					gap: 0.75rem;

					.sources-title {
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					.source {
						display: flex;
						align-items: center;
						gap: 0.625rem;
						font-size: 0.875rem;
						color: var(--color-text);
						cursor: pointer;

						mitra-source-icon {
							font-size: 16px;
						}

						/* Name and what the collection holds on one line — the types are a caption, so they
						   never compete with the name for the row. */
						.name {
							display: flex;
							align-items: baseline;
							gap: 0.5rem;
							min-width: 0;

							.types {
								font-size: 0.75rem;
								color: var(--color-text-muted);
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog
				heading=${this.isEdit ? t('Edit integration') : this.integrationClass?.label ?? t('Add integration')}
				primaryButtonText=${!this.entity ? html.nothing : t('Save')}
				?primaryButtonDisabled=${!this.entity?.sources.length || this.discovering}
			>
				${this.isEdit || !this.entity ? html.nothing : html`
					<mitra-icon-button slot="leading" icon="arrow-left" label=${t('Back')}
						@click=${() => this.entity = undefined}
					></mitra-icon-button>
				`}
				${!this.entity ? this.typesTemplate : this.detailsTemplate}
			</mitra-dialog>
		`
	}

	/** The type-select step: one tile per connectable service, built from the shared registry so a new
	 * provider's class appears here on its own — the dialog only maps its `logo` name to an asset. */
	private get typesTemplate() {
		return html`
			<div class="types">
				${integrationClasses().map(integrationClass => html`
					<button class="type" @click=${() => this.selectType(integrationClass)}>
						<span class="logo">${unsafeHTML(logos[integrationClass.logo] ?? '')}</span>
						<span class="name">${integrationClass.label}</span>
						<span class="description">${t(integrationClass.description)}</span>
					</button>
				`)}
			</div>
		`
	}

	private get detailsTemplate() {
		const entity = this.entity!
		return html`
			<form class="content" @submit=${(e: Event) => e.preventDefault()}>
				${this.panelTemplate}

				${!entity.sources.length ? html.nothing : html`
					<div class="sources">
						<span class="sources-title">${t('Sources')}</span>
						${/* One checkbox per COLLECTION, never a per-type pair for the same URL: what a source
						    can hold is a subtitle (see Source.entryTypes), and enabling it imports every type
						    it carries. */''}
						${entity.sources.map(source => html`
							<label class="source">
								<input type="checkbox" .checked=${source.enabled} @change=${() => { source.toggleEnabled(); this.requestUpdate() }}>
								<mitra-source-icon .source=${source} icon=${ifDefined(entity.sourceIcon)}></mitra-source-icon>
								<span class="name">
									${source.name}
									<span class="types">${[
										...(source.entryTypes.length ? source.entryTypes : EntryType.all).map(type => type.formatPlural()),
										...source.readOnly ? [t('read-only')] : [],
									].join(' · ')}</span>
								</span>
							</label>
						`)}
					</div>
				`}
			</form>
		`
	}

	private get panelTemplate() {
		switch (this.entity!.type) {
			case 'google': return this.googleTemplate
			case 'apple': return this.appleTemplate
			case 'ics': return this.icsTemplate
			case 'notion': return this.notionTemplate
			case 'tempo': return this.tempoTemplate
			// Also the fallback for provider types the client doesn't model (see the edit fallback above).
			default: return this.caldavTemplate
		}
	}

	private get appleTemplate() {
		const { bind } = this.binder
		return html`
			<label>
				${t('Apple ID')}
				<input ${bind({ keyPath: 'credentials.username', event: 'input' })} ?readonly=${this.isEdit} autocomplete="off" placeholder="email@icloud.com">
			</label>
			<label>
				${t('App-Specific Password')}
				<input type="password" ${bind({ keyPath: 'credentials.password', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : ''} autocomplete="off">
			</label>
			${this.connectTemplate}
		`
	}

	private get icsTemplate() {
		const { bind } = this.binder
		return html`
			${!this.isEdit ? html`<p class="hint">${t('Ics.UrlHint')}</p>` : html`
				<label>
					${t('Calendar')}
					<input readonly .value=${this.entity!.credentials.username ?? ''} autocomplete="off">
				</label>
			`}
			<label>
				${t('Calendar URL')}
				<input ${bind({ keyPath: 'uri', event: 'input' })} ?readonly=${this.isEdit} placeholder="https://example.com/calendar.ics" autocomplete="off">
			</label>
			<label>
				${t('Username (optional)')}
				<input ${bind({ keyPath: 'credentials.authUsername', event: 'input' })} autocomplete="off">
			</label>
			<label>
				${t('Password (optional)')}
				<input type="password" ${bind({ keyPath: 'credentials.password', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : ''} autocomplete="off">
			</label>
			${this.connectTemplate}
		`
	}

	private get caldavTemplate() {
		const { bind } = this.binder
		return html`
			<label>
				${t('Server URL')}
				<input ${bind({ keyPath: 'uri', event: 'input' })} ?readonly=${this.isEdit} placeholder="https://caldav.example.com" autocomplete="off">
			</label>
			<label>
				${t('Username')}
				<input ${bind({ keyPath: 'credentials.username', event: 'input' })} ?readonly=${this.isEdit} autocomplete="off">
			</label>
			<label>
				${t('Password')}
				<input type="password" ${bind({ keyPath: 'credentials.password', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : ''} autocomplete="off">
			</label>
			${this.connectTemplate}
		`
	}

	/** Add: hand off to Google's consent screen (the callback lands back here with the source picker
	 * open — see Mitra.initialized). Edit: the grant isn't form-editable, so only the account label
	 * and a sources Refresh show. */
	private get googleTemplate() {
		if (this.isEdit) {
			return html`
				<label>
					${t('Google account')}
					<input readonly .value=${this.entity!.credentials.username} autocomplete="off">
				</label>
				${this.sharedCalendarsHint}
				${this.connectTemplate}
			`
		}
		const availability = this.googleAvailability
		return !availability ? html`
			<button class="connect" disabled>${t('Continue with Google')}</button>
		` : 'error' in availability ? html`
			<p class="error">${availability.error}</p>
		` : !availability.configured ? html`
			<p class="hint">${t('Google.ConfigurationHint')}</p>
		` : html`
			<p class="hint">${t('Google.ConsentHint')}</p>
			${this.sharedCalendarsHint}
			<button class="connect" @click=${() => connectGoogle()}>${t('Continue with Google')}</button>
		`
	}

	private get sharedCalendarsHint() {
		return html`
			<p class="hint">
				${t('Google.SharedCalendarsHint')}
				<a href="https://calendar.google.com/calendar/syncselect" target="_blank" rel="noopener noreferrer">calendar.google.com/calendar/syncselect</a>
			</p>
		`
	}

	/** Add: paste an internal-connection / personal-access token (no deployment config, unlike
	 * Google's OAuth). Edit: the workspace label is discovery-derived and read-only; a re-pasted
	 * token rotates the grant, a blank one keeps the stored secret. */
	private get notionTemplate() {
		const { bind } = this.binder
		return html`
			${this.isEdit ? html`
				<label>
					${t('Workspace')}
					<input readonly .value=${this.entity!.credentials.username ?? ''} autocomplete="off">
				</label>
			` : html`
				<p class="hint">${t('Notion.TokenHint')}</p>
			`}
			<label>
				${t('Integration Token')}
				<input type="password" ${bind({ keyPath: 'credentials.token', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : 'ntn_…'} autocomplete="off">
			</label>
			${this.connectTemplate}
		`
	}

	private get tempoTemplate() {
		const { bind } = this.binder
		return html`
			${this.isEdit ? html`
				<label>
					${t('Atlassian Account')}
					<input readonly .value=${this.entity!.credentials.username ?? ''} autocomplete="off">
				</label>
			` : html`
				<p class="hint">${t('Tempo.TokenHint')}</p>
			`}
			<label>
				${t('Site URL')}
				<input ${bind({ keyPath: 'credentials.site', event: 'input' })} ?readonly=${this.isEdit} placeholder="https://example.atlassian.net" autocomplete="off">
			</label>
			<label>
				${t('Tempo API Token')}
				<input type="password" ${bind({ keyPath: 'credentials.token', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : ''} autocomplete="off">
			</label>
			<label>
				${t('Atlassian Account E-mail')}
				<input ${bind({ keyPath: 'credentials.jiraEmail', event: 'input' })} autocomplete="off" placeholder="email@example.com">
			</label>
			<label>
				${t('Atlassian API Token')}
				<input type="password" ${bind({ keyPath: 'credentials.jiraToken', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : ''} autocomplete="off">
			</label>
			${this.connectTemplate}
		`
	}

	/** Whether Connect is blocked. The domain part — which fields a connection needs — lives on the
	 * entity ({@link Integration.canConnect}); the dialog only adds the edit policy: an edit can always
	 * refresh, since the server still holds the secrets the form leaves blank. */
	private get connectDisabled(): boolean {
		return !this.isEdit && !this.entity!.canConnect
	}

	/** The Connect/Refresh control — always re-runnable, in particular after an error. */
	private get connectTemplate() {
		return this.discovering ? html`
			<button class="connect" disabled>${t('Connecting…')}</button>
		` : html`
			<button class="connect" @click=${() => this.discover()} ?disabled=${this.connectDisabled}>
				${this.entity!.sources.length ? t('Refresh') : t('Connect')}
			</button>
			${!this.discoveryError ? html.nothing : html`<p class="error">${this.discoveryError}</p>`}
		`
	}

	protected override async primaryAction() {
		const integration = this.isEdit ? await updateIntegration(this.entity!) : await createIntegration(this.entity!)
		await fetchIntegrations()
		return integration
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-integration': DialogIntegration
	}
}
