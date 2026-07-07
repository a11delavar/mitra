import { Component, component, html, css, property, state, query, event, eventListener } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { type Entry } from 'shared'
import { getSource, searchEntries } from './Api.js'
import { EntryStore } from './EntryStore.js'
import { commandMatches, type Command } from './Command.js'

/**
 * The command palette: a top-layer search box (Ctrl/Cmd+P, or the header's search trigger) over the
 * page's {@link Command}s and the ENTIRE entry store — entries are searched on the backend, so
 * matches aren't limited to the window the calendar happens to have fetched. Picking an entry
 * dispatches `navigate` with its start; picking a command executes it.
 */
@component('mitra-command-palette')
export class CommandPalette extends Component {
	/** The platform-conventional label for the open shortcut (the Mac's ⌘ symbol, Ctrl elsewhere). */
	static get hotkey() {
		return navigator.userAgent.includes('Mac') ? '⌘ P' : 'Ctrl P'
	}

	@property({ type: Array }) commands = new Array<Command>()

	@event() readonly navigate!: EventDispatcher<DateTime>

	@state() private searchTerm = ''
	@state() private entries = new Array<Entry>()
	@state() private selectedIndex = 0

	@query('dialog') private readonly dialog!: HTMLDialogElement

	protected override createRenderRoot() { return this }

