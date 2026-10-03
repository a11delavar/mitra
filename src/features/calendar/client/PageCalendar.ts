import { component, html, state, css, eventListener, bind, query, queryAll, choose, type PropertyValues } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { type DateTime } from '@3mo/date-time'
import { MediaQueryController } from '@3mo/media-query-observer'
import { transitionCalendar, type CalendarTransitionType } from './calendarTransition.js'
import type { EntrySegmentComponent } from '../../entries/client/EventSegment.js'
import type { Entry } from '../../entries/Entry.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { EntryFetcherController } from '../../entries/client/EntryFetcherController.js'
import { CommandPalette } from '../../commands/client/CommandPalette.js'
import { commandInstances, sourceCommands, settingCommands } from '../../../app/commands.js'
import { type Command } from '../../commands/Command.js'
import { GoToToday, NextPeriod, PreviousPeriod } from './navigationCommands.js'
import { CreateEntry } from '../../entries/client/commands.js'
import { type CalendarView } from '../CalendarView.js'
import { CalendarLocation, type CalendarParameters } from './CalendarLocation.js'
import { DefaultViewSetting } from './DefaultViewSetting.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { DialogSettings, type SettingsParameters } from '../../settings/client/DialogSettings.js'
import { type SettingsPageId } from '../../settings/client/Setting.js'
import { UrlSyncController } from '../../../infrastructure/routing/UrlSyncController.js'
import type { Sidebar } from '../../../app/Sidebar.js'
import { windowDragHandle } from '../../../design/windowDrag.css.js'
import { CalendarPeriod } from './CalendarPeriod.js'
import { TableWindow } from './TableWindow.js'
import { startedInField } from '../../../design/eventOrigin.js'
import { type Popover } from '../../../design/Popover.js'

// The view is the path (`/week`), everything open on top of it is a query parameter. `/` stays a valid
// entry point (the PWA start URL and the OAuth redirect both land there) and canonicalizes on arrival.
@component('mitra-page-calendar')
@route('/:view', '/')
export class PageCalendar extends PageComponent<CalendarParameters> {
	private static get opened() {
		return CalendarLocation.of(globalThis.location, DefaultViewSetting.current)
	}

	@state() navigatingDate = PageCalendar.opened.date
	@state() view: CalendarView = PageCalendar.opened.view
	@state() private settingsPage?: SettingsPageId
	@state() sidebarOpen = PageCalendar.preferredSidebarOpen

	readonly mediaController = new MediaQueryController(this, '(min-width: 800px)', () => this.sidebarOpen = PageCalendar.preferredSidebarOpen)

	private static get preferredSidebarOpen() {
		return window.matchMedia('(min-width: 800px)').matches && localStorage.getItem('Mitra.SidebarCollapsed') !== 'true'
	}

