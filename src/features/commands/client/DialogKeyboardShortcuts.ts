import { component, html, css, type HTMLTemplateResult } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { commands, type Command, type CommandGroup } from '../Command.js'

/**
 * The keyboard cheat sheet, grouped the way users think — views, navigation, entries, general.
 * Every keyed {@link Command} documents itself: its rows derive from the registry, so a new command
 * class appears here (and in the palette) without touching this dialog. Only the vocabulary that
 * deliberately is NOT a command — pointer gestures and owner-guarded keys (see Command.ts) — is
 * written by hand below. Opened with "?" and from the palette.
 */
@component('mitra-dialog-keyboard-shortcuts')
export class DialogKeyboardShortcuts extends DialogComponent {
	/** Apple boards label their keys with glyphs — and their "delete" IS Backspace, printed ⌫. */
	private static readonly mac = navigator.userAgent.includes('Mac')
	private static get modifier() { return DialogKeyboardShortcuts.mac ? '⌘' : t('Ctrl') }
	private static get alt() { return DialogKeyboardShortcuts.mac ? '⌥' : 'Alt' }
	private static get deleteKey() { return DialogKeyboardShortcuts.mac ? '⌫' : t('Del') }

	private static keys(...labels: Array<string>) {
		return html`${labels.map(label => html`<kbd>${label}</kbd>`)}`
	}

	/** A gesture or connective beside the key chips ("or", "drag", "scroll") — words, not keys. */
	private static word(text: string) {
		return html`<span class="word">${text}</span>`
	}

	/** A registry command's row: its sheet label beside its alternative keys, "or"-separated. */
	private static row(command: Command) {
		return {
			action: command.shortcutLabel,
			keys: html`${command.keyLabels!.map((label, index) => html`
				${!index ? html.nothing : DialogKeyboardShortcuts.word(t('or'))}${DialogKeyboardShortcuts.keys(label)}
			`)}`,
		}
	}

	private get groups(): Array<{ heading: string, shortcuts: Array<{ action: string, keys: HTMLTemplateResult }> }> {
		const { keys, word, row, modifier, alt, deleteKey } = DialogKeyboardShortcuts
		const of = (group: CommandGroup) => commands()
			.map(constructor => new constructor())
			.filter(command => command.keys?.length && command.group === group)
			.map(row)
		return [
			{ heading: t('Views'), shortcuts: of('views') },
			{ heading: t('Navigation'), shortcuts: of('navigation') },
			{
				heading: t('Entries'),
				shortcuts: [
					...of('entries'),
					{ action: t('Delete the open entry'), keys: keys(deleteKey) },
					{ action: t('Delete just this entry of a series'), keys: keys(modifier, deleteKey) },
					{ action: t('Move or resize just this entry of a series'), keys: html`${keys(modifier)}${word(t('drag'))}` },
					{ action: t('Duplicate an entry'), keys: html`${keys(alt)}${word(t('drag'))}` },
					{ action: t('Choose a task status'), keys: html`${keys(alt)}${word(t('click'))}` },
					{ action: t('Zoom the view'), keys: html`${keys(modifier)}${word(t('scroll'))}` },
				],
			},
			{
				heading: t('General'),
				shortcuts: [
					{ action: t('Search or run a command…'), keys: html`${keys('/')}${word(t('or'))}${keys(modifier, 'P')}${word(t('or'))}${keys(modifier, 'K')}` },
					...of('general'),
					// The sidebar eye's Alt+click (see Sidebar.toggleSolo) — a pointer gesture, so hand-written.
					{ action: t('Show only one calendar, or bring the rest back'), keys: html`${keys(alt)}${word(t('click'))}` },
					{ action: t('Close'), keys: keys('Esc') },
				],
			},
		]
	}

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-keyboard-shortcuts {
				--mitra-dialog-width: min(44rem, 92vw);

				/* A cheat SHEET: groups flow into as many ~18rem columns as the dialog affords (two on a
				   desktop, one on a phone) so the whole vocabulary is visible at a glance. Should a short
				   viewport still not fit it, the sheet scrolls within the dialog, bled to its edges so the
				   scrollbar rides the dialog border (the About dialog's notes region does the same). */
				.groups {
					max-height: min(40rem, 70vh);
					overflow-y: auto;
					margin-inline: calc(-1 * var(--mitra-dialog-padding));
					padding-inline: var(--mitra-dialog-padding);
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
					align-items: start;
					gap: 1.25rem 2.5rem;
					scrollbar-width: thin;
					scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;

					h3 {
						margin: 0 0 0.125rem;
						font-size: 0.6875rem;
						font-weight: 600;
						letter-spacing: 0.04em;
						text-transform: uppercase;
						color: var(--color-text-muted);
					}

					.shortcut {
						display: flex;
						align-items: center;
						gap: 1rem;
						padding-block: 0.3125rem;

						.action {
							flex: 1;
							font-size: 0.8125rem;
							color: var(--color-text);
						}

						.keys {
							display: inline-flex;
							align-items: center;
							gap: 0.25rem;
							flex-shrink: 0;
						}

						/* Hints are hidden on a touch screen everywhere else in the app (kbd.css.ts) — this
						   sheet is the one place they ARE the content, so both re-declare display and
						   opt back in. Bigger and firmer here than a hint decorating a control, too. */
						.word {
							display: inline;
							font-size: 0.6875rem;
							color: var(--color-text-muted);
						}

						kbd {
							display: inline-flex;
							align-items: center;
							justify-content: center;
							min-width: 1.375rem;
							font-size: 0.6875rem;
							color: color-mix(in srgb, var(--color-text) 65%, transparent);
							border-color: color-mix(in srgb, var(--color-text) 10%, transparent);
							padding: 0.125rem 0.3125rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=${t('Keyboard Shortcuts')}>
				<div class="groups">
					${this.groups.map(group => html`
						<section>
							<h3>${group.heading}</h3>
							${group.shortcuts.map(shortcut => html`
								<div class="shortcut">
									<span class="action">${shortcut.action}</span>
									<span class="keys">${shortcut.keys}</span>
								</div>
							`)}
						</section>
					`)}
				</div>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-keyboard-shortcuts': DialogKeyboardShortcuts
	}
}
