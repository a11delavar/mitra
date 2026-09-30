import { Component, component, html, css, property, event, query } from '@a11d/lit'
import { type Entry, type EntryRollup, TaskStatus } from '../Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'
import { offerToCloseSubtasks } from '../../relations/client/Hierarchy.js'
import { Relations } from '../../relations/client/Relations.js'
import { type Slider } from '../../../design/Slider.js'
import { type Menu } from '../../../design/Menu.js'

const order = [TaskStatus.ToDo, TaskStatus.Doing, TaskStatus.Done, TaskStatus.Cancelled] as const

/** The app's status glyphs, also worn by the dialogs that offer a status as a choice. */
export const taskStatusIcon = new Map<TaskStatus, string>([
	[TaskStatus.ToDo, 'square'],
	[TaskStatus.Doing, 'square-minus'],
	[TaskStatus.Done, 'square-check-big'],
	[TaskStatus.Cancelled, 'square-x'],
])

/** The app's status words, also read by the table's status column and filter. */
export function taskStatusLabel(status: TaskStatus): string {
	switch (status) {
		case TaskStatus.ToDo: return t('To Do')
		case TaskStatus.Doing: return t('Doing')
		case TaskStatus.Done: return t('Done')
		case TaskStatus.Cancelled: return t('Cancelled')
	}
}

const label = taskStatusLabel

/**
 * Task completion and status control.
 * Renders an interactive checkbox icon with anchored status and progress menu.
 */
@component('mitra-task-status')
export class TaskStatusComponent extends Component {
	@property({ type: Object }) entry!: Entry

	/** Fired after the entry's status or progress is mutated in place, so the host can persist and re-render. */
	@event() readonly change!: EventDispatcher

	readonly store = new EntryStore(this)

	protected override createRenderRoot() { return this }

	private get status() {
		const status = this.entry?.status ?? TaskStatus.ToDo
		if (status === TaskStatus.Done || status === TaskStatus.Cancelled) {
			return status
		}
		const progress = Relations.progressOf(this.entry)
		if (progress !== undefined && progress > 0 && progress < 1) {
			return TaskStatus.Doing
		}
		return status
	}

	private get progress() {
		return this.status === TaskStatus.Done ? 1 : Relations.progressOf(this.entry)
	}

	private get progressLabel() {
		const rollup = Relations.rollupOf(this.entry)
		if (rollup?.total) {
			return TaskStatusComponent.summarize(rollup)
		}
		const progress = this.progress
		return progress === undefined ? undefined : t('${percent} complete', { percent: Math.round(progress * 100).formatAsPercent() })
	}

	/** Formats progress summary label adapted by step type (subtasks, checklist items, or steps). */
	private static summarize(rollup: EntryRollup) {
		const done = String(rollup.done)
		if (!rollup.checklist.total) {
			return t('${done} of ${total:pluralityNumber} subtasks done', { done, total: rollup.total })
		}
		if (!rollup.subtasks.total) {
			return t('${done} of ${total:pluralityNumber} checklist items done', { done, total: rollup.total })
		}
		return t('${done} of ${total:pluralityNumber} steps done', { done, total: rollup.total })
	}

	@query('mitra-menu') private readonly menu?: Menu

	private commit(status: TaskStatus) {
		if (this.entry.status === status) {
			this.menu?.hide()
			return
		}
		this.entry.setStatus(status, getCapabilities(this.entry.sourceId))
		this.menu?.hide()
		this.requestUpdate()
		this.change.dispatch()
	}

	/** Opens leftover subtask closure prompt from the menu. */
	private readonly closeOutSubtasks = (e: Event) => {
		e.stopPropagation()
		this.menu?.hide()
		void offerToCloseSubtasks(this.entry).catch(() => void 0)
	}

