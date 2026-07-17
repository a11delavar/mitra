import { Lexer, type Token, type Tokens } from 'marked'
import { type NotionAnnotations, type NotionBlock, type NotionBlockContent, type NotionRichText } from './NotionClient.js'

/**
 * Notion page bodies ↔ mitra's markdown descriptions — what makes `description` a supported
 * capability for Notion (see {@link Notion.capabilities}).
 *
 * The invariant both directions uphold: **a description edit replaces exactly what the description
 * shows.** {@link toMarkdown} renders only blocks it can fully re-author (checked recursively by
 * {@link isReplaceable} — a bullet hiding an embed deep inside is excluded wholesale), and the
 * write pass deletes only those, appending the new content after whatever it preserved. So
 * collaborative content markdown can't express — images (Notion-hosted urls expire within the
 * hour), embeds, sub-pages, synced blocks, nesting past the fetch depth — stays invisible AND
 * untouched, which is what makes a shared page body safe to edit from a plain markdown field.
 *
 * Parsing uses the same `marked` (GFM) the frontend renders descriptions with, so what the editor
 * previews is what Notion receives — including the `> [!type]` callouts MarkdownRenderer styles,
 * which map onto Notion callout blocks.
 */
export class NotionMarkdown {
	/** Block types with a faithful markdown form — the ONLY types either direction touches. */
	private static readonly convertibleTypes = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout', 'code', 'divider', 'table', 'table_row'])

	/** The types whose children carry convertible content (nested list items, quote/callout bodies,
	 * table rows) — the body reader descends into these. A paragraph's indented children have no
	 * markdown form, so they stay unfetched and make their parent opaque instead. */
	static readonly containerTypes = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout', 'table'])

	private static readonly listTypes = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do'])

	/** Notion caps a rich text run at 2000 characters — longer text is split across runs. */
	private static readonly maxRunLength = 2000

	/** Notion caps write-payload nesting at two levels below the top — the body reader fetches
	 * exactly that deep, so whatever the description shows, a write can faithfully re-author. */
	static readonly maxNestingDepth = 2

	/** Notion's `code.language` enum. An unknown fence language falls back to 'plain text' rather
	 * than 400-ing the write; reads keep Notion's name as the fence info string. */
	private static readonly codeLanguages = new Set(['abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#', 'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran', 'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'html', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript', 'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c', 'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml'])

	private static readonly codeAliases = new Map([
		['js', 'javascript'], ['jsx', 'javascript'], ['ts', 'typescript'], ['tsx', 'typescript'],
		['py', 'python'], ['rb', 'ruby'], ['rs', 'rust'], ['sh', 'shell'], ['zsh', 'shell'],
		['yml', 'yaml'], ['md', 'markdown'], ['cs', 'c#'], ['csharp', 'c#'], ['cpp', 'c++'],
		['golang', 'go'], ['dockerfile', 'docker'], ['objc', 'objective-c'], ['ps1', 'powershell'],
		['text', 'plain text'], ['txt', 'plain text'], ['', 'plain text'],
	])

	/** mitra's markdown callout types (`> [!type]`, see MarkdownRenderer) → Notion callout colors… */
	private static readonly calloutColors = new Map([
		['note', 'gray_background'], ['info', 'blue_background'], ['tip', 'green_background'],
		['success', 'green_background'], ['important', 'purple_background'], ['warning', 'yellow_background'],
		['caution', 'orange_background'], ['danger', 'red_background'], ['error', 'red_background'],
	])

	/** …and back (background and plain foreground variants alike); anything unmapped reads as 'note'. */
	private static readonly calloutTypes = new Map([
		['blue_background', 'info'], ['blue', 'info'], ['green_background', 'tip'], ['green', 'tip'],
		['purple_background', 'important'], ['purple', 'important'], ['yellow_background', 'warning'], ['yellow', 'warning'],
		['orange_background', 'caution'], ['orange', 'caution'], ['red_background', 'danger'], ['red', 'danger'],
	])

	/** The type-keyed content payload (`block[block.type]`) — where rich text lives and children
	 * attach (see {@link NotionBlockContent}). */
	static contentOf(block: NotionBlock): NotionBlockContent | undefined {
		return (block as unknown as Record<string, NotionBlockContent | undefined>)[block.type]
	}

	/**
	 * Whether a block — with every descendant — can be re-authored from its markdown form. Only
	 * replaceable blocks are rendered into the description and deleted by a description write.
	 * A block whose children exist but weren't fetched (an unsupported container, or nesting past
	 * the read depth) can't be vouched for, so it counts as opaque wholesale.
	 */
	static isReplaceable(block: NotionBlock): boolean {
		if (!NotionMarkdown.convertibleTypes.has(block.type)) {
			return false
		}
		const children = NotionMarkdown.contentOf(block)?.children
		return block.has_children && !children
			? false
			: (children ?? []).every(child => NotionMarkdown.isReplaceable(child))
	}

