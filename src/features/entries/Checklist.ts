/**
 * Parsed GFM task-list items (`- [ ]` / `- [x]`) within an entry description.
 * Counts towards progress rollups alongside subtasks; toggling mutates description text.
 */
export interface ChecklistItem {
	readonly line: number
	readonly checked: boolean
	readonly text: string
}

export class Checklist {
	private static readonly marker = /^(\s*(?:>[ \t]*)*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\](?=[ \t]+\S)/
	private static readonly fence = /^\s*(?:```|~~~)/

	static of(description: string | null | undefined): Checklist {
		const source = description ?? ''
		const lines = source.split('\n')
		const items = new Array<ChecklistItem>()
		let fenced = false
		for (const [line, text] of lines.entries()) {
			if (Checklist.fence.test(text)) {
				fenced = !fenced
			} else if (!fenced) {
				const match = Checklist.marker.exec(text)
				if (match) {
					items.push({ line, checked: match[2] !== ' ', text: text.slice(match[0].length).trim() })
				}
			}
		}
		return new Checklist(source, items)
	}

	private constructor(private readonly source: string, readonly items: ReadonlyArray<ChecklistItem>) { }

	get total() { return this.items.length }

	get done() { return this.items.filter(item => item.checked).length }

	get isEmpty() { return this.items.length === 0 }

	/** Completion ratio (0..1), or undefined when empty. */
	get progress(): number | undefined {
		return this.total ? this.done / this.total : undefined
	}

	/** Returns updated description text with the checkbox at index set to checked. */
	toggle(index: number, checked = !this.items[index]?.checked): string {
		const item = this.items[index]
		if (!item) {
			return this.source
		}
		const lines = this.source.split('\n')
		lines[item.line] = lines[item.line]!.replace(Checklist.marker, (_, lead: string) => `${lead}[${checked ? 'x' : ' '}]`)
		return lines.join('\n')
	}
}
