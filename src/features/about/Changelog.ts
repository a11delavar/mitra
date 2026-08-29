/**
 * One category within a version's release notes.
 */
export interface ChangelogCategory {
	type: string
	title: string
	markdown: string
}

/**
 * One version's release notes for the What's-New dialog.
 */
export interface ChangelogSection {
	version: string
	date?: string
	current: boolean
	url: string
	categories: Array<ChangelogCategory>
}
