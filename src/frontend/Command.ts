/** A palette action. The command palette lists, filters and dispatches these; the behavior itself
 * belongs to the context that defines the command (the page), keeping the palette a pure view. */
export interface Command {
	heading: string
	icon: string
	/** The standalone keyboard shortcut, shown as a hint (dispatching it stays the owner's concern). */
	shortcut?: string
	/** Additional match terms beyond the heading — synonyms a user might type. */
	keywords?: string
	execute: () => unknown
}

/** Whether the command matches the query: every whitespace-separated term must appear somewhere in
 * the heading or keywords, so "view week" matches as well as "week view". */
export function commandMatches(command: Command, query: string) {
	const haystack = `${command.heading} ${command.keywords ?? ''}`.toLowerCase()
	return query.trim().toLowerCase().split(/\s+/).every(term => haystack.includes(term))
}
