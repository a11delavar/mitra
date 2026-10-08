/**
 * One category within a version's changelog section.
 */
export interface ChangelogCategory {
	type: string
	title: string
	markdown: string
}

/**
 * One version's changelog section as the What's-New dialog receives it.
 */
export interface ChangelogSection {
	version: string
	date?: string
	current: boolean
	url: string
	categories: Array<ChangelogCategory>
}

/** A section as parsed from `CHANGELOG.md`, before the server annotates it for the running build. */
export type ParsedChangelogSection = Pick<ChangelogSection, 'version' | 'date' | 'categories'>

/** One commit's line in a category: `- Subject ([hash](url))`. */
export interface ChangelogLine {
	subject: string
	hash?: string
	url?: string
}

/**
 * Splits changelog markdown into version sections matching cliff format (`## [0.3.0] - 2026-07-10`).
 * Pure, so the website reads the same file through the same parser.
 */
export function parseChangelog(markdown: string): Array<ParsedChangelogSection> {
	const sections = new Array<{ version: string, date?: string, lines: Array<string> }>()
	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/)
		if (heading) {
			sections.push({ version: heading[1] === 'Unreleased' ? 'unreleased' : heading[1]!, date: heading[2], lines: [] })
		} else {
			sections.at(-1)?.lines.push(line)
		}
	}
	return sections
		.map(({ version, date, lines }) => ({ version, date, categories: parseCategories(lines) }))
		.filter(section => section.categories.length > 0)
}

function parseCategories(lines: Array<string>): Array<ChangelogCategory> {
	const categories = new Array<ChangelogCategory & { lines: Array<string> }>()
	for (const line of lines) {
		const heading = line.match(/^### (.+?)\s*$/)
		if (heading) {
			categories.push({ type: categoryType(heading[1]!), title: heading[1]!, markdown: '', lines: [] })
		} else {
			categories.at(-1)?.lines.push(line)
		}
	}
	return categories
		.map(({ type, title, lines }) => ({ type, title, markdown: lines.join('\n').trim() }))
		.filter(category => category.markdown.length > 0)
}

/** `✨ Features` → `features`, so readers can key on a category without its glyph. */
export function categoryType(title: string) {
	return title.replace(/^[^\p{L}]+/u, '').trim().toLowerCase().replace(/\s+/g, '-')
}

/** A category's commits, one per line. A line that is not a commit (hand-edited prose) keeps its text as the subject. */
export function linesOf(category: ChangelogCategory): Array<ChangelogLine> {
	return category.markdown.split(/\r?\n/).flatMap(line => {
		const match = line.match(/^- (.+?)(?: \(\[([0-9a-f]{7,})\]\((https?:\/\/\S+)\)\))?\s*$/)
		return !match ? [] : [{ subject: match[1]!, ...(match[2] ? { hash: match[2], url: match[3]! } : {}) }]
	})
}
