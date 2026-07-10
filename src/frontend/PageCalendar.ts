import { component, html, state, css, eventListener, Controller, bind, query, queryAll } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { Task } from '@lit/task'
import { DateTime } from '@3mo/date-time'
import { MediaQueryController } from '@3mo/media-query-observer'
import { Entry, EntryType, SourceType, DEFAULT_REMINDER_MINUTES } from 'shared'
import { fetchEvents, getPrimarySource } from './Api.js'
import type { EntrySegmentComponent } from './EventSegment.js'
import { EntryStore } from './EntryStore.js'
import { CommandPalette } from './CommandPalette.js'
import { type Command } from './Command.js'
import { DialogIntegration } from './DialogIntegration.js'

class FetcherController extends Controller {
	// `withCredentials` so the session cookie rides along behind a cookie-based auth proxy (e.g. Traefik OIDC).
	private readonly eventSource = new EventSource('/api/events', { withCredentials: true })

	constructor(override readonly host: PageCalendar) {
		super(host)
	}

	readonly task = new Task(this.host, {
		args: () => [this.host.navigatingDate.month, this.host.navigatingDate.year, this.host.view] as const,
		task: () => {
			// The timeline's viewport can span ~6 months (see TimelineDensityController.max) versus the
			// week/month views' ~1, so it needs a wider prefetch halo around the navigating date.
			const months = this.host.view === 'timeline' ? 4 : 1
			const start = this.host.navigatingDate.monthStart.subtract({ months })
			const end = this.host.navigatingDate.monthEnd.add({ months })
			return fetchEvents(start, end)
		},
		onComplete: entries => EntryStore.applyServerEntries(entries),
	})

	override hostConnected() {
		this.task.run()
		this.eventSource.onmessage = (event) => {
			if (event.data === 'updated') {
				const transition = document.startViewTransition(async () => {
					await this.task.run()
					await this.host.updateComplete
					await Promise.all(this.host.eventSegments.map(e => e.updateComplete))
				})
				// Back-to-back ticks (every save echoes one) abort the previous tick's transition — fine,
				// but don't let the abandoned transition's rejections surface as unhandled exceptions.
				transition.updateCallbackDone.catch(() => void 0)
				transition.ready.catch(() => void 0)
				transition.finished.catch(() => void 0)
			}
		}
	}

	override hostDisconnected() {
		this.eventSource?.close()
	}
}

@component('mitra-page-calendar')
@route('/')
export class PageCalendar extends PageComponent {
	@state() navigatingDate = new DateTime()
	@state() view: 'week' | 'month' | 'timeline' = 'week'
	@state() sidebarOpen = PageCalendar.preferredSidebarOpen

	readonly mediaController = new MediaQueryController(this, '(min-width: 800px)', () => this.sidebarOpen = PageCalendar.preferredSidebarOpen)

	/** On desktop the sidebar opens unless the user collapsed it (remembered per browser); on mobile
	 * it's an overlay and always starts closed. Evaluated eagerly for the initial render — the media
	 * controller below only fires on breakpoint CHANGES, never on load. */
	private static get preferredSidebarOpen() {
		return window.matchMedia('(min-width: 800px)').matches && localStorage.getItem('Mitra.SidebarCollapsed') !== 'true'
	}

	private readonly toggleSidebar = () => {
		this.sidebarOpen = !this.sidebarOpen
		// Only a desktop toggle expresses a lasting preference — closing the mobile overlay is just
		// dismissing it, and must not collapse the sidebar on the next desktop visit.
		if (this.mediaController.matches) {
			localStorage.setItem('Mitra.SidebarCollapsed', String(!this.sidebarOpen))
		}
	}

	@queryAll('mitra-entry-segment') readonly eventSegments!: Array<EntrySegmentComponent>

