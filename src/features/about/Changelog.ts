/**
 * One category within a version's release notes: a canonical {@link ChangelogCategory.type} and the
 * entries beneath it, as markdown. Parsed server-side out of CHANGELOG.md (see features/about/server/changelog.ts)
 * so the frontend keys its styling and filtering off an explicit type instead of reverse-engineering
 * categories back out of a markdown blob.
 */
export interface ChangelogCategory {
	/** The slug the UI keys off — `features`, `performance`, `bug-fixes`, `chores`, `refactors`,
	 * `infrastructure` — derived from the heading with its emoji stripped. Unknown categories keep
	 * whatever slug their title yields; the UI styles those with a neutral fallback. */
	type: string
	/** The heading as authored, emoji and all — e.g. `✨ Features`. What the UI actually prints. */
	title: string
	/** The category's entries as markdown: a bullet list, each line trailing a commit link. */
	markdown: string
}

/**
 * One version's release notes — the What's-New view's unit of data: the heading facts plus the
 * categories under it, in the order authored. Shipped INSIDE the running build, so it is readable
 * offline (including right after an update). Everything here is resolved server-side (see
 * features/about/server/changelog.ts) — the frontend renders these fields and derives nothing from them.
 */
export interface ChangelogSection {
	/** `0.3.0`, or `unreleased` for the section a dev image carries above the tags. */
	version: string
	/** The release date (`2026-07-10`); the unreleased section has none. */
	date?: string
	/** True for the one section that describes the running build (the exact match, or the newest as a
	 * fallback) — what the view expands by default. The server decides this from its own version, so
	 * the frontend never compares version strings. */
	current: boolean
	/** Where this version's notes live on GitHub: its release tag page, or the releases index for the
	 * unreleased section. */
	url: string
	/** The version's categories, in the order authored. Empty for a version with no recognised
	 * `### …` groups. */
	categories: Array<ChangelogCategory>
}
