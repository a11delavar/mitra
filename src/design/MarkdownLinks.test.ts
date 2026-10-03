import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type Tokens } from 'marked'
import { MarkdownLinks } from './MarkdownLinks.js'

const linksIn = (markdown: string) => {
	const links = new Array<Tokens.Link>()
	MarkdownLinks.marked.walkTokens(MarkdownLinks.marked.lexer(markdown), token => {
		if (token.type === 'link') {
			links.push(token as Tokens.Link)
		}
	})
	return links
}
const hrefs = (markdown: string) => linksIn(markdown).map(link => link.href)

describe('MarkdownLinks', () => {
	it('reads bare app links beside web autolinks and written links, in document order', () => {
		assert.deepEqual(hrefs('See obsidian://open?vault=V&file=Note, then [the doc](https://example.com/doc) and www.example.org.'), [
			'obsidian://open?vault=V&file=Note',
			'https://example.com/doc',
			'http://www.example.org',
		])
	})

	it('leaves prose colons and code alone', () => {
		assert.deepEqual(hrefs('Time: 10am, note:check, `obsidian://code`\n\n```\nobsidian://fenced\n```'), [])
	})

	it('reads a scheme only as a whole word', () => {
		assert.deepEqual(hrefs('see_obsidian://a and abc-obsidian://b'), ['obsidian://a', 'abc-obsidian://b'])
	})

	it('ends a bare app link before a sentence\'s punctuation', () => {
		assert.deepEqual(hrefs('(see obsidian://open?file=A.) and zoommtg://zoom.us/join?confno=1!'), [
			'obsidian://open?file=A',
			'zoommtg://zoom.us/join?confno=1',
		])
	})

	it('never makes a link of a scheme that runs code', () => {
		assert.deepEqual(hrefs('javascript://%0aalert(1) _javascript://x'), [])
		for (const href of ['javascript:alert(1)', 'JavaScript://x', 'data:text/html,x', 'file:///etc/passwd', 'vbscript:x']) {
			assert.equal(MarkdownLinks.allows(href), false, href)
		}
		assert.equal(MarkdownLinks.allows('obsidian://open'), true)
	})

	it('tells bare addresses from written links', () => {
		assert.deepEqual(linksIn('[**Barcode** API](https://example.com/api) https://example.com <https://example.org> [https://example.net](https://example.net)')
			.map(link => MarkdownLinks.isBare(link)), [false, true, true, true])
	})

	it('reads a text that is wholly one link', () => {
		assert.equal(MarkdownLinks.sole(' https://meet.google.com/abc-defg-hij '), 'https://meet.google.com/abc-defg-hij')
		assert.equal(MarkdownLinks.sole('obsidian://open?vault=V&file=Note'), 'obsidian://open?vault=V&file=Note')
		assert.equal(MarkdownLinks.sole('www.example.com/x'), 'http://www.example.com/x')
		assert.equal(MarkdownLinks.sole('organizer@example.com'), 'mailto:organizer@example.com')
		for (const place of ['Room:4', 'Berlin, Hauptbahnhof', 'Meet at https://example.com', 'www', 'Note: bring cake', '', 'javascript://x']) {
			assert.equal(MarkdownLinks.sole(place), undefined, place)
		}
	})

	it('finds links inside lists and quotes', () => {
		assert.deepEqual(hrefs('# Plan\n\n- [ ] Read https://example.com/a\n> quoted obsidian://open?file=B\n'), [
			'https://example.com/a',
			'obsidian://open?file=B',
		])
	})

	it('lists each destination once, with the words it was written with', () => {
		assert.deepEqual(MarkdownLinks.of('https://example.com, again [here](https://example.com), and [the **spec**](obsidian://open?file=Spec)'), [
			{ href: 'https://example.com', words: undefined },
			{ href: 'obsidian://open?file=Spec', words: 'the spec' },
		])
	})
})
