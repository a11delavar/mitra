import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Task, TaskStatus, initialState } from '@lit/task'
import { canMoveEntriesOut, getCapabilities, getIntegrations, migrateSourceEntries, previewSourceMigration } from '../../../infrastructure/http/Api.js'
import { MigrationPlan, type MigrationOutcome, type MigrationVerdict } from '../MigrationPlan.js'
import { type Source } from '../../sources/Source.js'

const NAMED_BLOCKED = 5

/** Dialog to move or copy all entries from a source to another calendar with fidelity preview. */
@component('mitra-dialog-source-migration')
export class DialogSourceMigration extends DialogComponent<{ readonly source: Source }, void> {
	@state() private target?: Source
	@state() private flatten?: boolean
	@state() private keepOriginals = false

	private readonly preview = new Task(this, {
		args: () => [this.target?.id] as const,
		task: ([targetId]) => !targetId ? initialState : previewSourceMigration(this.source.id, targetId, !this.canMove),
	})

	private readonly migration = new Task(this, {
		autoRun: false,
		task: () => migrateSourceEntries(this.source.id, {
			targetSourceId: this.target!.id,
			flatten: this.flatten === true,
			keepOriginals: this.keepOriginals,
		}),
	})

	protected override createRenderRoot() { return this }

	private get source() { return this.parameters.source }

	private get canMove() { return canMoveEntriesOut(this.source) }

	private get running() { return this.migration.status === TaskStatus.PENDING }

	private get reported() { return this.migration.status === TaskStatus.COMPLETE }

	/** Available destination sources (writable, enabled, excluding origin). */
	private get targets() {
		return getIntegrations()
			.map(integration => ({
				integration,
				sources: [...integration.sources].filter(source => source.id !== this.source.id && source.enabled && getCapabilities(source.id).createEntries),
			}))
			.filter(({ sources }) => sources.length)
	}

	private start(keepOriginals: boolean) {
		this.keepOriginals = keepOriginals
		void this.migration.run()
	}

	private back() {
		if (this.flatten !== undefined && this.preview.value?.flattenable.length) {
			this.flatten = undefined
		} else {
			this.target = undefined
			this.flatten = undefined
		}
	}

	private asksSeries(plan: MigrationPlan) {
		return this.flatten === undefined && plan.flattenable.length > 0
	}

	private get heading() {
		if (this.reported) {
			return this.migration.value!.aborted
				? this.keepOriginals ? t('Nothing was copied') : t('Nothing was moved')
				: this.keepOriginals ? t('Copied to ${name}', { name: this.target!.name }) : t('Moved to ${name}', { name: this.target!.name })
		}
		if (!this.target) {
			return this.canMove ? t('Move entries to another calendar') : t('Copy entries to another calendar')
		}
		const plan = this.preview.value
		if (plan && !this.running && this.asksSeries(plan)) {
			return t('Repeating entries cannot repeat in ${name}', { name: this.target.name })
		}
		return this.canMove ? t('Move to ${name}', { name: this.target.name }) : t('Copy to ${name}', { name: this.target.name })
	}

