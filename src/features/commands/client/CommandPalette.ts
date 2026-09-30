import { Component, component, html, css, property, state, query, event, eventListener } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { getSource, searchEntries } from '../../../infrastructure/http/Api.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { commandMatches, Command } from '../Command.js'
import { LatestSearch } from '../../../design/Combobox.js'

/**
 * The command palette: a top-layer search box ("/", Ctrl/Cmd+P or +K, or the header's search trigger) over the
 * page's {@link Command}s and the ENTIRE entry store — entries are searched on the backend, so
 * matches aren't limited to the window the calendar happens to have fetched. Picking an entry
 * dispatches `navigate` with its start; picking a command executes it.
 */
@component('mitra-command-palette')
export class CommandPalette extends Component {
	/** What the prominent UI teaches — a bare "/": one key, no chord, and nothing to spell differently
	 * per platform. The chords ({@link hotkeys}) are equally supported and equally documented in the
	 * shortcut sheet; they just aren't what a header search box should be shouting. (The page owns the
	 * "/" keystroke itself — opening the palette from inside the palette is meaningless.) */
	static readonly hotkey = '/'

	@property({ type: Array }) commands = new Array<Command>()

	@event() readonly navigate!: EventDispatcher<DateTime>

	@state() private searchTerm = ''
	@state() private entries = new Array<Entry>()

	@query('dialog') private readonly dialog!: HTMLDialogElement

	private readonly search = new LatestSearch((term: string) => searchEntries(term).catch(() => new Array<Entry>()))

	protected override createRenderRoot() { return this }

	show() {
		this.searchTerm = ''
		this.entries = []
		this.search.cancel()
		this.dialog.showModal()
	}

	/** Both chords open it, on equal footing: **P** (the editor lineage — VS Code's Quick Open) and **K**
	 * (what most other palettes bound). Neither is prominent in the UI, which teaches "/" instead
	 * ({@link hotkey}), but both are listed in the shortcut sheet and the docs — a shortcut nobody can
	 * discover may as well not exist. */
	private static readonly hotkeys = ['p', 'k']

	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && CommandPalette.hotkeys.includes(e.key.toLowerCase())) {
			e.preventDefault()
			if (this.dialog.open) {
				this.dialog.close()
			} else {
				this.show()
			}
		}
	}

	private get matchingCommands() {
		const queried = !!this.searchTerm.trim()
		return this.commands.filter(command => (queried || command.listedWithoutQuery) && commandMatches(command, this.searchTerm))
	}

	/** Entries only join the list once there is something to search for — an empty palette is a command menu. */
	private get matchingEntries() {
		return this.searchTerm.trim() ? this.entries : new Array<Entry>()
	}

	private select(result: Command | Entry) {
		this.dialog.close()
		if (result instanceof Command) {
			result.dispatch()
		} else if (result.start) {
			// Navigate the calendar to the entry, then ask its segment to open once it renders.
			this.navigate.dispatch(result.start)
			if (result.id) {
				EntryEditorIntent.requestOpen(result.id)
			}
		}
	}

	private async handleInput(term: string) {
		this.searchTerm = term
		if (!term.trim()) {
			this.search.cancel()
			this.entries = []
			return
		}
		this.entries = await this.search.run(term.trim())
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

					header {
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
							appearance: none;
							flex: 1;
							min-inline-size: 0;
							height: auto;
							outline: none;
							font-family: inherit;
							color: var(--color-text);
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

					mitra-listbox {
						padding: 0.375rem;
						max-height: min(50vh, 24rem);
						overscroll-behavior: contain;

						.group {
							padding: 0.5rem 0.625rem 0.25rem;
							font-size: 0.6875rem;
							font-weight: 600;
							letter-spacing: 0.04em;
							text-transform: uppercase;
							color: var(--color-text-muted);
						}

						.empty {
							padding: 1.5rem;
							text-align: center;
							font-size: 0.8125rem;
							color: var(--color-text-muted);
						}
					}

					mitra-option {
						gap: 0.625rem;
						font-weight: 500;

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
			<dialog closedby="any">
				<mitra-combobox inline activateFirst @pick=${(e: CustomEvent<Command | Entry>) => this.select(e.detail)} @dismiss=${() => this.dialog.close()}>
					<header slot="input">
						<mitra-icon icon="search"></mitra-icon>
						<input type="search" autofocus placeholder=${t('Search entries or run a command…')} aria-label=${t('Search entries or run a command…')}
							.value=${this.searchTerm}
							@input=${(e: Event) => void this.handleInput((e.target as HTMLInputElement).value)}
						>
						<kbd>esc</kbd>
					</header>
					<mitra-listbox aria-label=${t('Search entries or run a command…')}>
						${!commands.length ? html.nothing : html`
							<span class="group">${t('Commands')}</span>
							${commands.map(command => html`
								<mitra-option .value=${command}>
									<mitra-icon icon=${command.icon}></mitra-icon>
									<span class="heading">${command.heading}</span>
									${!command.shortcut ? html.nothing : html`<kbd>${command.shortcut}</kbd>`}
								</mitra-option>
							`)}
						`}
						${!entries.length ? html.nothing : html`
							<span class="group">${t('Entries')}</span>
							${entries.map(entry => html`
								<mitra-option .value=${entry}>
									<span class="swatch" style=${`background: ${entry.color ?? getSource(entry.sourceId)?.color ?? 'var(--color-accent)'}`}></span>
									<span class="heading">${entry.heading || t('Untitled')}</span>
									<span class="when">${CommandPalette.when(entry)}</span>
								</mitra-option>
							`)}
						`}
						${commands.length || entries.length ? html.nothing : html`<span class="empty">${t('No matches')}</span>`}
					</mitra-listbox>
				</mitra-combobox>
				<footer>
					<span><kbd>↑</kbd><kbd>↓</kbd> ${t('navigate')}</span>
					<span><kbd>↵</kbd> ${t('select')}</span>
					<span><kbd>esc</kbd> ${t('close')}</span>
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
