import { DialogCancelledError } from '@a11d/lit-application'
import { Localizer } from '@3mo/localization'
import { Mitra } from '#app/Mitra.js'
import { termsMatch } from './termsMatch.js'
import { KeyPress } from './KeyPress.js'

/** Where a keyed command appears in the shortcut sheet's grouping. */
export type CommandGroup = 'views' | 'navigation' | 'entries' | 'general' | (string & {})

type CommandConstructor = new () => Command

const registeredCommands = new Array<CommandConstructor>()

/** Registers a {@link Command} class. Registration order IS display order: the palette lists and
 * the interceptor matches in the order the classes evaluate (see commands/index.ts). */
export const command = () => (constructor: CommandConstructor) => { registeredCommands.push(constructor) }

export function commands(): ReadonlyArray<CommandConstructor> {
	return registeredCommands
}

let instances: Array<Command> | undefined

Localizer.locales.change.subscribe(() => instances = undefined)

/** The registry as live instances, one per verb. */
export function commandInstances(): ReadonlyArray<Command> {
	return instances ??= registeredCommands.map(constructor => new constructor())
}

/** Facts are readonly fields (rebuilt on a language change); live state uses getters. */
export abstract class Command {
	/** The keyboard glyph for a `KeyboardEvent.key` value: arrows draw as arrows, letters uppercase. */
	static keyLabel(key: string) {
		switch (key) {
			case 'ArrowRight': return '→'
			case 'ArrowLeft': return '←'
			case 'ArrowUp': return '↑'
			case 'ArrowDown': return '↓'
			default: return key.length === 1 ? key.toUpperCase() : key
		}
	}

	abstract readonly heading: string

	/** Its lucide glyph in the palette. */
	abstract readonly icon: string

	/** Synonyms a user might type into the palette. */
	abstract readonly keywords?: string

	/** Bare keys as a Latin keyboard names them (`KeyPress`), so a Persian layout reaches them too; the interceptor
	 * stands down for chords. The first is the palette's hint. */
	abstract readonly keys?: ReadonlyArray<string>

	/** The shortcut sheet's group, expected exactly when {@link keys} exist. */
	abstract readonly group?: CommandGroup

	/** The sheet's label: the palette heading unless that is view-dependent ("Next Week" → "Forward"). */
	get shortcutLabel() { return this.heading }

	/** False for the per-calendar verbs: there is one per calendar, and an empty palette should read as a curated menu. */
	get listedWithoutQuery() { return true }

	/** False when this instance turned the command off, rather than it not applying right now. */
	get available() { return true }

	/** The palette's kbd hint beside the heading. */
	get shortcut() { return !this.keys?.length ? undefined : Command.keyLabel(this.keys[0]!) }

	/** The sheet's key chips: alternative keys, each as a glyph. Overridable: the arrows flip in RTL. */
	get keyLabels() { return this.keys?.map(Command.keyLabel) }

	matches(e: KeyboardEvent) {
		const press = new KeyPress(e)
		return !!this.keys?.some(key => press.is(key))
	}

	abstract execute(): unknown

	/** How every surface runs a command. It absorbs {@link DialogCancelledError}, as dismissing a dialog is a normal
	 * outcome; a genuine failure still reaches the console. */
	dispatch() {
		void Promise.resolve(this.execute()).catch(error => {
			if (!(error instanceof DialogCancelledError)) {
				console.error(`The "${this.heading}" command failed:`, error)
			}
		})
	}

	protected get calendar() { return Mitra.instance.calendar }
}

export function commandMatches(command: Command, query: string) {
	return termsMatch(query, `${command.heading} ${command.keywords ?? ''}`)
}
