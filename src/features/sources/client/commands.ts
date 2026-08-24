import { type Source } from '../Source.js'
import { canRestoreSourceVisibility, getEnabledSources, getIntegrations, restoreSourceVisibility, soloSource } from '../../../infrastructure/http/Api.js'
import { Command } from '../../commands/Command.js'

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

/** The visibility verbs as they stand right now. The way out of a solo shows itself — it's what
 * someone opening the palette mid-solo came for; the per-calendar solos wait to be named. */
export function sourceCommands(): Array<Command> {
	const sources = getIntegrations().flatMap(integration => getEnabledSources(integration))
	return [
		...canRestoreSourceVisibility() ? [new ShowPreviouslyVisibleSources()] : [],
		// With a single calendar there is nothing to narrow down TO — "only show it" is already true.
		...sources.length < 2 ? [] : sources.map(source => new ShowOnlySource(source)),
	]
}
