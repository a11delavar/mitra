import { component, html, css, state, Binder } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Task, TaskStatus } from '@lit/task'
import { CalDAV, Source, SourceType, type Integration } from 'shared'
import { discoverSources, createIntegration, updateIntegration, getIntegrations, fetchIntegrations } from './Api.js'

@component('mitra-dialog-integration')
export class DialogIntegration extends DialogComponent<{ readonly id: string }, Integration> {
	// `sources` is kept as a plain array (never a live ORM Collection) so the entity stays
	// JSON-serializable when sent to the API — a Collection holds a circular owner reference.
	@state() private entity = new CalDAV({ uri: '', credentials: { username: '', password: '' }, sources: [] as any })

	private readonly binder = new Binder(this, 'entity')

	private readonly fetchSources = new Task(this, {
		autoRun: false,
		args: () => [this.entity] as const,
		task: async ([entity]) => {
			const sources = await discoverSources(entity)
			// A fresh add pre-selects everything found — the common case is "import my account", so
			// unticking is the exception, not ticking every box. An edit (or its Refresh) keeps the
			// persisted activation state instead.
			if (!this.isEdit) {
				sources.forEach(source => source.enabled = true)
			}
			return this.entity.sources = sources as any
		},
	})

	protected override createRenderRoot() { return this }

	private get isEdit() { return !!this.parameters.id }

	protected override connected() {
		if (this.isEdit) {
			const integration = getIntegrations().find(i => i.id === this.parameters.id)
			if (integration) {
				this.entity = new CalDAV({
					id: this.parameters.id,
					uri: integration.uri ?? '',
					credentials: { username: integration.credentials?.username ?? '', password: '' },
					sources: [...integration.sources].map(source => new Source({ uri: source.uri, type: source.type, name: source.name, enabled: source.enabled })) as any,
				})
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

	protected override get template() {
		const { bind } = this.binder
		return html`
			<mitra-dialog heading=${this.isEdit ? t('Edit integration') : t('Add integration')} primaryButtonText=${t('Save')}
				?primaryButtonDisabled=${!this.entity.sources.length || this.fetchSources.status === TaskStatus.PENDING}
			>
				<form class="content" @submit=${(e: Event) => e.preventDefault()}>
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

					${this.fetchSources.render({
						initial: () => html`
							<button class="connect" @click=${() => this.fetchSources.run()} ?disabled=${!this.entity.uri || !this.entity.credentials.username}>
								${this.entity.sources.length ? t('Refresh') : t('Connect')}
							</button>
						`,
						error: (e: unknown) => html`<p class="error">${(e as Error).message}</p>`,
						pending: () => html`<button class="connect" disabled>${t('Connecting…')}</button>`,
					})}

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

	protected override async primaryAction() {
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
