import { DialogCancelledError } from '@a11d/lit-application'
import { Localizer } from '@3mo/localization'
import { Mitra } from '../../app/Mitra.js'
import { termsMatch } from './termsMatch.js'

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

let instances: Array<Command> | undefined

// Rebuild cached command instances when language changes.
Localizer.languages.change.subscribe(() => instances = undefined)

/** The registry as live instances — one per verb. */
export function commandInstances(): ReadonlyArray<Command> {
	return instances ??= registeredCommands.map(constructor => new constructor())
}

/**
 * A user-invocable verb: one class per action, self-describing and self-executing.
 * Facts are declared as readonly fields (rebuilt on language change); live state uses getters.
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

	/** Calendar page driven by commands, resolved via application instance. */
	protected get calendar() { return Mitra.instance.calendar }
}

/** Matches query against command heading and keywords using termsMatch. */
export function commandMatches(command: Command, query: string) {
	return termsMatch(query, `${command.heading} ${command.keywords ?? ''}`)
}