	static override get styles() {
		return css`
			@keyframes migration-progress {
				from { translate: -100%; }
				to { translate: 400%; }
			}

			@keyframes migration-mark {
				from { scale: 0.8; opacity: 0; }
				to { scale: 1; opacity: 1; }
			}

			mitra-dialog-source-migration {
				--mitra-dialog-width: min(30rem, 92vw);

				ul {
					margin: 0;
					padding: 0;
					list-style: none;
				}

				.targets {
					--row-inset: 0.75rem;
					display: flex;
					flex-direction: column;
					gap: 0.125rem;
					max-block-size: min(50vh, 20rem);
					overflow-y: auto;

					.account {
						margin-block: 0.75rem 0.25rem;
						padding-inline-start: var(--row-inset);
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);

						&:first-child {
							margin-block-start: 0;
						}
					}

					button {
						inline-size: 100%;
						justify-content: start;
						gap: 0.5rem;
						padding-inline: var(--row-inset);
						background: transparent;
						border-color: transparent;

						.name {
							flex: 1;
							text-align: start;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> mitra-icon:last-child {
							color: var(--color-text-muted);
						}
					}
				}

				.journey {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.75rem;
					padding: 0.875rem 1rem;
					border: var(--border);
					border-radius: var(--border-radius);
					background: color-mix(in srgb, var(--color-text) 3%, transparent);

					.end {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						min-inline-size: 0;
						font-size: 0.875rem;
						font-weight: 600;

						.name {
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}
					}

					.arrow {
						flex-shrink: 0;
						color: var(--color-text-muted);

						&:dir(rtl) {
							scale: -1 1;
						}
					}
				}

				.lead {
					margin: 0;
					font-size: 0.9375rem;
					font-weight: 600;
					text-wrap: balance;
				}

				.report {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
					font-size: 0.8125rem;

					li {
						display: flex;
						align-items: start;
						gap: 0.5rem;
					}

					mitra-icon {
						margin-block-start: 0.0625rem;
						flex-shrink: 0;
					}

					.clean mitra-icon {
						color: var(--color-text);
					}

					.loss mitra-icon {
						color: var(--color-text-muted);
					}

					.blocked mitra-icon {
						color: var(--color-error);
					}

					.names {
						display: block;
						margin-block-start: 0.125rem;
						color: var(--color-text-muted);
					}
				}

				.assurance {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin: 0;
					font-size: 0.75rem;
					color: var(--color-text-muted);

					mitra-icon {
						flex-shrink: 0;
					}
				}

				.hint {
					margin: 0;
					font-size: 0.75rem;
					color: var(--color-text-muted);
					text-wrap: pretty;
				}

				.failure {
					margin: 0;
					font-size: 0.8125rem;
					color: var(--color-error);
					text-wrap: pretty;
				}

				.count {
					display: block;
					margin-block-start: 0.125rem;
					font-weight: 400;
					color: var(--color-text-muted);
				}

				.waiting,
				.outcome {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.75rem;
					text-align: center;
					padding-block: 0.5rem;
				}

				.progress {
					inline-size: min(14rem, 60%);
					block-size: 2px;
					border-radius: 999px;
					background: color-mix(in srgb, var(--color-text) 10%, transparent);
					overflow: clip;

					&::after {
						content: '';
						display: block;
						block-size: 100%;
						inline-size: 25%;
						border-radius: inherit;
						background: var(--color-text);
						animation: migration-progress 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite;
					}

					@media (prefers-reduced-motion: reduce) {
						&::after {
							inline-size: 100%;
							opacity: 0.35;
							animation: none;
						}
					}
				}

				.mark {
					inline-size: 3rem;
					block-size: 3rem;
					border-radius: 50%;
					display: grid;
					place-items: center;
					font-size: 1.375rem;
					background: color-mix(in srgb, currentColor 12%, transparent);

					@media (prefers-reduced-motion: no-preference) {
						animation: migration-mark 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
					}

					&[data-failed] {
						color: var(--color-error);
					}
				}

				.outcome {
					.headline {
						margin: 0;
						font-size: 1rem;
						font-weight: 650;
						text-wrap: balance;
					}

					.detail {
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
						font-size: 0.8125rem;
						color: var(--color-text-muted);
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${this.heading}>
				${!this.target || this.reported || this.running ? html.nothing : html`
					<mitra-icon-button slot="leading" icon="arrow-left" label=${t('Back')} @click=${() => this.back()}></mitra-icon-button>
				`}
				${this.body}
			</mitra-dialog>
		`
	}

	private get body() {
		if (this.reported) {
			return this.outcomeTemplate(this.migration.value!)
		}
		return this.preview.render({
			initial: () => this.targetTemplate,
			pending: () => this.waitingTemplate(this.canMove ? t('Checking what would move…') : t('Checking what would be copied…')),
			error: error => html`<p class="failure">${error instanceof Error ? error.message : String(error)}</p>`,
			complete: plan => this.running ? this.runningTemplate(plan)
				: this.asksSeries(plan) ? this.seriesTemplate(plan)
					: this.planTemplate(plan),
		})
	}