	private setView(value: 'week' | 'month' | 'timeline') {
		if (this.view === value) {
			return
		}

		const transition = (fn: () => Promise<void>) => {
			if (!document.startViewTransition) {
				void fn()
				return
			}
			const viewTransition = document.startViewTransition(fn)
			// An SSE tick's transition (or a rapid second switch) can abort this one — fine, but don't
			// let the abandoned transition's rejections surface as unhandled exceptions.
			viewTransition.updateCallbackDone.catch(() => void 0)
			viewTransition.ready.catch(() => void 0)
			viewTransition.finished.catch(() => void 0)
		}

		transition(async () => {
			this.view = value
			await this.updateComplete
			await Promise.all(this.eventSegments.map(e => e.updateComplete))
		})
	}

	readonly fetcher = new FetcherController(this)
	readonly store = new EntryStore(this)

	@query('mitra-command-palette') private readonly palette!: CommandPalette

	/** The page's palette commands — behavior stays here, where the state it drives lives; the palette
	 * only lists and dispatches. Rebuilt per render so view-dependent labels stay current. */
	private get commands(): Array<Command> {
		return [
			{ heading: t('Create Entry'), icon: 'plus', keywords: t('new event task add'), execute: () => this.createEntry() },
			{ heading: t('Go to Today'), icon: 'calendar-check', shortcut: 'T', keywords: t('now current date jump'), execute: () => this.navigatingDate = new DateTime() },
			{ heading: t('Week View'), icon: 'columns-3', shortcut: 'W', keywords: t('switch'), execute: () => this.setView('week') },
			{ heading: t('Month View'), icon: 'calendar-days', shortcut: 'M', keywords: t('switch grid'), execute: () => this.setView('month') },
			{ heading: t('Timeline View'), icon: 'chart-gantt', shortcut: 'L', keywords: t('switch gantt roadmap plan'), execute: () => this.setView('timeline') },
			{ heading: this.view === 'week' ? t('Next Week') : t('Next Month'), icon: 'arrow-right', keywords: t('forward later'), execute: () => this.navigatingDate = this.navigatingDate.add(this.view === 'week' ? { weeks: 1 } : { months: 1 }) },
			{ heading: this.view === 'week' ? t('Previous Week') : t('Previous Month'), icon: 'arrow-left', keywords: t('back earlier'), execute: () => this.navigatingDate = this.navigatingDate.subtract(this.view === 'week' ? { weeks: 1 } : { months: 1 }) },
			{ heading: t('Toggle Sidebar'), icon: 'panel-left', keywords: t('collapse expand calendars'), execute: this.toggleSidebar },
			{ heading: t('Add Integration'), icon: 'plug', keywords: t('connect caldav account calendar'), execute: () => new DialogIntegration({ id: '' }).confirm() },
		]
	}

	/** The palette's Create Entry: a blank one-hour draft at the next full hour today, on the primary
	 * source — the same target a create gesture picks — navigated into view with its editor open.
	 * Always lands in the week view: the timed grid renders every draft, whereas a crowded month cell
	 * folds it into "+N more" and the editor could never open. */
	private createEntry() {
		const source = getPrimarySource()
		if (!source) {
			return
		}
		const now = new DateTime()
		const start = now.dayStart.add({ hours: now.hour + 1 })
		this.setView('week')
		this.navigatingDate = now
		EntryStore.upsertDraft(new Entry({
			sourceId: source.id,
			type: source.type === SourceType.Task ? EntryType.Task : EntryType.Event,
			heading: '',
			start,
			end: start.add({ hours: 1 }),
			allDay: false,
			reminders: [DEFAULT_REMINDER_MINUTES], // a timed draft — same default as a create gesture
		}))
		EntryStore.openDraft()
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return
		}

