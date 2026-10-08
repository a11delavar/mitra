/**
 * A release's curated notes, `releases/<minor>/README.md`: frontmatter with the title and, once released, the date,
 * then an intro and one `##` per highlight. A highlight shows its capture as a `<picture>` of the files beside the
 * notes, whose dark `<source>` GitHub picks by the reader's theme. A film is the same picture of its first frame, and
 * the readers that can play it find its `.mp4` under the same name. Each closes with `Docs: [page](../../docs/page.md)`.
 * Pure, shared by the website, the release scripts and the app.
 */
export class ReleaseNotes {
	static readonly reservedHeadings = new Set(['Why Mitra', 'Upgrading', 'Contributors'])
	static readonly frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
	static readonly capturePattern = /^<picture>[\s\S]*?<img src="(?<name>[A-Za-z0-9-]+)-light\.webp" alt="(?<alt>[^"]*)"[^>]*>[\s\S]*?<\/picture>[ \t]*$/m
	static readonly docsPattern = /^Docs: \[([^\]]+)\]\(([^)\s]+)\)[ \t]*$/m

	/** `0.6` for `v0.6.2`, `0.6.0-rc.1` or `0.6`: the folder a version's notes live in. */
	static minorOf(version: string) {
		return version.replace(/^v/, '').split('.').slice(0, 2).join('.')
	}

	/** Whether a version ships with notes (`x.y.0`, pre-release suffix allowed) rather than being a patch of them. */
	static isMinorRelease(version: string) {
		return /^v?\d+\.\d+\.0(-|$)/.test(version)
	}

	static parse(markdown: string) {
		const match = markdown.match(ReleaseNotes.frontmatterPattern)
		const frontmatter = new Map((match?.[1] ?? '').split(/\r?\n/).flatMap(line => {
			const field = line.match(/^(\w+):\s*(.*)$/)
			return !field ? [] : [[field[1]!, field[2]!.trim().replace(/^(['"])(.*)\1$/, '$2')] as const]
		}))
		const [intro = '', ...parts] = (match ? markdown.slice(match[0].length) : markdown).split(/^## /m)
		const sections = parts.map(part => {
			const newline = part.indexOf('\n')
			return ReleaseSection.of((newline < 0 ? part : part.slice(0, newline)).trim(), newline < 0 ? '' : part.slice(newline + 1))
		})
		return new ReleaseNotes(markdown, frontmatter.get('title') ?? '', frontmatter.get('date'), intro.trim(), sections)
	}

	readonly markdown: string
	readonly title: string
	/** Absent while the release is in development. */
	readonly date: string | undefined
	readonly intro: string
	readonly sections: ReadonlyArray<ReleaseSection>

	constructor(markdown: string, title: string, date: string | undefined, intro: string, sections: ReadonlyArray<ReleaseSection>) {
		this.markdown = markdown
		this.title = title
		this.date = date
		this.intro = intro
		this.sections = sections
	}

	get highlights() {
		return this.sections.filter(section => section instanceof ReleaseHighlight)
	}

	/**
	 * A letter before the highlights, under `## Why Mitra`, for a release that needs one (the first did): the intro stays
	 * one paragraph, which is all the releases list, the feed and GitHub show.
	 */
	get foreword() {
		const section = this.sections.find(section => section.heading === 'Why Mitra')
		return section && ReleaseLetter.of(section.markdown)
	}

	/** The sections after the highlights, such as Upgrading. The contributors are read as people, not as a section. */
	get rest() {
		return this.sections.filter(section => !(section instanceof ReleaseHighlight) && !['Why Mitra', 'Contributors'].includes(section.heading))
	}

	/** Who made the release, from its `Contributors` list: `- [@login](https://github.com/login): what they did`, or a bare name. */
	get contributors() {
		const section = this.sections.find(section => section.heading === 'Contributors')
		return (section?.markdown.split(/\r?\n/) ?? []).flatMap(line => {
			const match = line.match(/^- (?:\[([^\]]+)\]\(([^)\s]+)\)|([^:]+?))(?::\s*(.*))?\s*$/)
			return !match ? [] : [new ReleaseContributor((match[1] ?? match[3])!.trim(), match[2], match[4]?.trim() || undefined)]
		})
	}

	/** The notes with these people added to the Contributors list; anyone already named there stays as written. */
	withContributors(contributors: ReadonlyArray<ReleaseContributor>) {
		const known = this.contributors
		const lines = contributors.filter(person => !known.some(candidate => candidate.is(person))).map(person => person.line)
		if (!lines.length) {
			return this
		}
		const heading = this.markdown.search(/^## Contributors[ \t]*$/m)
		if (heading < 0) {
			return ReleaseNotes.parse(`${this.markdown.trimEnd()}\n\n## Contributors\n${lines.join('\n')}\n`)
		}
		const next = this.markdown.slice(heading + 1).search(/^## /m)
		const end = next < 0 ? this.markdown.length : heading + 1 + next
		return ReleaseNotes.parse(`${this.markdown.slice(0, end).trimEnd()}\n${lines.join('\n')}\n${next < 0 ? '' : '\n'}${this.markdown.slice(end)}`)
	}

	/** The capture names the notes use, each a pair of files beside them. */
	get captures() {
		return [...new Set(this.highlights.flatMap(highlight => highlight.capture ? [highlight.capture.name] : []))]
	}

	/** The notes with `date` in their frontmatter, replacing any date already there. */
	withDate(date: string) {
		const match = this.markdown.match(ReleaseNotes.frontmatterPattern)
		if (!match) {
			return ReleaseNotes.parse(`---\ndate: ${date}\n---\n${this.markdown}`)
		}
		const fields = match[1]!.split(/\r?\n/).filter(line => !/^date:/.test(line))
		return ReleaseNotes.parse(`---\n${[...fields, `date: ${date}`].join('\n')}\n---\n${this.markdown.slice(match[0].length)}`)
	}
}

export class ReleaseSection {
	/** A highlight, unless the heading is reserved for something else. */
	static of(heading: string, markdown: string) {
		return ReleaseNotes.reservedHeadings.has(heading) ? new ReleaseSection(heading, markdown.trim()) : ReleaseHighlight.of(heading, markdown)
	}

	readonly heading: string
	readonly markdown: string

	constructor(heading: string, markdown: string) {
		this.heading = heading
		this.markdown = markdown
	}

	/** The first sentence, for a reader that has room for one line. */
	get lead() {
		return this.markdown.split(/\r?\n/)[0]?.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? ''
	}
}

export class ReleaseHighlight extends ReleaseSection {
	/** Lifts the capture and the docs line out, so the text is what is left to read. */
	static override of(heading: string, markdown: string) {
		const capture = markdown.match(ReleaseNotes.capturePattern)
		const docs = markdown.match(ReleaseNotes.docsPattern)
		const text = [capture, docs].reduce((text, match) => match ? text.replace(match[0], '') : text, markdown).replace(/\n{3,}/g, '\n\n').trim()
		return new ReleaseHighlight(
			heading,
			text,
			capture ? new ReleaseCapture(capture.groups!.name!, capture.groups!.alt!) : undefined,
			docs ? new ReleaseDocs(docs[1]!, docs[2]!) : undefined,
		)
	}

	readonly capture: ReleaseCapture | undefined
	readonly docs: ReleaseDocs | undefined

	constructor(heading: string, markdown: string, capture: ReleaseCapture | undefined, docs: ReleaseDocs | undefined) {
		super(heading, markdown)
		this.capture = capture
		this.docs = docs
	}
}

export class ReleaseCapture {
	readonly name: string
	readonly alt: string

	constructor(name: string, alt: string) {
		this.name = name
		this.alt = alt
	}

	/** The capture's file in its release's folder: a still is a `.webp`, a film an `.mp4`. */
	file(theme: 'light' | 'dark', extension: 'webp' | 'mp4' = 'webp') {
		return `${this.name}-${theme}.${extension}`
	}
}

/** One line of a release's Contributors list: a name, where it links to, and what the person did. */
/** A letter's text, and who signed it: its last line when that is a GitHub profile link and nothing else. */
export class ReleaseLetter {
	static of(markdown: string) {
		const signature = markdown.match(/\n\s*\[(@[\w-]+)\]\((https:\/\/github\.com\/[\w-]+)\)\s*$/)
		return !signature
			? new ReleaseLetter(markdown, undefined)
			: new ReleaseLetter(markdown.slice(0, signature.index).trim(), new ReleaseContributor(signature[1]!, signature[2]))
	}

	readonly markdown: string
	readonly signature: ReleaseContributor | undefined

	private constructor(markdown: string, signature: ReleaseContributor | undefined) {
		this.markdown = markdown
		this.signature = signature
	}
}

export class ReleaseContributor {
	/** A commit's author: a GitHub login when the name is one or the email a GitHub noreply address, else the name alone. */
	static ofCommit(name: string, email: string) {
		const login = email.match(/^(?:\d+\+)?([\w-]+)@users\.noreply\.github\.com$/)?.[1] ?? (/^[\w-]+$/.test(name) ? name : undefined)
		return login ? new ReleaseContributor(`@${login}`, `https://github.com/${login}`) : new ReleaseContributor(name)
	}

	readonly name: string
	readonly url: string | undefined
	readonly role: string | undefined

	constructor(name: string, url?: string, role?: string) {
		this.name = name
		this.url = url
		this.role = role
	}

	get login() {
		return this.url?.match(/^https:\/\/github\.com\/([\w-]+)\/?$/)?.[1]
	}

	/** GitHub's picture of the person, for a line that links to a GitHub profile. */
	get avatar() {
		return this.login ? `https://github.com/${this.login}.png?size=96` : undefined
	}

	get line() {
		return `- ${this.url ? `[${this.name}](${this.url})` : this.name}${this.role ? `: ${this.role}` : ''}`
	}

	is(other: ReleaseContributor) {
		return this.login ? this.login === other.login : this.name === other.name
	}
}

/** The page of the docs a highlight points at, as the notes link it (`../../docs/page.md`). */
export class ReleaseDocs {
	/** A docs page's path under the docs' route, `../../docs/views/table.md` being `views/table/`, or nothing for another link. */
	static pageOf(href: string) {
		const match = href.match(/^(?:\.\.\/)+docs\/([^#]*?)(?:README)?\.md(#.*)?$/)
		if (!match) {
			return undefined
		}
		const route = match[1]!.replace(/\/$/, '')
		return `${route}${route ? '/' : ''}${match[2] ?? ''}`
	}

	/** The notes' Markdown with every link to a docs page pointed where `url` says that page lives. */
	static linked(markdown: string, url: (page: string) => string) {
		return markdown.replace(/\]\(((?:\.\.\/)+docs\/[^)\s]*)\)/g, (link, href: string) => {
			const page = ReleaseDocs.pageOf(href)
			return page === undefined ? link : `](${url(page)})`
		})
	}

	readonly label: string
	readonly href: string

	constructor(label: string, href: string) {
		this.label = label
		this.href = href
	}

	get page() {
		return ReleaseDocs.pageOf(this.href)
	}
}