	/**
	 * An entry no view has taken (`reveal`): one edited in the sidebar goes to the view, which follows it there, and one
	 * left without a start goes to the planning list, so neither it nor its open editor vanishes.
	 */
	@eventListener('reveal')
	protected handleReveal(e: CustomEvent<Entry>) {
		const entry = e.detail
		if (entry.start) {
			this.querySelector('.calendar')?.firstElementChild?.dispatchEvent(new CustomEvent('reveal', { detail: entry }))
		} else {
			this.sidebarOpen = true
			void this.sidebar?.showPlanning(entry)
		}
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

	private get location() {
		return new CalendarLocation(this.view, this.navigatingDate, EntryEditorIntent.target, this.settingsPage)
	}

	/** The URL derives from live state; `parameters` is never written back. It is only the router's
	 * message that a navigation arrived, so there is no bag to keep mirrored. */
	override get url() {
		return this.location.url()
	}

	private readonly urlSync = new UrlSyncController(this)

	/** The framework's own parameter hook lands here too, so this is the single funnel for URL writes.
	 * Replacing rather than pushing is the point: scrolling re-anchors the day continuously, and an
	 * entry per flick would bury the page the user arrived from. Collapses to a declared
	 * `historyStrategy` once @a11d/lit-application ships one. */
	protected override updateUrl() {
		this.urlSync.schedule()
	}

	protected override updated(props: PropertyValues) {
		super.updated(props)
		if (props.has('parameters')) {
			// Read from the address bar, not from `parameters`: the router hands on the path's parameters from when the
			// page was navigated to (the view before an in-app switch), and only the query as it stands.
			const location = CalendarLocation.of(globalThis.location, DefaultViewSetting.current)
			if (this.urlSync.arrived(location.url())) {
				this.restore(location)
			}
		}
	}

	/** Restores navigation and modal state from arriving URL parameters, on load or history navigation.
	 * Everything it sets is guarded, so the router re-delivering the current URL is a no-op. */
	private restore(location: CalendarLocation) {
		this.view = location.view
		if (!this.navigatingDate.dayStart.equals(location.date.dayStart)) {
			this.navigatingDate = location.date
		}
		if (location.selected && location.selected !== EntryEditorIntent.target) {
			EntryEditorIntent.requestOpen(location.selected)
		}
		if (location.settings && !this.settingsPage) {
			void this.openSettings({ page: location.settings }).catch(() => undefined)
		}
	}

	/** Opens settings dialog and mirrors active settings page to URL. */
	async openSettings(parameters: SettingsParameters = {}) {
		try {
			return await new DialogSettings({ ...parameters, pageChange: v => this.settingsPage = v }).confirm()
		} finally {
			this.settingsPage = undefined
		}
	}

	readonly fetcher = new EntryFetcherController(this)
	readonly store = new EntryStore(this)

	@query('mitra-command-palette') private readonly palette!: CommandPalette
	@query('mitra-sidebar') private readonly sidebar?: Sidebar
	@query('mitra-popover.goto-date') private readonly gotoDate!: Popover

	get commands() { return commandInstances() }

	/** The header's buttons are the commands' own, so they read and act as the keys do. */
	private command<T extends Command>(type: abstract new () => T) {
		return this.commands.find((command): command is T => command instanceof type)
	}

	/** What the header names and one step moves by. The table has none: it lists a window counted from today. */
	get period() {
		return CalendarPeriod.ofView(this.view)
	}

	/** A week also names its number, the one of its center day in the week view, so each step changes the heading. */
	private get headingTemplate() {
		const { period, navigatingDate: date } = this
		if (!period) {
			return html`<h1>${TableWindow.current.label}</h1>`
		}
		const week = period.kind === 'week' ? date.weekOfYear : undefined
		return html`
			<h1>
				<span class="name">${period.title(date)}</span>
				<span class="name short">${period.title(date, 'short')}</span>
				${week === undefined ? html.nothing : html`<span class="week">${t('Week ${week:number}', { week })}</span>`}
			</h1>
		`
	}

	private commandButton(type: abstract new () => Command, { className, icon, label }: { className: string, icon: string, label?: string }) {
		const command = this.command(type)
		if (!command) {
			return html.nothing
		}
		const keys = command.keyLabels?.join(' ')
		const title = keys ? `${command.heading} (${keys})` : command.heading
		return !label ? html`
			<mitra-icon-button class=${className} variant="default" icon=${icon} label=${command.heading} title=${title} @click=${() => void command.dispatch()}></mitra-icon-button>
		` : html`
			<mitra-button class=${className} title=${title} @click=${() => void command.dispatch()}>
				<mitra-icon icon=${icon}></mitra-icon>
				<span>${label}</span> <kbd>${keys}</kbd>
			</mitra-button>
		`
	}

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

	/** Opens a month to pick a day from under the heading, for the Go to Date command. */
	goToDate() {
		this.gotoDate.show(this.querySelector('main > header h1') ?? undefined)
		this.gotoDate.querySelector('mitra-date-picker')?.focus()
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleKeyDown(e: KeyboardEvent) {
		if (startedInField(e) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
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
				font-family: var(--font-family);
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

						/* Before the window-controls rule, whose end padding clears the title bar buttons. */
						@container (max-width: 40rem) {
							gap: 0.5rem;
							padding-inline: 1rem;
						}

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

						/* Equal shares center the search. Neither side gives up its content for it: the search box shrinks first. */
						.leading, .trailing {
							flex: 1 0 0;
							display: flex;
							align-items: center;
							gap: 0.75rem;

							@container (max-width: 40rem) {
								gap: 0.5rem;
							}
						}

						/* Once the search is an icon, the heading is what gives way. */
						.leading {
							@container (max-width: 52rem) {
								min-inline-size: 0;
							}
						}

						.trailing {
							justify-content: flex-end;
						}

						/* One line. Where the heading gives way, the week wraps out of sight before the month clips. */
						h1 {
							display: flex;
							align-items: baseline;
							column-gap: 0.375rem;
							/* A number, never normal: normal grows the line box to a fallback font's metrics (Persian), past the 1lh that clips it. */
							line-height: 1.25;
							block-size: 1lh;
							min-inline-size: 0;
							overflow: hidden;
							padding: 0;
							margin: 0;
							font-size: 1.125rem;
							font-weight: 700;
							letter-spacing: -0.01em;
							color: var(--color-text);
							white-space: nowrap;

							> .name {
								min-inline-size: 0;
								overflow: hidden;
								text-overflow: ellipsis;

								&.short {
									display: none;
								}
							}

							> .week {
								font-weight: 500;
								color: var(--color-text-muted);
							}

							@container (max-width: 52rem) {
								flex-wrap: wrap;
							}

							@container (max-width: 40rem) {
								> .name {
									display: none;

									&.short {
										display: block;
									}
								}
							}
						}

						.today, .create {
							mitra-icon {
								display: none;
							}

							@container (max-width: 40rem) {
								&::part(button) {
									aspect-ratio: 1;
									padding-inline: 0;
								}

								mitra-icon {
									display: inline-flex;
								}

								span {
									display: none;
								}
							}
						}

						/* Its plus says what it does at every width. */
						.create mitra-icon {
							display: inline-flex;
						}

						/* One control, its buttons sharing borders. The border is translucent, so two overlapping ones would read
						   twice as dark: each button after the first drops its own. Phones step by swiping, so there it is Today alone. */
						.period {
							display: flex;

							> * {
								&:not(:first-child)::part(button) {
									border-inline-start-width: 0;
									border-start-start-radius: 0;
									border-end-start-radius: 0;
								}

								&:not(:last-child)::part(button) {
									border-start-end-radius: 0;
									border-end-end-radius: 0;
								}

								&:focus-within {
									z-index: 1;
								}
							}

							> :is(.previous, .next):dir(rtl)::part(icon) {
								scale: -1 1;
							}

							@container (max-width: 40rem) {
								> .previous, > .next {
									display: none;
								}

								> .today::part(button) {
									border-inline-start-width: 1px;
									border-radius: var(--border-radius);
								}
							}
						}

						/* An icon alone on a phone, its words everywhere else. */
						mitra-select.view {
							&::part(icon) {
								display: none;
							}

							@container (max-width: 40rem) {
								&::part(icon) {
									display: inline-flex;
								}

								&::part(value) {
									display: none;
								}
							}
						}

						.search {
							flex: 0 1 18rem;
							min-inline-size: 7rem;
							font-weight: 400;

							&::part(button) {
								justify-content: flex-start;
								border-radius: calc(2 * var(--border-radius));
							}

							span {
								flex: 1;
								text-align: start;
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
								color: var(--color-text-muted);
							}

							@container (max-width: 52rem) {
								flex: none;
								min-inline-size: 0;

								&::part(button) {
									border-radius: var(--border-radius);
									aspect-ratio: 1;
									justify-content: center;
									padding-inline: 0;
								}

								span, kbd {
									display: none;
								}
							}
						}

						@container (max-width: 52rem) {
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

						mitra-weeks, mitra-months, mitra-days, mitra-timeline, mitra-table {
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

				mitra-popover.goto-date {
					position-area: block-end span-inline-end;
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
					@settingsClick=${() => void this.openSettings().catch(() => undefined)}
				></mitra-sidebar>
				<main>
					<header>
						<div class="leading">
							<mitra-icon-button class="toggle" icon="panel-left" label=${t('Toggle sidebar')} @click=${this.toggleSidebar}></mitra-icon-button>
							${this.headingTemplate}
						</div>
						<mitra-button class="search" title=${t('Search or run a command (${hotkey})', { hotkey: CommandPalette.hotkey })} @click=${() => this.palette.show()}>
							<mitra-icon icon="search"></mitra-icon>
							<span>${t('Search or run a command…')}</span>
							<kbd>${CommandPalette.hotkey}</kbd>
						</mitra-button>
						<div class="trailing">
							<mitra-select class="view" icon="calendar-cog" label=${t('View')} title=${t('View')} .value=${this.view} @change=${(e: CustomEvent<CalendarView>) => this.setView(e.detail)}>
								${([['year', t('Year'), 'Y'], ['month', t('Month'), 'M'], ['week', t('Week'), 'W'], ['timeline', t('Timeline'), 'L'], ['table', t('Table'), 'S']] as const).map(([view, label, key]) => html`
									<mitra-option .value=${view} label=${label}>${label}<kbd slot="detail">${key}</kbd></mitra-option>
								`)}
							</mitra-select>
							${this.commandButton(CreateEntry, { className: 'create', icon: 'plus', label: t('Create') })}
							<div class="period" role="group">
								${!this.period ? html.nothing : this.commandButton(PreviousPeriod, { className: 'previous', icon: 'chevron-left' })}
								${this.commandButton(GoToToday, { className: 'today', icon: 'calendar-1', label: t('Today') })}
								${!this.period ? html.nothing : this.commandButton(NextPeriod, { className: 'next', icon: 'chevron-right' })}
							</div>
						</div>
					</header>
					<div class="calendar">
						${choose(this.view, [
							['week', () => html`
								<mitra-days
									.entries=${this.store.entries}
									.navigatingDate=${bind(this, 'navigatingDate', { event: 'navigate' })}
								></mitra-days>
							`],
							['month', () => html`
								<mitra-weeks
									.entries=${this.store.entries}
									.navigatingDate=${bind(this, 'navigatingDate', { event: 'navigate' })}
									@switchToWeek=${() => this.setView('week')}
								></mitra-weeks>
							`],
							['year', () => html`
								<mitra-months
									.entries=${this.store.entries}
									.navigatingDate=${bind(this, 'navigatingDate', { event: 'navigate' })}
									@switchToMonth=${() => this.setView('month')}
								></mitra-months>
							`],
							['timeline', () => html`
								<mitra-timeline
									.entries=${this.store.entries}
									.navigatingDate=${bind(this, 'navigatingDate', { event: 'navigate' })}
								></mitra-timeline>
							`],
							['table', () => html`
								<mitra-table
									.entries=${this.store.entries}
									.navigatingDate=${this.navigatingDate}
									@windowChange=${() => this.requestUpdate()}
								></mitra-table>
							`]
						])}
					</div>
				</main>
				<mitra-command-palette
					.commands=${this.paletteCommands}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-command-palette>
				<mitra-popover class="goto-date">
					<mitra-date-picker .value=${this.navigatingDate}
						@pick=${(e: CustomEvent<DateTime>) => { this.navigatingDate = e.detail; this.gotoDate.hide() }}
					></mitra-date-picker>
				</mitra-popover>
			</lit-page>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-page-calendar': PageCalendar
	}
}
