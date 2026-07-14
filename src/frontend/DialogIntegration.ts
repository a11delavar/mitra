import { component, html, css, state, Binder } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Task, TaskStatus } from '@lit/task'
import { CalDAV, Notion, Source, SourceType, type Integration } from 'shared'
import { discoverSources, createIntegration, updateIntegration, getIntegrations, fetchIntegrations, fetchGoogleAvailability, connectGoogle } from './Api.js'

type Provider = 'caldav' | 'google' | 'apple' | 'notion'

@component('mitra-dialog-integration')
export class DialogIntegration extends DialogComponent<{ readonly id: string, readonly preselectSources?: boolean }, Integration> {
	@state() private entity: Integration = new CalDAV({ uri: '', credentials: { username: '', password: '' }, sources: [] as any })

	/** Which provider's panel the dialog shows — selectable on add, derived from the entity on edit. */
	@state() private provider: Provider = 'caldav'

	private readonly binder = new Binder(this, 'entity')

	private readonly fetchSources = new Task(this, {
		autoRun: false,
		args: () => [this.entity] as const,
		task: async ([entity]) => {
			const sources = await discoverSources(entity)
			// The provider may have been switched while this discovery was in flight — a stale result
			// must not land on the now-different entity (it would show one provider's sources under
			// another's panel). `entity` is the one this run started for; bail if it's been replaced.
			if (this.entity !== entity) {
				return this.entity.sources
			}
			// A fresh add pre-selects everything found — the common case is "import my account", so
			// unticking is the exception, not ticking every box. An edit (or its Refresh) keeps the
			// persisted activation state instead. Notion is the deliberate exception: its sources are
			// VIEWS, and a database's views mostly overlap (All / Board / This week show the same
			// tasks), so ticking them all would render every task once per view — pre-select one view
			// per database and let overlaps be an explicit choice. Keyed on the source URI, not the
			// dialog's current provider, so it's correct regardless of a concurrent provider switch.
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
			return this.entity.sources = sources as any
		},
	})

	/** Whether the deployment can connect Google accounts — gates the provider's add panel. */
	private readonly googleAvailability = new Task(this, {
		autoRun: !this.isEdit, // only the add panel offers connecting a new account
		args: () => [] as const,
		task: () => fetchGoogleAvailability(),
	})

	protected override createRenderRoot() { return this }

	private get isEdit() { return !!this.parameters.id }

	/** Switch the add panel to another provider. A fresh entity of the matching shape comes with it,
	 * so sources discovered for the previous provider don't linger (and can't be saved by mistake) —
	 * the panels bind different credential keyPaths, and each provider's `type` must be its own. */
	private switchProvider(provider: Provider) {
		this.provider = provider
		this.entity = provider === 'notion'
			? new Notion({ credentials: { username: '', token: '' }, sources: [] as any })
			: new CalDAV({ uri: '', credentials: { username: '', password: '' }, sources: [] as any })
	}

	protected override connected() {
		if (this.isEdit) {
			const integration = getIntegrations().find(i => i.id === this.parameters.id)
			if (integration) {
				// A provider the client doesn't model (e.g. the backend-only Dev) arrives as a plain
				// '@type'-less DTO without methods — fall back to a generic CalDAV-shaped copy for it.
				this.entity = integration.editableCopy?.() ?? new CalDAV({
					id: this.parameters.id,
					uri: integration.uri ?? '',
					credentials: { username: integration.credentials?.username ?? '', password: '' },
					sources: [...integration.sources].map(source => new Source({ uri: source.uri, type: source.type, name: source.name, enabled: source.enabled })) as any,
				})
				// Fresh from an OAuth connect (preselectSources): tick everything, like a fresh add — the
				// account was just authorized to import it. The sources are still persisted disabled
				// server-side (opt-in data flow); saving is what enables the ticked ones.
				if (this.parameters.preselectSources) {
					[...this.entity.sources].forEach(source => source.enabled = true)
				}
				this.provider = (['google', 'apple', 'notion'] as const).find(provider => provider === integration.type) ?? 'caldav'
			}
		}
	}

	static override get styles() {
		return css`
			mitra-dialog-integration {
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

						.type-icon {
							font-size: 16px;
							color: var(--color-text-muted);
						}
					}
				}
			}
		`
	}

	private static readonly providers: Array<{ value: Provider, label: string }> = [
		{ value: 'caldav', label: 'CalDAV' },
		{ value: 'google', label: 'Google Calendar' },
		{ value: 'apple', label: 'Apple Calendar' },
		{ value: 'notion', label: 'Notion' },
	]

