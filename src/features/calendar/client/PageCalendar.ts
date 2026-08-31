import { component, html, state, css, eventListener, bind, query, queryAll, choose } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { DateTime } from '@3mo/date-time'
import { MediaQueryController } from '@3mo/media-query-observer'
import { transitionCalendar, type CalendarTransitionType } from './calendarTransition.js'
import type { EntrySegmentComponent } from '../../entries/client/EventSegment.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { EntryFetcherController } from '../../entries/client/EntryFetcherController.js'
import { CommandPalette } from '../../commands/client/CommandPalette.js'
import { commandInstances, sourceCommands, settingCommands } from '../../../app/commands.js'
import { type CalendarView } from '../CalendarView.js'
import { DefaultViewSetting } from './DefaultViewSetting.js'
import type { Sidebar } from '../../../app/Sidebar.js'
import { windowDragHandle } from '../../../design/windowDrag.css.js'

@component('mitra-page-calendar')
@route('/')
export class PageCalendar extends PageComponent {
	private static readonly customizableSelectsSupported = CSS.supports('appearance', 'base-select')

	@state() navigatingDate = new DateTime()
	@state() view: CalendarView = DefaultViewSetting.current
	@state() sidebarOpen = PageCalendar.preferredSidebarOpen

	readonly mediaController = new MediaQueryController(this, '(min-width: 800px)', () => this.sidebarOpen = PageCalendar.preferredSidebarOpen)

	private static get preferredSidebarOpen() {
		return window.matchMedia('(min-width: 800px)').matches && localStorage.getItem('Mitra.SidebarCollapsed') !== 'true'
	}

	readonly toggleSidebar = () => {
		this.sidebarOpen = !this.sidebarOpen
		if (this.mediaController.matches) {
			localStorage.setItem('Mitra.SidebarCollapsed', String(!this.sidebarOpen))
		}
	}

	@queryAll('mitra-entry-segment') readonly eventSegments!: Array<EntrySegmentComponent>

	@query('.calendar') private readonly calendar!: HTMLElement

	setView(value: CalendarView) {
		if (this.view === value) {
			return
		}
		this.transition('view-switch', () => { this.view = value })
	}

	private transition(type: CalendarTransitionType, change: () => unknown) {
		transitionCalendar(this.calendar, type, async () => {
			await change()
			await this.updateComplete
			await Promise.all(this.eventSegments.map(e => e.updateComplete))
		})
	}

	readonly fetcher = new EntryFetcherController(this)
	readonly store = new EntryStore(this)

	@query('mitra-command-palette') private readonly palette!: CommandPalette
	@query('mitra-sidebar') private readonly sidebar?: Sidebar
	@query('input.goto-date') private readonly gotoDateInput!: HTMLInputElement

	get commands() { return commandInstances() }

	private get paletteCommands() {
		return [...sourceCommands(), ...this.commands, ...settingCommands()]
	}

	readonly sourcesChanged = () => {
		this.sidebar?.requestUpdate()
		this.transition('source-toggle', () => this.fetcher.task.run())
	}

	/** Updates sidebar and calendar when source metadata or import state changes without transition. */
	readonly sourcesRefreshed = () => {
		this.sidebar?.requestUpdate()
		this.requestUpdate()
	}

	get navigationStep() {
		return this.view === 'week' ? { weeks: 1 } : this.view === 'year' ? { years: 1 } : { months: 1 }
	}

	/** Trigger native date picker for the Go to Date command. */
	goToDate() {
		const input = this.gotoDateInput
		const date = this.navigatingDate
		input.value = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
		try {
			input.showPicker()
		} catch {
			input.focus()
		}
	}

