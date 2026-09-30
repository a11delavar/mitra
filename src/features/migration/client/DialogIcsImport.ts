import { component, html, css, state } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { Task, TaskStatus, initialState } from '@lit/task'
import { getCapabilities, getIntegrations, importIcs, previewIcsImport } from '../../../infrastructure/http/Api.js'
import { MigrationPlan, type MigrationOutcome, type MigrationVerdict } from '../MigrationPlan.js'
import { type Source } from '../../sources/Source.js'
import { pressable } from '../../../design/pressable.css.js'
import { activated } from '../../../design/activated.css.js'
import { controlHeight } from '../../../design/controlHeight.css.js'

const NAMED_BLOCKED = 5

/** Dialog to add the entries of an opened .ics file to a chosen calendar with fidelity preview. */
@component('mitra-dialog-ics-import')
export class DialogIcsImport extends DialogComponent<{ readonly fileName: string, readonly ics: string }, void> {
	@state() private target?: Source

	private readonly preview = new Task(this, {
		args: () => [this.target?.id] as const,
		task: ([targetId]) => !targetId ? initialState : previewIcsImport(targetId, this.parameters.ics),
	})

	private readonly importer = new Task(this, {
		autoRun: false,
		task: () => importIcs(this.target!.id, this.parameters.ics),
	})

	protected override createRenderRoot() { return this }

	private get running() { return this.importer.status === TaskStatus.PENDING }

	private get reported() { return this.importer.status === TaskStatus.COMPLETE }

	/** Available destination sources (writable, enabled). */
	private get targets() {
		return getIntegrations()
			.map(integration => ({
				integration,
				sources: [...integration.sources].filter(source => source.enabled && getCapabilities(source.id).createEntries),
			}))
			.filter(({ sources }) => sources.length)
	}

	private get heading() {
		if (this.reported) {
			return this.importer.value!.aborted ? t('Nothing was added') : t('Added to ${name}', { name: this.target!.name })
		}
		if (!this.target) {
			return t('Add ${name} to a calendar', { name: this.parameters.fileName })
		}
		return t('Add to ${name}', { name: this.target.name })
	}

	static override get styles() {
		// The migration-mark keyframes come from DialogSourceMigration's styles: both land in the one global sheet.
		return css`
			mitra-dialog-ics-import {
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
						${pressable};
						${controlHeight};
						display: flex;
						align-items: center;
						inline-size: 100%;
						min-block-size: var(--control-height);
						gap: 0.5rem;
						padding-inline: var(--row-inset);
						border-radius: var(--border-radius);
						font-size: 0.8125rem;
						transition: background 0.15s ease;

						&:hover {
							${activated};
						}

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

						> mitra-icon {
							flex-shrink: 0;
							color: var(--color-text-muted);
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

				.waiting,
				.outcome {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.75rem;
					text-align: center;
					padding-block: 0.5rem;
				}

				mitra-progress {
					inline-size: min(14rem, 60%);
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
					<mitra-icon-button slot="leading" icon="arrow-left" label=${t('Back')} @click=${() => this.target = undefined}></mitra-icon-button>
				`}
				${this.body}
			</mitra-dialog>
		`
	}

	private get body() {
		if (this.reported) {
			return this.outcomeTemplate(this.importer.value!)
		}
		return this.preview.render({
			initial: () => this.targetTemplate,
			pending: () => this.waitingTemplate(t('Checking what the calendar can take…')),
			error: error => html`<p class="failure">${error instanceof Error ? error.message : String(error)}</p>`,
			complete: plan => this.running ? this.runningTemplate(plan) : this.planTemplate(plan),
		})
	}

	private get targetTemplate() {
		const targets = this.targets
		return !targets.length ? html`
			<p class="hint">${t('There is no calendar the file could be added to.')}</p>
		` : html`
			<p class="hint">${t('Choose the calendar the entries of this file are added to — the ones it cannot take are left out. The file itself stays untouched.')}</p>
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
					<mitra-icon icon="file"></mitra-icon>
					<span class="name">${this.parameters.fileName}</span>
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
				<mitra-progress></mitra-progress>
				<p class="hint">${label}</p>
			</div>
		`
	}

	private runningTemplate(plan: MigrationPlan) {
		return html`
			${this.journeyTemplate}
			${this.waitingTemplate(t('Adding ${count:pluralityNumber} entries…', { count: plan.movingCount(false) }))}
		`
	}

	private planTemplate(plan: MigrationPlan) {
		const adding = plan.movingCount(false)
		const blocked = plan.blocked(false)
		return html`
			${this.journeyTemplate}
			<p class="lead">${t('${count:pluralityNumber} of ${total:number} entries are added', { count: adding, total: plan.total })}</p>
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
				${plan.blockers(false).map(([blocker, count]) => html`
					<li class="blocked">
						<mitra-icon icon="ban"></mitra-icon>
						<span>
							${t('${reason}, left out', { reason: MigrationPlan.blockerLabel(blocker, count) })}
							${!blocked.length ? html.nothing : this.namesTemplate(blocked)}
						</span>
					</li>
				`)}
			</ul>
			<p class="assurance">
				<mitra-icon icon="shield-check"></mitra-icon>
				${t('The file stays exactly as it is')}
			</p>
			${this.importer.status !== TaskStatus.ERROR ? html.nothing : html`
				<p class="failure">${this.importer.error instanceof Error ? this.importer.error.message : String(this.importer.error)}</p>
			`}
			<mitra-button slot="footer" variant="primary" ?disabled=${!adding} @click=${() => void this.importer.run()}>
				${t('Add ${count:pluralityNumber} entries', { count: adding })}
			</mitra-button>
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
					<p class="headline">${t('${count:pluralityNumber} entries added to ${name}', { count: outcome.created, name: this.target!.name })}</p>
					${!outcome.left ? html.nothing : html`
						<div class="detail">
							<span>${t('${count:pluralityNumber} were left out', { count: outcome.left })}</span>
						</div>
					`}
				`}
			</div>
		`
	}

	private abortedTemplate(outcome: MigrationOutcome) {
		return html`
			<p class="headline">${t('Nothing from the file was added.')}</p>
			<div class="detail">
				<span class="failure">${!outcome.failedEntry
				? outcome.failure
				: t('"${heading}" could not be added: ${message}', { heading: outcome.failedEntry, message: outcome.failure ?? '' })}</span>
				${!outcome.duplicates ? html.nothing : html`
					<span>${t('${count:pluralityNumber} landed anyway and could not be taken back — delete them in ${name} by hand.', { count: outcome.duplicates, name: this.target!.name })}</span>
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
		'mitra-dialog-ics-import': DialogIcsImport
	}
}