	private readonly clearPercent = (e: Event) => {
		e.stopPropagation()
		this.entry.percentComplete = null
		if (this.entry.status === TaskStatus.Done) {
			this.entry.status = TaskStatus.ToDo
		}
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly handleSliderInput = (e: Event) => {
		e.stopPropagation()
		const val = (e.target as Slider).value
		this.entry.percentComplete = val
		if (val === 100 && this.entry.status !== TaskStatus.Done) {
			this.entry.status = TaskStatus.Done
		} else if (val < 100 && this.entry.status === TaskStatus.Done) {
			this.entry.status = val > 0 ? TaskStatus.Doing : TaskStatus.ToDo
		}
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly onToggle = (e: MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()
		if (e.altKey) {
			this.menu?.toggle(e.currentTarget as HTMLElement)
			return
		}
		this.commit(this.status === TaskStatus.Done ? TaskStatus.ToDo : TaskStatus.Done)
	}

	private readonly onContextMenu = (e: MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		this.menu?.toggle(e.currentTarget as HTMLElement)
	}

	private readonly pick = (status: TaskStatus) => (e: Event) => {
		e.stopPropagation()
		this.commit(status)
	}

	static override get styles() {
		return css`
			@keyframes dial-orbit {
				from {
					stroke-dashoffset: 0;
				}
				to {
					stroke-dashoffset: -100;
				}
			}

			mitra-task-status {
				display: inline-flex;
				flex-shrink: 0;
				position: relative;

				> button.status-button {
					all: unset;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					inline-size: 100%;
					block-size: 100%;
					cursor: pointer;
					color: inherit;
					box-sizing: border-box;

					svg, mitra-icon {
						inline-size: 100%;
						block-size: 100%;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: inherit;
					}

					svg {
						.progress-track {
							opacity: 0.6;
						}

						.progress-stroke {
							stroke-dashoffset: 0;
						}
					}
				}

				&[data-status='doing'] > button.status-button svg .progress-stroke {
					animation: dial-orbit 11s linear infinite;

					@media (prefers-reduced-motion: reduce) {
						animation: none;
					}
				}

				> mitra-menu {
					min-inline-size: 11.5rem;

					.progress-section {
						margin-block-start: 0.375rem;
						padding-block-start: 0.375rem;
						border-block-start: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
						display: flex;
						flex-direction: column;
						gap: 0.375rem;
						padding-inline: 0.375rem;

						.progress-header {
							display: flex;
							align-items: center;
							justify-content: space-between;
							font-size: 0.75rem;
							color: var(--color-text-muted);
							min-block-size: 1.25rem;

							.value-group {
								display: flex;
								align-items: center;
								gap: 0.25rem;
								min-block-size: 1.25rem;

								.clear {
									color: var(--color-text-muted);
									margin-block: -0.25rem;
								}
							}

							.value {
								font-variant-numeric: tabular-nums;
								font-weight: 600;
								color: var(--color-text);

								&.none {
									font-weight: 400;
									color: var(--color-text-muted);
								}
							}
						}

						mitra-slider {
							margin-block-end: -0.25rem;
						}

						&.subtasks {
							mitra-progress {
								margin-block: 0.125rem;
							}

							.progress-summary {
								display: flex;
								align-items: center;
								gap: 0.375rem;
								padding-block-start: 0.125rem;
								font-size: 0.75rem;
								color: var(--color-text-muted);

								mitra-icon {
									font-size: 0.8125rem;
								}

								&.leftover {
									all: unset;
									display: flex;
									align-items: center;
									gap: 0.375rem;
									padding: 0.1875rem 0.25rem;
									margin-inline: -0.25rem;
									border-radius: 4px;
									cursor: pointer;
									font-size: 0.75rem;
									color: var(--color-text-muted);
									box-sizing: border-box;

									&:hover, &:focus-visible {
										color: var(--color-text);
										background: color-mix(in srgb, var(--color-text) 10%, transparent);
									}

									> .go {
										margin-inline-start: auto;
									}
								}
							}
						}
					}
				}

			}
		`
	}

	private get progressSectionTemplate() {
		const rollup = Relations.rollupOf(this.entry)
		if (rollup?.total) {
			// RFC 5545 §3.8.1.8: a completed task reads 100%.
			const value = Math.round((this.progress ?? rollup.progress) * 100)
			const leftover = this.entry.closed && rollup.subtasks.done < rollup.subtasks.total
			const summary = TaskStatusComponent.summarize(rollup)
			return html`
				<div class="progress-section subtasks">
					<div class="progress-header">
						<span>${t('Progress')}</span>
						<span class="value">${value.formatAsPercent()}</span>
					</div>
					<mitra-progress .value=${value / 100}></mitra-progress>
					${!leftover ? html`
						<div class="progress-summary">
							<mitra-icon icon="chart-pie"></mitra-icon>
							<span>${summary}</span>
						</div>
					` : html`
						<button class="progress-summary leftover" title=${t('Close out the subtasks that are still open')}
							@click=${this.closeOutSubtasks}>
							<mitra-icon icon="chart-pie"></mitra-icon>
							<span>${summary}</span>
							<mitra-icon class="go" icon="chevron-right"></mitra-icon>
						</button>
					`}
				</div>
			`
		}

		if (!getCapabilities(this.entry.sourceId).percentComplete) {
			return html.nothing
		}

		const progress = this.progress
		const value = progress === undefined ? 0 : Math.round(progress * 100)
		return html`
			<div class="progress-section custom">
				<div class="progress-header">
					<span>${t('Progress')}</span>
					${progress === undefined ? html`
						<span class="value none">${t('None')}</span>
					` : html`
						<div class="value-group">
							<span class="value">${value.formatAsPercent()}</span>
							<mitra-icon-button size="small" class="clear" icon="x" label=${t('Clear custom progress')} @click=${this.clearPercent}></mitra-icon-button>
						</div>
					`}
				</div>
				<mitra-slider label=${t('Progress')} step="5" .value=${value}
					@input=${this.handleSliderInput}
					@click=${(e: Event) => e.stopPropagation()}
				></mitra-slider>
			</div>
		`
	}

	protected override get template() {
		if (!this.entry?.type.isTask) {
			return html.nothing
		}

		this.setAttribute('data-status', this.status)

		const readout = this.progressLabel
		const name = readout ? `${label(this.status)} (${readout})` : label(this.status)
		const progress = this.progress
		const showsProgressDial = this.status === TaskStatus.Doing || (progress !== undefined && progress > 0 && progress < 1 && this.status !== TaskStatus.Done && this.status !== TaskStatus.Cancelled)
		const percent = progress !== undefined ? Math.round(progress * 100) : 50

		const editable = getCapabilities(this.entry.sourceId).editEntries

		return html`
			<button class="status-button" aria-label=${name} ?disabled=${!editable}
				title=${editable ? t('${status}. Click to toggle, Alt-click for options', { status: name }) : name}
				@click=${this.onToggle}
				@contextmenu=${this.onContextMenu}>
				${showsProgressDial ? html`
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect class="progress-track" x="3" y="3" width="18" height="18" rx="2"/>
						<rect class="progress-stroke" x="3" y="3" width="18" height="18" rx="2"
							pathLength="100"
							stroke-dasharray="${percent} ${100 - percent}"
							transform="rotate(-90 12 12)"/>
						<line x1="8" y1="12" x2="16" y2="12" stroke-width="2"/>
					</svg>
				` : html`
					<mitra-icon icon=${taskStatusIcon.get(this.status)!}></mitra-icon>
				`}
			</button>
			<mitra-menu>
				${order.filter(status => status !== TaskStatus.Cancelled || getCapabilities(this.entry.sourceId).cancelledStatus).map(status => html`
					<mitra-menu-item type="radio" icon=${taskStatusIcon.get(status)!} ?selected=${status === this.status} @click=${this.pick(status)}>${label(status)}</mitra-menu-item>
				`)}
				${this.progressSectionTemplate}
			</mitra-menu>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-task-status': TaskStatusComponent
	}
}