	private get targetTemplate() {
		const targets = this.targets
		return !targets.length ? html`
			<p class="hint">${t('There is no other calendar these entries could move to.')}</p>
		` : html`
			<p class="hint">${this.canMove
				? t('Every entry in ${name} moves — the ones the chosen calendar cannot take stay here.', { name: this.source.name })
				: t('Every entry in ${name} is copied — the ones the chosen calendar cannot take are left out. ${name} itself is read-only and stays exactly as it is.', { name: this.source.name })}</p>
			<ul class="targets">
				${targets.map(({ integration, sources }) => html`
					<li class="account">${integration.credentials?.username || integration.type}</li>
					${sources.map(source => html`
						<li>
							<button @click=${() => this.target = source}>
								<mitra-source-icon .source=${source}></mitra-source-icon>
								<span class="name">${source.name}</span>
								<mitra-icon icon="chevron-right"></mitra-icon>
							</button>
						</li>
					`)}
				`)}
			</ul>
		`
	}

	private get journeyTemplate() {
		return html`
			<div class="journey">
				<span class="end">
					<mitra-source-icon .source=${this.source}></mitra-source-icon>
					<span class="name">${this.source.name}</span>
				</span>
				<mitra-icon class="arrow" icon="arrow-right"></mitra-icon>
				<span class="end">
					<mitra-source-icon .source=${this.target}></mitra-source-icon>
					<span class="name">${this.target!.name}</span>
				</span>
			</div>
		`
	}

	private waitingTemplate(label: string) {
		return html`
			<div class="waiting">
				<div class="progress"></div>
				<p class="hint">${label}</p>
			</div>
		`
	}

	private runningTemplate(plan: MigrationPlan) {
		const count = plan.movingCount(this.flatten === true)
		return html`
			${this.journeyTemplate}
			${this.waitingTemplate(this.keepOriginals
			? t('Copying ${count:pluralityNumber} entries…', { count })
			: t('Moving ${count:pluralityNumber} entries…', { count }))}
		`
	}

	private seriesTemplate(plan: MigrationPlan) {
		const series = plan.flattenable
		const occurrences = series.reduce((total, verdict) => total + (verdict.occurrences ?? 0), 0)
		return html`
			<mitra-choices>
				<mitra-choice autofocus icon="repeat" @click=${() => this.flatten = false}>
					${t('Leave them here')}
					<span class="count">${t('${count:pluralityNumber} entries', { count: series.length })}</span>
				</mitra-choice>
				<mitra-choice icon="copy" @click=${() => this.flatten = true}>
					${t('Flatten into single entries')}
					<span class="count">${t('${count:pluralityNumber} entries', { count: occurrences })}</span>
				</mitra-choice>
			</mitra-choices>
			<p class="hint">${t('Flattening writes out a year of occurrences as separate entries. They stop repeating, and links pointing at the series are left behind.')}</p>
		`
	}