	private handleGoToDate(e: Event) {
		const value = (e.target as HTMLInputElement).value
		if (value) {
			this.navigatingDate = new DateTime(`${value}T00:00:00`)
		}
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleKeyDown(e: KeyboardEvent) {
		const target = e.target
		const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
			|| target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
		if (editable || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
			return
		}

		if (e.composedPath().some(node => node instanceof HTMLDialogElement)) {
			return
		}

		if (e.key === '/') {
			e.preventDefault()
			this.palette.show()
			return
		}

		const command = this.commands.find(command => command.matches(e))
		if (command) {
			e.preventDefault()
			command.dispatch()
		}
	}

	static override get styles() {
		return css`
			lit-page {
				display: contents;
			}

			::view-transition {
				pointer-events: none;
			}

			mitra-page-calendar {
				padding: 0 !important;
				background-color: var(--color-background);
				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				display: flex;
				flex-direction: row;
				position: absolute;
				inset: 0;
				overflow: clip;

				main {
					display: flex;
					flex-direction: column;
					flex: 1;
					min-width: 0;
					min-height: 0;
					container-type: inline-size;

					> header {
						container-type: inline-size;
						display: flex;
						align-items: center;
						gap: 0.75rem;
						padding: 0.75rem 1.25rem;

						@media (display-mode: window-controls-overlay) {
							box-sizing: border-box;
							min-height: env(titlebar-area-height, auto);
							padding-inline-end: calc(1.25rem + (100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)));
							${windowDragHandle};

							.leading, .trailing, h1 {
								-webkit-app-region: drag;
							}
						}

						@container (max-width: 40rem) {
							kbd {
								display: none;
							}
						}

						.leading, .trailing {
							flex: 1 0 0;
							min-width: 0;
							display: flex;
							align-items: center;
							gap: 0.75rem;
						}

						.trailing {
							justify-content: flex-end;
						}

						h1 {
							padding: 0;
							margin: 0;
							font-size: 1.125rem;
							font-weight: 700;
							letter-spacing: -0.01em;
							color: var(--color-text);
							white-space: nowrap;
						}

						.toggle {
							font-size: 20px;
						}

						.today {
							mitra-icon {
								display: none;
								font-size: 1rem;
							}

							@container (max-width: 40rem) {
								mitra-icon {
									display: inline-flex;
								}

								span {
									display: none;
								}
							}
						}

						select {
							> button > mitra-icon {
								display: none;
								font-size: 1rem;
							}

							@container (max-width: 40rem) {
								> button > mitra-icon {
									display: inline-flex;
								}

								> button > selectedcontent {
									display: none;
								}
							}
						}

						.search {
							width: 18rem;
							flex-shrink: 0;
							justify-content: flex-start;
							border-radius: calc(2 * var(--border-radius));
							font-weight: 400;

							span {
								flex: 1;
								text-align: start;
								white-space: nowrap;
								overflow: hidden;
								color: var(--color-text-muted);
							}

							@container (max-width: 44rem) {
								width: auto;
								border-radius: var(--border-radius);

								span, kbd {
									display: none;
								}
							}
						}

						@container (max-width: 44rem) {
							.trailing {
								flex: none;
							}
						}
					}

					.calendar {
						flex: 1;
						min-width: 0;
						min-height: 0;
						display: flex;
						flex-direction: column;
						contain: layout;
						overflow: clip;

						mitra-weeks, mitra-months, mitra-days, mitra-timeline {
							flex: 1;
							min-height: 0;
						}
					}
				}

				mitra-sidebar:not([open]) + main > header {
					@media (display-mode: window-controls-overlay) {
						padding-inline-start: calc(1.25rem + env(titlebar-area-x, 0px));
					}
				}

				input.goto-date {
					position: fixed;
					inset-block-start: 3.5rem;
					inset-inline-start: 50%;
					inline-size: 1px;
					block-size: 1px;
					padding: 0;
					border: none;
					opacity: 0;
					pointer-events: none;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<lit-page>
				<mitra-sidebar ?open=${bind(this, 'sidebarOpen')} @sourcesChange=${this.sourcesChanged}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-sidebar>
				<main>
					<header>
						<div class="leading">
							<mitra-icon-button class="toggle" icon="panel-left" label=${t('Toggle sidebar')} @click=${this.toggleSidebar}></mitra-icon-button>
							<h1>${this.navigatingDate.format(this.view === 'year' ? { year: 'numeric' } : { month: 'long', year: 'numeric' })}</h1>
						</div>
						<button class="search" title=${t('Search or run a command (${hotkey})', { hotkey: CommandPalette.hotkey })} @click=${() => this.palette.show()}>
							<mitra-icon icon="search"></mitra-icon>
							<span>${t('Search or run a command…')}</span>
							<kbd>${CommandPalette.hotkey}</kbd>
						</button>
						<div class="trailing">
							<select title=${t('View')} .value=${this.view} @change=${(e: Event) => this.setView((e.target as HTMLSelectElement).value as CalendarView)}>
								<button>
									<mitra-icon icon="calendar-cog"></mitra-icon>
									<selectedcontent></selectedcontent>
								</button>
								${[{ value: 'year', label: t('Year'), key: 'Y' }, { value: 'month', label: t('Month'), key: 'M' }, { value: 'week', label: t('Week'), key: 'W' }, { value: 'timeline', label: t('Timeline'), key: 'L' }].map(o => html`<option value=${o.value} ?selected=${o.value === this.view}>${o.label}${PageCalendar.customizableSelectsSupported ? html`<kbd>${o.key}</kbd>` : html.nothing}</option>`)}
							</select>
							<button class="today" @click=${() => this.navigatingDate = new DateTime()}>
								<mitra-icon icon="calendar-1"></mitra-icon>
								<span>${t('Today')}</span> <kbd>T</kbd>
							</button>
						</div>
					</header>
					<div class="calendar">
						${choose(this.view, [
							['week', () => html`
								<mitra-days
									.entries=${this.store.entries}
									.navigatingDate=${this.navigatingDate}
									@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
								></mitra-days>
							`],
							['month', () => html`
								<mitra-weeks
									.entries=${this.store.entries}
									.navigatingDate=${this.navigatingDate}
									@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
									@switchToWeek=${() => this.setView('week')}
								></mitra-weeks>
							`],
							['year', () => html`
								<mitra-months
									.entries=${this.store.entries}
									.navigatingDate=${this.navigatingDate}
									@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
									@switchToMonth=${() => this.setView('month')}
								></mitra-months>
							`],
							['timeline', () => html`
								<mitra-timeline
									.entries=${this.store.entries}
									.navigatingDate=${this.navigatingDate}
									@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
								></mitra-timeline>
							`]
						])}
					</div>
				</main>
				<mitra-command-palette
					.commands=${this.paletteCommands}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-command-palette>
				<input class="goto-date" type="date" aria-hidden="true" tabindex="-1" @change=${(e: Event) => this.handleGoToDate(e)}>
			</lit-page>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-page-calendar': PageCalendar
	}
}
