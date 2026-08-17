import { component, html, state, css, eventListener, bind, query, queryAll } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { DateTime } from '@3mo/date-time'
import { MediaQueryController } from '@3mo/media-query-observer'
import { transitionCalendar, type CalendarTransitionType } from './calendarTransition.js'
import type { EntrySegmentComponent } from './EventSegment.js'
import { EntryStore } from './EntryStore.js'
import { EntryFetcherController } from './EntryFetcherController.js'
import { CommandPalette } from './CommandPalette.js'
import { commands, sourceCommands } from './commands/index.js'
import type { Sidebar } from './Sidebar.js'

export type CalendarView = 'week' | 'month' | 'year'

@component('mitra-page-calendar')
@route('/')
export class PageCalendar extends PageComponent {
	/** Without customizable-select support the classic picker renders an option's text verbatim, so a
	 * <kbd> hint would fuse into the label ("YearY") — the hints are only rendered where they draw as
	 * chips. A render-time gate, not CSS: the classic picker is OS-drawn and ignores author styles. */
	private static readonly customizableSelectsSupported = CSS.supports('appearance', 'base-select')

	@state() navigatingDate = new DateTime()
	@state() view: CalendarView = 'week'
	@state() sidebarOpen = PageCalendar.preferredSidebarOpen

	readonly mediaController = new MediaQueryController(this, '(min-width: 800px)', () => this.sidebarOpen = PageCalendar.preferredSidebarOpen)

	/** On desktop the sidebar opens unless the user collapsed it (remembered per browser); on mobile
	 * it's an overlay and always starts closed. Evaluated eagerly for the initial render — the media
	 * controller below only fires on breakpoint CHANGES, never on load. */
	private static get preferredSidebarOpen() {
		return window.matchMedia('(min-width: 800px)').matches && localStorage.getItem('Mitra.SidebarCollapsed') !== 'true'
	}

	readonly toggleSidebar = () => {
		this.sidebarOpen = !this.sidebarOpen
		// Only a desktop toggle expresses a lasting preference — closing the mobile overlay is just
		// dismissing it, and must not collapse the sidebar on the next desktop visit.
		if (this.mediaController.matches) {
			localStorage.setItem('Mitra.SidebarCollapsed', String(!this.sidebarOpen))
		}
	}

	@queryAll('mitra-entry-segment') readonly eventSegments!: Array<EntrySegmentComponent>

	/** The scoped view transition's stage — persistent across view swaps (see the template). */
	@query('.calendar') private readonly calendar!: HTMLElement

	setView(value: CalendarView) {
		if (this.view === value) {
			return
		}
		this.transition('view-switch', () => { this.view = value })
	}

	/** Run a navigation-shaped change through the calendar's scoped view transition (see
	 * calendarTransition.ts) — settling every segment's render first, so the new-state capture
	 * snapshots the finished layout, never a mid-update frame. */
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

	/** The page's palette commands — instantiated once from the registry (see commands/): each class
	 * owns its facts as getters, so view-dependent headings and the active language stay current on
	 * a stable list. The palette only lists and dispatches; the keydown interceptor below matches
	 * against these same instances. */
	readonly commands = commands().map(constructor => new constructor())

	/** Those plus one verb per calendar, which can't be a stable list — calendars come and go while the
	 * page lives — so they're built from the store per render (see commands/sources.ts). Keyless, so
	 * the interceptor above stays on the registry's instances.
	 *
	 * They lead rather than trail: appended, the way out of a solo landed sixteenth in a list that
	 * scrolls at ten. The per-calendar solos cost the head of the list nothing, since they wait for
	 * something to be typed (see Command.listedWithoutQuery). */
	private get paletteCommands() {
		return [...sourceCommands(), ...this.commands]
	}

	/** Follows any change to which sources are on show. Visibility filters server-side, so the entries
	 * are re-read; the sidebar is re-rendered from here because a palette command changes its state
	 * without the sidebar being the one that did it. */
	readonly sourcesChanged = () => {
		this.sidebar?.requestUpdate()
		this.transition('source-toggle', () => this.fetcher.task.run())
	}

	/** How far one "next"/"previous" hop moves: one of whatever the current view shows. */
	get navigationStep() {
		return this.view === 'week' ? { weeks: 1 } : this.view === 'month' ? { months: 1 } : { years: 1 }
	}

	/** The Go to Date command's surface: reveal a native date picker seeded to the current position;
	 * picking a day navigates the calendar there. Stays on the page (not the command class) because
	 * it drives the page's own hidden input — rendered, not `display: none`, so `showPicker()` can
	 * open it while the palette's click/Enter still carries the transient activation the API requires. */
	goToDate() {
		const input = this.gotoDateInput
		const date = this.navigatingDate
		input.value = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
		try {
			input.showPicker()
		} catch {
			// showPicker is unsupported or blocked here — the (visually hidden) field still accepts typed input.
			input.focus()
		}
	}