	private planTemplate(plan: MigrationPlan) {
		const flatten = this.flatten === true
		const moving = plan.movingCount(flatten)
		const arriving = plan.creations(flatten)
		const blocked = plan.blocked(flatten)
		return html`
			${this.journeyTemplate}
			<p class="lead">${this.canMove
			? t('${count:pluralityNumber} of ${total:number} entries move', { count: moving, total: plan.total })
			: t('${count:pluralityNumber} of ${total:number} entries are copied', { count: moving, total: plan.total })}</p>
			<ul class="report">
				${!plan.cleanCount ? html.nothing : html`
					<li class="clean">
						<mitra-icon icon="check"></mitra-icon>
						${plan.cleanCount === plan.total
				? t('Everything travels intact')
				: t('${count:pluralityNumber} arrive with everything they carry', { count: plan.cleanCount })}
					</li>
				`}
				${plan.losses.map(([loss, count]) => html`
					<li class="loss">
						<mitra-icon icon="minus"></mitra-icon>
						${MigrationPlan.lossLabel(loss, count, this.target!)}
					</li>
				`)}
				${plan.blockers(flatten).map(([blocker, count]) => html`
					<li class="blocked">
						<mitra-icon icon="ban"></mitra-icon>
						<span>
							${this.canMove
						? t('${reason} and stay here', { reason: MigrationPlan.blockerLabel(blocker, count) })
						: t('${reason} and are left out', { reason: MigrationPlan.blockerLabel(blocker, count) })}
							${!blocked.length ? html.nothing : this.namesTemplate(blocked)}
						</span>
					</li>
				`)}
				${arriving === moving ? html.nothing : html`
					<li class="clean">
						<mitra-icon icon="copy"></mitra-icon>
						${t('${count:pluralityNumber} entries arrive, the flattened series included', { count: arriving })}
					</li>
				`}
			</ul>
			<p class="assurance">
				<mitra-icon icon="shield-check"></mitra-icon>
				${this.canMove
				? t('Nothing is deleted here until its copy has landed')
				: t('The originals stay exactly where they are')}
			</p>
			${this.migration.status !== TaskStatus.ERROR ? html.nothing : html`
				<p class="failure">${this.migration.error instanceof Error ? this.migration.error.message : String(this.migration.error)}</p>
			`}
			${!this.canMove ? html.nothing : html`
				<button slot="footer" ?disabled=${!moving}
					title=${t('Leave the originals here and add a copy over there')}
					@click=${() => this.start(true)}>
					${t('Copy instead')}
				</button>
			`}
			<button slot="footer" class="primary" ?disabled=${!moving} @click=${() => this.start(!this.canMove)}>
				${this.canMove ? t('Move ${count:pluralityNumber} entries', { count: moving }) : t('Copy ${count:pluralityNumber} entries', { count: moving })}
			</button>
		`
	}

	private namesTemplate(blocked: ReadonlyArray<MigrationVerdict>) {
		const named = blocked.slice(0, NAMED_BLOCKED).map(verdict => verdict.heading || t('Untitled')).join(', ')
		const rest = blocked.length - NAMED_BLOCKED
		return html`<span class="names">${rest <= 0 ? named : t('${names} and ${count:pluralityNumber} more', { names: named, count: rest })}</span>`
	}

	private outcomeTemplate(outcome: MigrationOutcome) {
		return html`
			<div class="outcome">
				<span class="mark" ?data-failed=${outcome.aborted} style=${outcome.aborted ? '' : `color: ${this.target!.color ?? ''}`}>
					<mitra-icon icon=${outcome.aborted ? 'alert-triangle' : 'check'}></mitra-icon>
				</span>
				${outcome.aborted ? this.abortedTemplate(outcome) : html`
					<p class="headline">${this.keepOriginals
					? t('${count:pluralityNumber} entries copied to ${name}', { count: outcome.created, name: this.target!.name })
					: t('${count:pluralityNumber} entries moved to ${name}', { count: outcome.moved, name: this.target!.name })}</p>
					${!outcome.left && !outcome.duplicates ? html.nothing : html`
						<div class="detail">
							${!outcome.left ? html.nothing : html`<span>${t('${count:pluralityNumber} stayed in ${name}', { count: outcome.left, name: this.source.name })}</span>`}
							${!outcome.duplicates ? html.nothing : html`
								<span>${t('${count:pluralityNumber} are now in both calendars', { count: outcome.duplicates })}</span>
								<span>${t('Their copies landed but the originals could not be deleted — delete them here by hand.')}</span>
							`}
						</div>
					`}
				`}
			</div>
		`
	}

	private abortedTemplate(outcome: MigrationOutcome) {
		return html`
			<p class="headline">${t('Every entry is still in ${name}. Nothing was deleted.', { name: this.source.name })}</p>
			<div class="detail">
				<span class="failure">${!outcome.failedEntry
				? outcome.failure
				: t('"${heading}" could not be copied: ${message}', { heading: outcome.failedEntry, message: outcome.failure ?? '' })}</span>
				${!outcome.duplicates ? html.nothing : html`
					<span>${t('${count:pluralityNumber} copies could not be taken back and are now in both calendars.', { count: outcome.duplicates })}</span>
				`}
			</div>
		`
	}

	protected override primaryAction() {
		return undefined
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-source-migration': DialogSourceMigration
	}
}
