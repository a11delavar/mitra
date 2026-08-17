import { DialogCancelledError } from '@a11d/lit-application'
import { Mitra } from '../Mitra.js'

/** Where a keyed command appears in the shortcut sheet's grouping. */
export type CommandGroup = 'views' | 'navigation' | 'entries' | 'general' | (string & {})

type CommandConstructor = new () => Command

const registeredCommands = new Array<CommandConstructor>()

/** Registers a {@link Command} class. Registration order IS display order — the palette lists and
 * the interceptor matches in the order the classes evaluate (see commands/index.ts). */
export const command = () => (constructor: CommandConstructor) => { registeredCommands.push(constructor) }

export function commands(): ReadonlyArray<CommandConstructor> {
	return registeredCommands
}

/**
 * A user-invocable verb: one class per action, self-describing and self-executing. Each class owns
 * every fact about its action — the palette's heading/icon/keywords, the keys it answers to, its
 * shortcut-sheet group — so the command palette, the calendar page's keyboard interceptor and the
 * keyboard-shortcuts dialog are three views of ONE registry and none of them can drift.
 *
 * Context is resolved, not passed: commands are global verbs in a single-page app, so they reach
 * their surface through {@link Mitra.instance} (the framework's document-resolved application) at
 * execution time — a command can drill into as much page state as it needs without any wiring.
 *
 * Declare the facts as plain `readonly` **fields** — `t()` returns a lazily-stringified
 * `LocalizedString`, and while it does bind `Localizer.languages.current` at call time, Mitra
 * resolves the language once at boot (`?lang=` → localStorage → navigator; there is no in-app
 * switcher), so a field is exactly as correct as a getter and reads far better. Should a language
 * switcher ever land, the fix is re-instantiating the registry on change, not turning every fact
 * back into a getter.
 *
 * Reach for a **getter** only where the value depends on LIVE state — a view-dependent heading
 * ("Next Week" vs "Next Month"), or the direction-dependent arrow `keys`. Every fact is declared
 * `abstract readonly` precisely so either form satisfies it (a `declare`d field would reject the
 * getter — TS2611), and being abstract, each command must state all of them, `undefined` included:
 * a palette-only verb says so out loud rather than by omission.
 *
 * The members carrying a DEFAULT ({@link shortcutLabel}, {@link keyLabels}, {@link matches}) are real
 * accessors on this prototype, so an override must be an accessor too — the project compiles with
 * `useDefineForClassFields: false`, where a subclass field emits a constructor ASSIGNMENT that a
 * getter-only base property throws on. Prefer flipping `keys` over overriding those: derive, don't
 * duplicate.
 *
 * NOT commands, deliberately: pointer gestures (Ctrl+drag, Alt+click, Ctrl+scroll) and keys that
 * need their owner's state or guards (Ctrl+P inside text fields, Delete gated on the open editor).
 * Those stay with their owners and appear in the shortcuts dialog as hand-written vocabulary rows.
 */
export abstract class Command {
	/** The keyboard glyph for a `KeyboardEvent.key` value — arrows draw as arrows, letters uppercase. */
	static keyLabel(key: string) {
		switch (key) {
			case 'ArrowRight': return '→'
			case 'ArrowLeft': return '←'
			case 'ArrowUp': return '↑'
			case 'ArrowDown': return '↓'
			default: return key.length === 1 ? key.toUpperCase() : key
		}
	}

	/** What the palette lists it as. */
	abstract readonly heading: string

	/** Its lucide glyph in the palette. */
	abstract readonly icon: string

	/** Additional match terms beyond the heading — synonyms a user might type into the palette. */
	abstract readonly keywords?: string

	/** The `KeyboardEvent.key` values this command answers to — bare keys only, the interceptor
	 * stands down for chords. Absent means palette-only. The first key is the palette's hint. */
	abstract readonly keys?: ReadonlyArray<string>

	/** The shortcut sheet's group — expected exactly when {@link keys} exist. */
	abstract readonly group?: CommandGroup

	/** The sheet's label — the palette heading unless that is view-dependent ("Next Week" → "Forward"). */
	get shortcutLabel() { return this.heading }

	/** Whether it shows in the palette before anything is typed. False for the per-calendar verbs (see
	 * commands/sources.ts) for the same reason entries are held back — there's one per calendar, and an
	 * empty palette should read as a curated menu. */
	get listedWithoutQuery() { return true }

	/** The palette's kbd hint beside the heading. */
	get shortcut() { return !this.keys?.length ? undefined : Command.keyLabel(this.keys[0]!) }

	/** The sheet's key chips — alternative keys, each as a glyph. Overridable: the arrows flip in RTL. */
	get keyLabels() { return this.keys?.map(Command.keyLabel) }

	matches(e: KeyboardEvent) {
		return !!this.keys?.some(key => key.toLowerCase() === e.key.toLowerCase())
	}

	abstract execute(): unknown

	/** How every surface RUNS a command — the palette, the keyboard interceptor. It absorbs the one
	 * rejection that isn't a failure: a command that opens a dialog returns its `confirm()`, which
	 * rejects with {@link DialogCancelledError} when the user dismisses it, and dismissing a dialog is
	 * a normal outcome. A genuine failure still reaches the console instead of vanishing. */
	dispatch() {
		void Promise.resolve(this.execute()).catch(error => {
			if (!(error instanceof DialogCancelledError)) {
				console.error(`The "${this.heading}" command failed:`, error)
			}
		})
	}

	/** The calendar page every command drives, resolved through the application. Non-null by
	 * construction: a command is only reachable from surfaces the page itself owns — its palette and
	 * its keyboard interceptor — so the page is always there by the time one of these runs. (Nothing
	 * may touch it during CONSTRUCTION though: the registry is instantiated in the page's own field
	 * initializer, before the element is in the document.) */
	protected get calendar() { return Mitra.instance.calendar }
}

/** Whether the command matches the query: every whitespace-separated term must appear somewhere in
 * the heading or keywords, so "view week" matches as well as "week view". */
export function commandMatches(command: Command, query: string) {
	const haystack = `${command.heading} ${command.keywords ?? ''}`.toLowerCase()
	return query.trim().toLowerCase().split(/\s+/).every(term => haystack.includes(term))
}
