import { Marked, type Tokens } from 'marked'

/**
 * The app's Markdown dialect: GFM, plus bare `scheme://` addresses of apps (`obsidian://…`), which GFM leaves
 * as text. Never the global `marked`: the Notion serializer lexes with that one.
 */
export class MarkdownLinks {
	/** Schemes that run code or reach into the device are never links. */
	static readonly deniedSchemes = new Set(['javascript:', 'vbscript:', 'data:', 'blob:', 'file:', 'about:', 'chrome:', 'filesystem:'])

	static allows(href: string) {
		const url = URL.parse(href, globalThis.location?.href)
		return !!url && !MarkdownLinks.deniedSchemes.has(url.protocol)
	}

	/** The links a text holds, once per destination in document order, each with the words it was written with, if any. */
	static of(markdown: string | null | undefined): Array<{ href: string, words?: string }> {
		const links = new Map<string, string | undefined>()
		MarkdownLinks.marked.walkTokens(MarkdownLinks.marked.lexer(markdown ?? ''), token => {
			const link = token as Tokens.Link
			if (token.type === 'link' && MarkdownLinks.allows(link.href) && !links.has(link.href)) {
				links.set(link.href, MarkdownLinks.isBare(link) ? undefined : new MarkdownLinks.marked.Parser().parseInline(link.tokens, new MarkdownLinks.marked.TextRenderer()))
			}
		})
		return [...links].map(([href, words]) => ({ href, words }))
	}

	/** Whether any link or image goes to a destination `matches`. */
	static mentions(markdown: string | null | undefined, matches: (href: string) => boolean): boolean {
		let found = false
		MarkdownLinks.marked.walkTokens(MarkdownLinks.marked.lexer(markdown ?? ''), token => {
			found ||= (token.type === 'link' || token.type === 'image') && matches((token as Tokens.Link | Tokens.Image).href)
		})
		return found
	}

	/** The text without the links and images whose destination is `refused`, words and all, blank lines they leave collapsed. */
	static without<T extends string | null | undefined>(markdown: T, refused: (href: string) => boolean): T {
		const raws = new Set<string>()
		MarkdownLinks.marked.walkTokens(MarkdownLinks.marked.lexer(markdown ?? ''), token => {
			if ((token.type === 'link' || token.type === 'image') && refused((token as Tokens.Link | Tokens.Image).href)) {
				raws.add(token.raw)
			}
		})
		if (!raws.size) {
			return markdown
		}
		// An image's text holds its link's, so the longer goes first.
		return [...raws].sort((a, b) => b.length - a.length).reduce<string>((text, raw) => text.replaceAll(raw, ''), markdown!).replace(/\n{3,}/g, '\n\n').trim() as T
	}

	/** Whether the link shows its own address, which the link component then replaces with its destination's words. */
	static isBare(link: Pick<Tokens.Link, 'raw' | 'href' | 'text'>) {
		return !link.raw.startsWith('[') || link.text === link.href
	}

	/** The address a text consists of entirely, as a location holding a meeting link does; any other words make it no link. */
	static sole(text: string | null | undefined): string | undefined {
		const trimmed = text?.trim() ?? ''
		const [block] = trimmed ? MarkdownLinks.marked.lexer(trimmed) : []
		const [token] = block?.type === 'paragraph' ? (block as Tokens.Paragraph).tokens : []
		return token?.type === 'link' && token.raw === trimmed && MarkdownLinks.allows((token as Tokens.Link).href)
			? (token as Tokens.Link).href
			: undefined
	}

	static readonly marked = new Marked({
		extensions: [{
			name: 'appLink',
			level: 'inline',
			start: src => /[a-z][a-z0-9+.-]{1,31}:\/\//i.exec(src)?.index,
			tokenizer(src, tokens) {
				// The last character may not be a sentence's punctuation, so `see obsidian://x.` ends before the full stop.
				const address = /^([a-z][a-z0-9+.-]{1,31}):\/\/[^\s<>]*[^\s<>.,:;!?'")\]*_~]/i.exec(src)
				// A scheme is a whole word; `start` sees no further back than its cut, so the boundary is read off the token before.
				const midWord = /[a-z0-9+.-]$/i.test(tokens.at(-1)?.raw ?? '')
				if (!address || midWord || /^(https?|ftp)$/i.test(address[1]!) || !MarkdownLinks.allows(address[0])) {
					return undefined
				}
				const raw = address[0]
				return { type: 'link', raw, href: raw, text: raw, tokens: [{ type: 'text', raw, text: raw }] }
			},
		}],
	})
}