	// --- Blocks → markdown ------------------------------------------------------------------------

	static toMarkdown(blocks: Array<NotionBlock>): string {
		return NotionMarkdown.blocksToMarkdown(blocks.filter(block => NotionMarkdown.isReplaceable(block)))
	}

	private static blocksToMarkdown(blocks: Array<NotionBlock>): string {
		const parts: Array<string> = []
		let number = 1
		let previousType: string | undefined
		for (const block of blocks) {
			number = block.type === 'numbered_list_item' && previousType === 'numbered_list_item' ? number + 1 : 1
			const text = NotionMarkdown.blockToMarkdown(block, number)
			if (text === undefined) {
				continue
			}
			// Consecutive same-type list items stay one list (single newline); anything else separates.
			parts.push(parts.length === 0 ? '' : NotionMarkdown.listTypes.has(block.type) && previousType === block.type ? '\n' : '\n\n', text)
			previousType = block.type
		}
		return parts.join('')
	}

	private static blockToMarkdown(block: NotionBlock, number: number): string | undefined {
		const content = NotionMarkdown.contentOf(block) ?? {}
		const inline = NotionMarkdown.runsToMarkdown(content.rich_text)
		const children = content.children ?? []
		switch (block.type) {
			case 'paragraph':
				return NotionMarkdown.guardLineStarts(inline)
			case 'heading_1':
				return `# ${inline}`
			case 'heading_2':
				return `## ${inline}`
			case 'heading_3':
				return `### ${inline}`
			case 'bulleted_list_item':
				return NotionMarkdown.listItem(`- ${inline}`, children)
			case 'numbered_list_item':
				return NotionMarkdown.listItem(`${number}. ${inline}`, children)
			case 'to_do':
				return NotionMarkdown.listItem(`- [${content.checked ? 'x' : ' '}] ${inline}`, children)
			case 'quote':
				return NotionMarkdown.quoted([inline, children.length ? NotionMarkdown.blocksToMarkdown(children) : ''].filter(Boolean).join('\n\n'))
			case 'callout': {
				const type = NotionMarkdown.calloutTypes.get(content.color ?? '') ?? 'note'
				const body = children.length ? NotionMarkdown.blocksToMarkdown(children) : ''
				return NotionMarkdown.quoted(`[!${type}] ${inline}`.trimEnd() + (body ? `\n\n${body}` : ''))
			}
			case 'code': {
				const text = (content.rich_text ?? []).map(run => run.plain_text ?? run.text?.content ?? '').join('')
				return `\`\`\`${content.language === 'plain text' ? '' : content.language ?? ''}\n${text}\n\`\`\``
			}
			case 'divider':
				return '---'
			case 'table': {
				const rows = children.filter(row => row.type === 'table_row').map(row =>
					(NotionMarkdown.contentOf(row)?.cells ?? []).map(cell =>
						NotionMarkdown.runsToMarkdown(cell).replaceAll('|', '\\|').replaceAll('\n', ' ')))
				if (!rows.length) {
					return undefined
				}
				const width = Math.max(...rows.map(row => row.length), content.table_width ?? 0, 1)
				const line = (cells: Array<string>) => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`
				// Markdown tables require a header — a header-less Notion table gets an empty one.
				const [header, ...body] = content.has_column_header === false ? [[], ...rows] : rows
				return [line(header!), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n')
			}
			default:
				return undefined // table_row renders through its table; nothing else is replaceable
		}
	}

	private static listItem(line: string, children: Array<NotionBlock>): string {
		// Tab continuation-indent satisfies both `- ` and `1. ` content columns.
		return !children.length ? line : `${line}\n${NotionMarkdown.blocksToMarkdown(children).split('\n').map(child => child ? `\t${child}` : child).join('\n')}`
	}

	private static quoted(text: string): string {
		return text.split('\n').map(line => line ? `> ${line}` : '>').join('\n')
	}

	private static runsToMarkdown(runs: Array<NotionRichText> | undefined): string {
		return (runs ?? []).map(run => {
			const content = run.plain_text ?? run.text?.content ?? ''
			const annotations = run.annotations ?? {}
			const url = run.href ?? run.text?.link?.url ?? undefined
			let text = annotations.code ? NotionMarkdown.codeSpan(content) : NotionMarkdown.escape(content)
			if (!annotations.code) {
				if (annotations.strikethrough) {
					text = `~~${text}~~`
				}
				if (annotations.italic) {
					text = `*${text}*`
				}
				if (annotations.bold) {
					text = `**${text}**`
				}
			}
			return url ? `[${text}](${url})` : text
		}).join('')
	}

	private static codeSpan(content: string): string {
		const longestBacktickRun = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0)
		const delimiter = '`'.repeat(longestBacktickRun + 1)
		return longestBacktickRun ? `${delimiter} ${content} ${delimiter}` : `\`${content}\``
	}

	/** Inline characters that would re-tokenize as markup on the way back in. */
	private static escape(text: string): string {
		return text.replaceAll(/([\\`*_~[\]<])/g, '\\$1')
	}

	/** Line-leading characters that would turn a plain paragraph line into a heading/quote/list. */
	private static guardLineStarts(text: string): string {
		return text.split('\n').map(line => line
			.replace(/^(#{1,6}\s|>|[-+]\s)/, '\\$&')
			.replace(/^(\d+)([.)])(\s)/, '$1\\$2$3')).join('\n')
	}

	// --- Markdown → blocks ------------------------------------------------------------------------

	static toBlocks(markdown: string): Array<NotionBlock> {
		return NotionMarkdown.tokensToBlocks(Lexer.lex(markdown), 0)
	}

	private static tokensToBlocks(tokens: Array<Token>, depth: number): Array<NotionBlock> {
		const blocks: Array<NotionBlock> = []
		for (const token of tokens) {
			switch (token.type) {
				case 'space':
				case 'def':
					break
				case 'paragraph':
					blocks.push({ type: 'paragraph', paragraph: { rich_text: NotionMarkdown.runsOf((token as Tokens.Paragraph).tokens) } })
					break
				case 'heading': {
					// Notion has three heading levels — deeper markdown headings clamp to the smallest.
					const level = Math.min((token as Tokens.Heading).depth, 3)
					blocks.push({ type: `heading_${level}`, [`heading_${level}`]: { rich_text: NotionMarkdown.runsOf((token as Tokens.Heading).tokens) } } as NotionBlock)
					break
				}
				case 'code': {
					const code = token as Tokens.Code
					blocks.push({ type: 'code', code: { rich_text: NotionMarkdown.textRuns(code.text), language: NotionMarkdown.languageOf(code.lang) } })
					break
				}
				case 'hr':
					blocks.push({ type: 'divider', divider: {} })
					break
				case 'blockquote':
					blocks.push(...NotionMarkdown.quoteBlocks(token as Tokens.Blockquote, depth))
					break
				case 'list':
					blocks.push(...NotionMarkdown.listBlocks(token as Tokens.List, depth))
					break
				case 'table':
					blocks.push(NotionMarkdown.tableBlock(token as Tokens.Table))
					break
				default:
					// Raw HTML and stray top-level text have no block form — keep their text as a paragraph.
					blocks.push({ type: 'paragraph', paragraph: { rich_text: NotionMarkdown.runsOf('tokens' in token && token.tokens ? token.tokens : [token]) } })
			}
		}
		return blocks
	}

	/** Nest `children` inside `content` while Notion's payload cap allows; past it, hand them back
	 * to flatten as siblings — content preserved, structure clamped. */
	private static nest(content: NotionBlockContent, children: Array<NotionBlock>, depth: number): Array<NotionBlock> {
		if (!children.length) {
			return []
		}
		if (depth < NotionMarkdown.maxNestingDepth) {
			content.children = children
			return []
		}
		return children
	}

	private static listBlocks(list: Tokens.List, depth: number): Array<NotionBlock> {
		const blocks: Array<NotionBlock> = []
		for (const item of list.items) {
			const type = item.task ? 'to_do' : list.ordered ? 'numbered_list_item' : 'bulleted_list_item'
			// The item's leading text/paragraph is ITS inline content ('checkbox' is the task marker,
			// already lifted into item.checked); everything after nests below it.
			const inner = item.tokens.filter(token => token.type !== 'checkbox')
			const [first, ...rest] = inner
			const leading = first?.type === 'text' || first?.type === 'paragraph' ? first as Tokens.Text : undefined
			const content: NotionBlockContent = {
				rich_text: NotionMarkdown.runsOf(leading?.tokens ?? (leading ? [leading] : [])),
				...(item.task ? { checked: !!item.checked } : {}),
			}
			const overflow = NotionMarkdown.nest(content, NotionMarkdown.tokensToBlocks(leading ? rest : inner, depth + 1), depth)
			blocks.push({ type, [type]: content } as NotionBlock, ...overflow)
		}
		return blocks
	}

	private static quoteBlocks(quote: Tokens.Blockquote, depth: number): Array<NotionBlock> {
		const [first, ...rest] = quote.tokens
		const firstParagraph = first?.type === 'paragraph' ? first as Tokens.Paragraph : undefined
		// A `[!type]`-led quote is one of MarkdownRenderer's callouts: first line = type + title,
		// the rest of the quote is the callout body.
		const callout = firstParagraph?.text.match(/^\[!(\w+)\]([^\n]*)\n?([\s\S]*)$/)
		if (callout) {
			const [, type, title, remainder] = callout
			const body = [
				...(remainder?.trim() ? NotionMarkdown.tokensToBlocks(Lexer.lex(remainder), depth + 1) : []),
				...NotionMarkdown.tokensToBlocks(rest, depth + 1),
			]
			// A title-less callout promotes its first paragraph to the callout line (Notion's own shape).
			const titled = title?.trim() ? NotionMarkdown.runsOf(Lexer.lexInline(title.trim())) : undefined
			const lead = !titled && body[0]?.type === 'paragraph' ? body.shift() : undefined
			const content: NotionBlockContent = {
				rich_text: titled ?? (lead ? NotionMarkdown.contentOf(lead)?.rich_text ?? [] : []),
				color: NotionMarkdown.calloutColors.get(type!.toLowerCase()) ?? 'gray_background',
			}
			const overflow = NotionMarkdown.nest(content, body, depth)
			return [{ type: 'callout', callout: content }, ...overflow]
		}
		const content: NotionBlockContent = { rich_text: firstParagraph ? NotionMarkdown.runsOf(firstParagraph.tokens) : [] }
		const overflow = NotionMarkdown.nest(content, NotionMarkdown.tokensToBlocks(firstParagraph ? rest : quote.tokens, depth + 1), depth)
		return [{ type: 'quote', quote: content }, ...overflow]
	}

	private static tableBlock(table: Tokens.Table): NotionBlock {
		const row = (cells: Array<Tokens.TableCell>): NotionBlock => ({
			type: 'table_row',
			table_row: { cells: cells.map(cell => NotionMarkdown.runsOf(cell.tokens)) },
		})
		return {
			type: 'table',
			table: {
				table_width: table.header.length,
				has_column_header: true,
				children: [row(table.header), ...table.rows.map(row)],
			},
		}
	}

	private static runsOf(tokens: Array<Token> | undefined, style: NotionAnnotations = {}, link?: string): Array<NotionRichText> {
		const runs: Array<NotionRichText> = []
		for (const token of tokens ?? []) {
			switch (token.type) {
				case 'strong':
					runs.push(...NotionMarkdown.runsOf((token as Tokens.Strong).tokens, { ...style, bold: true }, link))
					break
				case 'em':
					runs.push(...NotionMarkdown.runsOf((token as Tokens.Em).tokens, { ...style, italic: true }, link))
					break
				case 'del':
					runs.push(...NotionMarkdown.runsOf((token as Tokens.Del).tokens, { ...style, strikethrough: true }, link))
					break
				case 'link':
					runs.push(...NotionMarkdown.runsOf((token as Tokens.Link).tokens, style, (token as Tokens.Link).href))
					break
				case 'codespan':
					runs.push(...NotionMarkdown.textRuns((token as Tokens.Codespan).text, { ...style, code: true }, link))
					break
				case 'image': {
					// No inline image in Notion — degrade to a link on the alt text.
					const image = token as Tokens.Image
					runs.push(...NotionMarkdown.textRuns(image.text || image.href, style, image.href))
					break
				}
				case 'br':
					runs.push(...NotionMarkdown.textRuns('\n', style, link))
					break
				case 'escape':
					runs.push(...NotionMarkdown.textRuns((token as Tokens.Escape).text, style, link))
					break
				case 'text': {
					const text = token as Tokens.Text
					runs.push(...(text.tokens?.length ? NotionMarkdown.runsOf(text.tokens, style, link) : NotionMarkdown.textRuns(text.text, style, link)))
					break
				}
				default:
					runs.push(...NotionMarkdown.textRuns('text' in token ? String(token.text) : token.raw ?? '', style, link))
			}
		}
		return runs
	}

	private static textRuns(content: string, annotations: NotionAnnotations = {}, link?: string): Array<NotionRichText> {
		if (!content) {
			return []
		}
		const flags = Object.fromEntries(Object.entries(annotations).filter(([, value]) => value))
		const runs: Array<NotionRichText> = []
		for (let index = 0; index < content.length; index += NotionMarkdown.maxRunLength) {
			runs.push({
				type: 'text',
				text: { content: content.slice(index, index + NotionMarkdown.maxRunLength), ...(link ? { link: { url: link } } : {}) },
				...(Object.keys(flags).length ? { annotations: flags } : {}),
			})
		}
		return runs
	}

	private static languageOf(lang: string | undefined): string {
		const name = lang?.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
		return NotionMarkdown.codeLanguages.has(name) ? name : NotionMarkdown.codeAliases.get(name) ?? 'plain text'
	}
}