	show() {
		this.searchTerm = ''
		this.entries = []
		this.selectedIndex = 0
		this.searchToken++
		this.dialog.showModal()
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
			e.preventDefault()
			if (this.dialog.open) {
				this.dialog.close()
			} else {
				this.show()
			}
		}
	}

	/** Monotonic token: debounces keystrokes and discards stale responses — only the latest search lands. */
	private searchToken = 0

	private async search(term: string) {
		const token = ++this.searchToken
		if (!term.trim()) {
			this.entries = []
			return
		}
		await new Promise(resolve => setTimeout(resolve, 200))
		if (token !== this.searchToken) {
			return
		}
		const entries = await searchEntries(term.trim()).catch(() => new Array<Entry>())
		if (token === this.searchToken) {
			this.entries = entries
		}
	}

	private get matchingCommands() {
		return this.commands.filter(command => commandMatches(command, this.searchTerm))
	}

	/** Entries only join the list once there is something to search for — an empty palette is a command menu. */
	private get matchingEntries() {
		return this.searchTerm.trim() ? this.entries : new Array<Entry>()
	}

	private get results(): Array<Command | Entry> {
		return [...this.matchingCommands, ...this.matchingEntries]
	}

	private select(result: Command | Entry) {
		this.dialog.close()
		if ('execute' in result) {
			result.execute()
		} else if (result.start) {
			// Navigate the calendar to the entry, then ask its segment to open once it renders.
			this.navigate.dispatch(result.start)
			if (result.id) {
				EntryStore.requestOpen(result.id)
			}
		}
	}

	private handleInput(term: string) {
		this.searchTerm = term
		this.selectedIndex = 0
		void this.search(term)
	}

	private handleKeyDown(e: KeyboardEvent) {
		const count = this.results.length
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				this.selectedIndex = count ? (this.selectedIndex + 1) % count : 0
				break
			case 'ArrowUp':
				e.preventDefault()
				this.selectedIndex = count ? (this.selectedIndex - 1 + count) % count : 0
				break
			case 'Enter': {
				e.preventDefault()
				const selected = this.results[this.selectedIndex]
				if (selected) {
					this.select(selected)
				}
				break
			}
			default:
				break
		}
	}

	protected override updated() {
		this.querySelector('menu [data-selected]')?.scrollIntoView({ block: 'nearest' })
	}

	private static when(entry: Entry) {
		return !entry.start ? '' : entry.allDay
			? entry.start.format({ dateStyle: 'medium' })
			: entry.start.format({ dateStyle: 'medium', timeStyle: 'short' })
	}

	static override get styles() {
		return css`
			mitra-command-palette {
				display: contents;

				dialog {
					margin: 12vh auto auto;
					width: min(37.5rem, 92vw);
					padding: 0;
					outline: none;
					background: color-mix(in srgb, var(--color-surface) 88%, transparent);
					backdrop-filter: blur(16px);
					color: var(--color-text);
					border: var(--border);
					border-radius: 14px;
					box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
					font-family: 'Inter', sans-serif;

					&::backdrop {
						background: rgba(0, 0, 0, 0.25);
					}

					@media (prefers-reduced-motion: no-preference) {
						transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);

						@starting-style {
							opacity: 0;
							transform: scale(0.97) translateY(-8px);
						}
					}

					kbd {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						font-family: inherit;
						font-size: 0.6rem;
						font-weight: 600;
						color: color-mix(in srgb, var(--color-text) 45%, transparent);
						background: color-mix(in srgb, var(--color-text) 4%, transparent);
						border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
						border-radius: 4px;
						padding: 0.125rem 0.25rem;
						pointer-events: none;
					}

					> header {
						display: flex;
						align-items: center;
						gap: 0.625rem;
						padding: 0.875rem 1rem;
						border-block-end: var(--border);

						> mitra-icon {
							font-size: 1rem;
							color: var(--color-text-muted);
						}

						input[type=search] {
							flex: 1;
							height: auto;
							padding: 0;
							font-size: 0.9375rem;
							font-weight: 450;
							background: none;
							border: none;
							border-radius: 0;

							&::-webkit-search-cancel-button {
								display: none;
							}

							&:hover,
							&:focus-visible {
								background: none;
								border: none;
								box-shadow: none;
							}
						}
					}

					> menu {
						margin: 0;
						padding: 0.375rem;
						max-height: min(50vh, 24rem);
						overflow: auto;
						overscroll-behavior: contain;
						display: flex;
						flex-direction: column;
						gap: 1px;
						list-style: none;

						li {
							display: contents;
						}

						.group {
							display: block;
							padding: 0.5rem 0.625rem 0.25rem;
							font-size: 0.6875rem;
							font-weight: 600;
							letter-spacing: 0.04em;
							text-transform: uppercase;
							color: var(--color-text-muted);
						}

						.empty {
							display: block;
							padding: 1.5rem;
							text-align: center;
							font-size: 0.8125rem;
							color: var(--color-text-muted);
						}

						button {
							all: unset;
							display: flex;
							align-items: center;
							gap: 0.625rem;
							padding: 0.5rem 0.625rem;
							border-radius: 8px;
							font-size: 0.8125rem;
							font-weight: 500;
							cursor: pointer;

							&[data-selected] {
								background: color-mix(in srgb, var(--color-text) 8%, transparent);
							}

							mitra-icon {
								font-size: 1rem;
								color: var(--color-text-muted);
							}

							.swatch {
								inline-size: 0.625rem;
								block-size: 0.625rem;
								margin-inline: 3px;
								border-radius: 50%;
								flex-shrink: 0;
							}

							.heading {
								flex: 1;
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
							}

							.when {
								font-size: 0.75rem;
								color: var(--color-text-muted);
								white-space: nowrap;
							}
						}
					}

					> footer {
						display: flex;
						gap: 1rem;
						padding: 0.5rem 1rem;
						border-block-start: var(--border);
						font-size: 0.6875rem;
						color: var(--color-text-muted);

						span {
							display: inline-flex;
							align-items: center;
							gap: 0.25rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		const commands = this.matchingCommands
		const entries = this.matchingEntries
		return html`
			<dialog closedby="any" @keydown=${(e: KeyboardEvent) => this.handleKeyDown(e)}>
				<header>
					<mitra-icon icon="search"></mitra-icon>
					<input type="search" autofocus placeholder="Search entries or run a command…"
						.value=${this.searchTerm}
						@input=${(e: Event) => this.handleInput((e.target as HTMLInputElement).value)}
					>
					<kbd>esc</kbd>
				</header>
				<menu>
					${!commands.length ? html.nothing : html`
						<li class="group">Commands</li>
						${commands.map((command, index) => html`
							<li>
								<button ?data-selected=${index === this.selectedIndex}
									@pointerenter=${() => this.selectedIndex = index}
									@click=${() => this.select(command)}
								>
									<mitra-icon icon=${command.icon}></mitra-icon>
									<span class="heading">${command.heading}</span>
									${!command.shortcut ? html.nothing : html`<kbd>${command.shortcut}</kbd>`}
								</button>
							</li>
						`)}
					`}
					${!entries.length ? html.nothing : html`
						<li class="group">Entries</li>
						${entries.map((entry, entryIndex) => {
							const index = commands.length + entryIndex
							return html`
								<li>
									<button ?data-selected=${index === this.selectedIndex}
										@pointerenter=${() => this.selectedIndex = index}
										@click=${() => this.select(entry)}
									>
										<span class="swatch" style=${`background: ${entry.color ?? getSource(entry.sourceId)?.color ?? 'var(--color-accent)'}`}></span>
										<span class="heading">${entry.heading || 'Untitled'}</span>
										<span class="when">${CommandPalette.when(entry)}</span>
									</button>
								</li>
							`
						})}
					`}
					${commands.length || entries.length ? html.nothing : html`
						<li class="empty">No matches</li>
					`}
				</menu>
				<footer>
					<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
					<span><kbd>↵</kbd> select</span>
					<span><kbd>esc</kbd> close</span>
				</footer>
			</dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-command-palette': CommandPalette
	}
}
