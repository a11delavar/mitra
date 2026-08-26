import { type Source } from '../Source.js'
import { canCopyEntriesOut, canMoveEntriesOut, canRestoreSourceVisibility, getEnabledSources, getIntegrations, restoreSourceVisibility, soloSource } from '../../../infrastructure/http/Api.js'
import { Command } from '../../commands/Command.js'
import { DialogSourceMigration } from '../../migration/client/DialogSourceMigration.js'

/**
 * The calendar-visibility verbs — the palette's twin of the sidebar's Alt+click and its ⋯ item.
 *
 * Not `@command()`-registered: the registry holds classes, one singleton verb each, but "only show
 * Work" is parameterized by a calendar, so there's one instance per row and the list changes as
 * calendars come and go. They're built from the store instead (see {@link sourceCommands}). Being
 * keyless, they never reach the keyboard interceptor or the shortcut sheet, so nothing drifts.
 */

class ShowOnlySource extends Command {
	constructor(private readonly source: Source) {
		super()
	}

	get heading() { return t('Only Show ${name}', { name: this.source.name }) }
	readonly icon = 'scan-eye'
	/** A symbolic key (see i18n/index.ts): search terms are a bag of synonyms rather than prose, so
	 * each language wants the words ITS users would type, not a translation of the English ones. */
	readonly keywords = t('ShowOnlySource.Keywords')
	readonly keys = []
	readonly group = undefined

	/** One row per calendar would crowd out the app's own verbs in an unqueried palette. */
	override get listedWithoutQuery() { return false }

	override async execute() {
		await soloSource(this.source.id)
		this.calendar.sourcesChanged()
	}
}

/** Palette command to move or copy all entries from a source. */
class MoveSourceEntries extends Command {
	constructor(private readonly source: Source) {
		super()
	}

	get heading() {
		return canMoveEntriesOut(this.source)
			? t('Move entries from ${name}…', { name: this.source.name })
			: t('Copy entries from ${name}…', { name: this.source.name })
	}
	readonly icon = 'folder-input'
	readonly keywords = t('MoveSourceEntries.Keywords')
	readonly keys = []
	readonly group = undefined

	override get listedWithoutQuery() { return false }

	override execute() {
		return new DialogSourceMigration({ source: this.source }).confirm()
	}
}

class ShowPreviouslyVisibleSources extends Command {
	readonly heading = t('Show Previously Visible Calendars')
	readonly icon = 'eye'
	readonly keywords = t('ShowPreviouslyVisibleSources.Keywords')
	readonly keys = []
	readonly group = undefined

	override async execute() {
		await restoreSourceVisibility()
		this.calendar.sourcesChanged()
	}
}

/** The per-calendar verbs as they stand right now. */
export function sourceCommands(): Array<Command> {
	const sources = getIntegrations().flatMap(integration => getEnabledSources(integration))
	return [
		...canRestoreSourceVisibility() ? [new ShowPreviouslyVisibleSources()] : [],
		...sources.length < 2 ? [] : sources.map(source => new ShowOnlySource(source)),
		...sources.filter(canCopyEntriesOut).map(source => new MoveSourceEntries(source)),
	]
}