	private handleGoToDate(e: Event) {
		const value = (e.target as HTMLInputElement).value
		if (value) {
			// Local midnight (the `T` suffix), matching the local `new DateTime()` used everywhere else for navigation.
			this.navigatingDate = new DateTime(`${value}T00:00:00`)
		}
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleKeyDown(e: KeyboardEvent) {
		// Never hijack a keystroke meant for a text field — a single-letter view shortcut ('m' → month)
		// would otherwise fire mid-typing. Covers native fields AND contenteditable (the sidebar's
		// inline source-rename is a `contenteditable` div, not an <input>). Also stand down for shortcut
		// chords (Ctrl/Cmd/Alt) and IME composition, which aren't ours to consume.
		const target = e.target
		const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
			|| target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
		if (editable || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
			return
		}

		// A modal dialog owns the keyboard while open — everything behind it is inert, so the focused
		// target always sits inside the dialog's composed path. Without this, pressing "m" in, say, the
		// shortcuts sheet would switch the calendar's view behind the dialog.
		if (e.composedPath().some(node => node instanceof HTMLDialogElement)) {
			return
		}

		// "/" is the page's search affordance (the header's fake search box as a key), not a command —
		// opening the palette from inside the palette makes no sense, so it isn't listed there.
		if (e.key === '/') {
			e.preventDefault()
			this.palette.show()
			return
		}

		// One interceptor for every keyed command: first registered match wins (see commands/).
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

			/* A running transition's pseudo tree wins hit-testing by default, deadening the calendar
			   for the animation's duration — let clicks fall through to the live DOM instead. */
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
				/* clip, not hidden — the shell must never be a SCROLL container. Nothing here is meant to
				   scroll (the views own their scrollers), but 'hidden' still leaves a scrollable box whose
				   offset only code can reach: let the header outgrow a short viewport once and any
				   scrollIntoView inside (the week view centres a day's cell on arrivals, see
				   CalendarScrollController's arrival hook) could
				   park the header out of sight, with no gesture able to bring it back. Same reason the
				   document itself is pinned to the viewport in Mitra's root styles; 'clip' cannot hold an
				   offset at all, and crops identically. */
				overflow: clip;

				main {
					display: flex;
					flex-direction: column;
					flex: 1;
					min-width: 0;
					min-height: 0;
					/* The week view sizes its day columns off this container's 100cqi (see the
					   grid-template-columns math in Days.ts): the strip and this column are width-identical,
					   and container units — unlike percentages, which never resolve early enough for the
					   length-ratio math there — are plain px by computed-value time. Containment is inert on
					   main itself: a flex: 1 (basis-0) item never consults its contents for its inline size. */
					container-type: inline-size;

					> header {
						container-type: inline-size;
						display: flex;
						align-items: center;
						gap: 0.75rem;
						padding: 0.75rem 1.25rem;

						/* Window Controls Overlay: the manifest's display_override removes the OS title bar and
						   hands that strip to us, so nothing is draggable until we say so. Make the header the
						   drag handle, while every control inside opts back out (a drag region eats clicks).

						   The overlaid buttons sit at the top-inline-END on Windows/Linux and the top-inline-START
						   on macOS (the traffic lights). env(titlebar-area-*) already encodes which — no OS
						   sniffing: the trailing gap is the viewport minus the safe area's far edge (the Windows
						   button cluster; ~0 on macOS), so this inset clears them exactly where they exist. */
						@media (display-mode: window-controls-overlay) {
							-webkit-app-region: drag;
							box-sizing: border-box;
							min-height: env(titlebar-area-height, auto);
							padding-inline-end: calc(1.25rem + (100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)));

							button, select {
								-webkit-app-region: no-drag;
							}
						}

						/* On a cramped header the shortcut hints are noise — every kbd goes (the search's, the
						   Today chip's, and the view options' — the select picker is still a DOM descendant, so
						   the container query reaches it). */
						@container (max-width: 40rem) {
							kbd {
								display: none;
							}
						}

						/* Two equal columns flank the search, so it stays truly centered — and keeps its size —
						   however wide the month label renders while scrolling. Once the header runs out of
						   room, the trailing column stops flexing so the leading one grows into the freed
						   center, carrying the (by then icon-sized) search over to the controls on the right. */
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

						/* Sheds its label on a cramped header, leaving a jump-to-today icon. */
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

						/* The view select likewise: label out, glyph in. (The classic, OS-drawn select ignores
						   both the in-button icon and these rules — it just keeps showing the option text.) */
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

						/* The fake search box: just a button dressed as an input — the real one lives in the palette.
						   Fixed width and unshrinkable, so scrolling from a short month into a long one (July →
						   September) never resizes it — the flanking columns absorb the label's growth, not this. */
						.search {
							width: 18rem;
							flex-shrink: 0;
							justify-content: flex-start;
							border-radius: calc(2 * var(--border-radius));
							font-weight: 400;

							/* Muted on the placeholder text only, so the icon reads at the same weight as the
							   view and Today icons beside it — the three collapse to matching glyphs. */
							span {
								flex: 1;
								text-align: start;
								white-space: nowrap;
								overflow: hidden;
								color: var(--color-text-muted);
							}

							/* Collapses to a bare icon only when even the widest month ("September") could no
							   longer sit beside the full box — kept this late so the palette stays full as long
							   as it possibly can. */
							@container (max-width: 44rem) {
								width: auto;
								border-radius: var(--border-radius);

								span, kbd {
									display: none;
								}
							}
						}

						/* Once the search has collapsed, freeze the trailing column at its content width so the
						   leading one grows into the center — carrying the search icon over to the controls. */
						@container (max-width: 44rem) {
							.trailing {
								flex: none;
							}
						}
					}

					/* The view transition's scope (see calendarTransition.ts): contained, so the browser
					   needn't force containment at capture time (a reflow), and clipped, so morphing
					   snapshots stay inside the calendar — header and sidebar sit outside the scope and
					   stay live. Deliberately NOT a query container: the week view's 100cqi math
					   (see Days.ts) must keep resolving against main. */
					.calendar {
						flex: 1;
						min-width: 0;
						min-height: 0;
						display: flex;
						flex-direction: column;
						contain: layout;
						overflow: clip;

						mitra-weeks, mitra-months, mitra-days {
							flex: 1;
							min-height: 0;
						}
					}
				}

				/* Leading inset only while the sidebar is collapsed — then the header owns the top-leading
				   corner and must clear macOS's traffic lights (titlebar-area-x ≈ their width; 0 elsewhere).
				   With the sidebar open it owns that corner itself (see Sidebar), and insetting the header
				   too would shove its title needlessly over. */
				mitra-sidebar:not([open]) + main > header {
					@media (display-mode: window-controls-overlay) {
						padding-inline-start: calc(1.25rem + env(titlebar-area-x, 0px));
					}
				}

				/* Anchors the native date picker near the header (where the palette was); kept rendered, not
				   display:none, so showPicker() works — see goToDate. */
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
				${/* Hiding/showing a source refetches (visibility filters server-side) through the calendar's
				   transition, so survivors glide into the freed space; the SSE echo then applies as a no-op. */''}
				<mitra-sidebar ?open=${bind(this, 'sidebarOpen')} @sourcesChange=${this.sourcesChanged}></mitra-sidebar>
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
								${/* Options built via .map, NOT inline <option> literals: an inline option carrying a lit marker is
								   present when lit sets the template's innerHTML, and Chrome 150 clones it into <selectedcontent>
								   right then — duplicating the marker and corrupting lit's part indices. Mapped options aren't
								   in the template at prep time, so nothing is cloned then. (Do not inline these.) */''}
								${[{ value: 'year', label: t('Year'), key: 'Y' }, { value: 'month', label: t('Month'), key: 'M' }, { value: 'week', label: t('Week'), key: 'W' }].map(o => html`<option value=${o.value} ?selected=${o.value === this.view}>${o.label}${PageCalendar.customizableSelectsSupported ? html`<kbd>${o.key}</kbd>` : html.nothing}</option>`)}
							</select>
							<button class="today" @click=${() => this.navigatingDate = new DateTime()}>
								<mitra-icon icon="calendar-1"></mitra-icon>
								<span>${t('Today')}</span> <kbd>T</kbd>
							</button>
						</div>
					</header>
					${/* The scoped view transition's stage (see calendarTransition.ts): a PERSISTENT element —
					   the scope must survive the update it animates, while the views inside swap out. */''}
					<div class="calendar">
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
							<mitra-months
								.entries=${this.store.entries}
								.navigatingDate=${this.navigatingDate}
								@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
								@switchToMonth=${() => this.setView('month')}
							></mitra-months>
						`}
					</div>
				</main>
				<mitra-command-palette
					.commands=${this.paletteCommands}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-command-palette>
				${/* Visually hidden but rendered, so the Go to Date command can open its native picker (see goToDate). */''}
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