	protected override get template() {
		return html`
			<mitra-dialog heading=${this.isEdit ? t('Edit integration') : t('Add integration')} primaryButtonText=${t('Save')}
				?primaryButtonDisabled=${!this.entity.sources.length || this.fetchSources.status === TaskStatus.PENDING}
			>
				<form class="content" @submit=${(e: Event) => e.preventDefault()}>
					${this.isEdit ? html.nothing : html`
						<label>
							${t('Provider')}
							<select @change=${(e: Event) => this.switchProvider((e.target as HTMLSelectElement).value as Provider)}>
								${DialogIntegration.providers.map(provider => html`
									<option value=${provider.value} ?selected=${this.provider === provider.value}>${provider.label}</option>
								`)}
							</select>
						</label>
					`}

					${this.provider === 'google' ? this.googleTemplate : this.provider === 'apple' ? this.appleTemplate : this.provider === 'notion' ? this.notionTemplate : this.caldavTemplate}

					${!this.entity.sources.length ? html.nothing : html`
						<div class="sources">
							<span class="sources-title">${t('Sources')}</span>
							${this.entity.sources.map(source => html`
								<label class="source">
									<input type="checkbox" .checked=${source.enabled} @change=${() => { source.toggleEnabled(); this.requestUpdate() }}>
									<mitra-icon class="type-icon" icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}></mitra-icon>
									${source.name}
								</label>
							`)}
						</div>
					`}
				</form>
			</mitra-dialog>
		`
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
			${this.fetchSourcesTemplate}
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
			${this.fetchSourcesTemplate}
		`
	}

	/** Add: hand off to Google's consent screen (the callback lands back here with the source picker
	 * open — see Mitra.initialized). Edit: the grant isn't form-editable, so only the account label
	 * and a sources Refresh show. */
	private get googleTemplate() {
		return this.isEdit ? html`
			<label>
				${t('Google account')}
				<input readonly .value=${this.entity.credentials.username} autocomplete="off">
			</label>
			${this.fetchSourcesTemplate}
		` : this.googleAvailability.render({
			pending: () => html`<button class="connect" disabled>${t('Continue with Google')}</button>`,
			error: (e: unknown) => html`<p class="error">${(e as Error).message}</p>`,
			complete: ({ configured }) => configured ? html`
				<p class="hint">${t('Google.ConsentHint')}</p>
				<button class="connect" @click=${() => connectGoogle()}>${t('Continue with Google')}</button>
			` : html`
				<p class="hint">${t('Google.ConfigurationHint')}</p>
			`,
		})
	}

	/** What Connect needs before it can try: the fields the provider's discovery authenticates
	 * with. An edit may leave secrets blank (the server keeps the stored ones). */
	private get connectDisabled(): boolean {
		switch (this.provider) {
			case 'notion': return !this.entity.credentials.token && !this.isEdit
			case 'apple': return !this.entity.credentials.username
			default: return !this.entity.uri || !this.entity.credentials.username
		}
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
					<input readonly .value=${this.entity.credentials.username ?? ''} autocomplete="off">
				</label>
			` : html`
				<p class="hint">${t('Notion.TokenHint')}</p>
			`}
			<label>
				${t('Integration Token')}
				<input type="password" ${bind({ keyPath: 'credentials.token', event: 'input' })} placeholder=${this.isEdit ? t('unchanged') : 'ntn_…'} autocomplete="off">
			</label>
			${this.fetchSourcesTemplate}
		`
	}

	/** The Connect/Refresh control. Rendered in both the INITIAL and COMPLETE task states (and after an
	 * error) so discovery is always re-runnable — in particular after a provider switch, which replaces
	 * the entity but leaves the task's last status COMPLETE. */
	private get connectButton() {
		return html`
			<button class="connect" @click=${() => { this.entity.type = this.provider; this.fetchSources.run() }} ?disabled=${this.connectDisabled}>
				${this.entity.sources.length ? t('Refresh') : t('Connect')}
			</button>
		`
	}

	private get fetchSourcesTemplate() {
		return this.fetchSources.render({
			initial: () => this.connectButton,
			complete: () => this.connectButton,
			error: (e: unknown) => html`
				${this.connectButton}
				<p class="error">${(e as Error).message}</p>
			`,
			pending: () => html`<button class="connect" disabled>${t('Connecting…')}</button>`,
		})
	}

	protected override async primaryAction() {
		this.entity.type = this.provider
		const integration = this.isEdit ? await updateIntegration(this.entity) : await createIntegration(this.entity)
		await fetchIntegrations()
		return integration
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-integration': DialogIntegration
	}
}