		switch (e.key.toLowerCase()) {
			case 'w':
				this.setView('week')
				break
			case 'm':
				this.setView('month')
				break
			case 'l':
				this.setView('timeline')
				break
			case 't':
				this.navigatingDate = new DateTime()
				break
			default:
				break
		}
	}

	static override get styles() {
		return css`
			lit-page {
				display: contents;
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
				overflow: hidden;

				main {
					display: flex;
					flex-direction: column;
					flex: 1;
					min-width: 0;
					min-height: 0;

					> header {
						container-type: inline-size;
						display: flex;
						align-items: center;
						gap: 0.75rem;
						padding: 0.75rem 1.25rem;

						h1 {
							padding: 0;
							margin: 0;
							font-size: 1.375rem;
							font-weight: 600;
							letter-spacing: -0.01em;
							color: var(--color-text);
						}

						.toggle {
							font-size: 20px;
						}

						/* The fake search box: just a button dressed as an input — the real one lives in the palette. */
						.search {
							flex: 1;
							max-width: 21rem;
							justify-content: flex-start;
							border-radius: 8px;
							font-weight: 400;
							color: var(--color-text-muted);

							span {
								flex: 1;
								text-align: start;
								white-space: nowrap;
								overflow: hidden;
							}

							/* Collapses to a bare icon button when the header runs out of room. */
							@container (max-width: 40rem) {
								flex: none;

								span, kbd {
									display: none;
								}
							}
						}
					}

					mitra-weeks, mitra-days, mitra-timeline {
						flex: 1;
						min-height: 0;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<lit-page>
				<mitra-sidebar ?open=${bind(this, 'sidebarOpen')}></mitra-sidebar>
				<main>
					<header>
						<mitra-icon-button class="toggle" icon="panel-left" label=${t('Toggle sidebar')} @click=${this.toggleSidebar}></mitra-icon-button>
						<h1>${this.navigatingDate.format({ month: 'long', year: 'numeric' })}</h1>
						<div style="flex: 1"></div>
						<button class="search" title=${t('Search or run a command (${hotkey})', { hotkey: CommandPalette.hotkey })} @click=${() => this.palette.show()}>
							<mitra-icon icon="search"></mitra-icon>
							<span>${t('Search or run a command…')}</span>
							<kbd>${CommandPalette.hotkey}</kbd>
						</button>
						<div style="flex: 1"></div>
						<select .value=${this.view} @change=${(e: Event) => this.setView((e.target as HTMLSelectElement).value as 'week' | 'month' | 'timeline')}>
							<button>
								<selectedcontent></selectedcontent>
							</button>
							${/* Options built via .map, NOT inline <option> literals: an inline option carrying a lit marker is
							   present when lit sets the template's innerHTML, and Chrome 150 clones it into <selectedcontent>
							   right then — duplicating the marker and corrupting lit's part indices. Mapped options aren't
							   in the template at prep time, so nothing is cloned then. (Do not inline these.) */''}
							${[{ value: 'month', label: t('Month'), key: 'M' }, { value: 'week', label: t('Week'), key: 'W' }, { value: 'timeline', label: t('Timeline'), key: 'L' }].map(o => html`<option value=${o.value} ?selected=${o.value === this.view}>${o.label}<kbd>${o.key}</kbd></option>`)}
						</select>
						<button @click=${() => this.navigatingDate = new DateTime()}>
							${t('Today')} <kbd>T</kbd>
						</button>
					</header>
					${this.view === 'week' ? html`
						<mitra-days
							.entries=${this.store.entries}
							.navigatingDate=${this.navigatingDate}
							@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
						></mitra-days>
					` : this.view === 'month' ? html`
						<mitra-weeks
							.entries=${this.store.entries}
							.navigatingDate=${this.navigatingDate}
							@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
							@switchToWeek=${() => this.setView('week')}
						></mitra-weeks>
					` : html`
						<mitra-timeline
							.entries=${this.store.entries}
							.navigatingDate=${this.navigatingDate}
							@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
						></mitra-timeline>
					`}
				</main>
				<mitra-command-palette
					.commands=${this.commands}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-command-palette>
			</lit-page>
		`
	}
}
