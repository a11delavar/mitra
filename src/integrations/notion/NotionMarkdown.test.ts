import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NotionMarkdown } from './NotionMarkdown.js'
import { type NotionBlock, type NotionRichText } from './NotionClient.js'

const text = (content: string, annotations?: NotionRichText['annotations'], href?: string): NotionRichText =>
	({ plain_text: content, ...(annotations ? { annotations } : {}), ...(href ? { href } : {}) })

const paragraph = (...runs: Array<NotionRichText>): NotionBlock =>
	({ object: 'block', id: crypto.randomUUID(), type: 'paragraph', paragraph: { rich_text: runs } })

/** Round-trip through both directions: what a body write produces must read back as the same
 * markdown — that's what keeps the write echo and the next sync's read comparing equal. */
const roundTrips = (markdown: string) =>
	assert.equal(NotionMarkdown.toMarkdown(NotionMarkdown.toBlocks(markdown)), markdown)

describe('NotionMarkdown.toMarkdown', () => {
	it('renders rich text annotations and links as markdown', () => {
		const blocks = [paragraph(
			text('Call '),
			text('them', { bold: true }),
			text(' '),
			text('now', { italic: true }),
			text(' or '),
			text('never', { strikethrough: true }),
			text(' via '),
			text('the portal', undefined, 'https://example.com/portal'),
		)]
		assert.equal(NotionMarkdown.toMarkdown(blocks), 'Call **them** *now* or ~~never~~ via [the portal](https://example.com/portal)')
	})

	it('renders code annotations without escaping their content', () => {
		assert.equal(NotionMarkdown.toMarkdown([paragraph(text('run '), text('npm --*test*', { code: true }))]), 'run `npm --*test*`')
	})

	it('escapes characters that would re-tokenize as markup', () => {
		assert.equal(NotionMarkdown.toMarkdown([paragraph(text('literal *stars* and [brackets]'))]), 'literal \\*stars\\* and \\[brackets\\]')
	})

	it('guards line starts that would turn a plain paragraph into structure', () => {
		assert.equal(NotionMarkdown.toMarkdown([paragraph(text('# not a heading'))]), '\\# not a heading')
		assert.equal(NotionMarkdown.toMarkdown([paragraph(text('1. not a list'))]), '1\\. not a list')
	})

	it('renders headings, quotes, dividers and code fences', () => {
		const blocks: Array<NotionBlock> = [
			{ type: 'heading_1', heading_1: { rich_text: [text('Plan')] } },
			{ type: 'quote', quote: { rich_text: [text('measure twice')] } },
			{ type: 'divider', divider: {} },
			{ type: 'code', code: { rich_text: [text('const x = 1')], language: 'typescript' } },
		]
		assert.equal(NotionMarkdown.toMarkdown(blocks), '# Plan\n\n> measure twice\n\n---\n\n```typescript\nconst x = 1\n```')
	})

	it('keeps consecutive list items one list and numbers ordered items', () => {
		const item = (type: string, content: string, checked?: boolean): NotionBlock =>
			({ type, [type]: { rich_text: [text(content)], ...(checked === undefined ? {} : { checked }) } } as NotionBlock)
		const blocks = [
			item('numbered_list_item', 'first'),
			item('numbered_list_item', 'second'),
			item('to_do', 'done', true),
			item('to_do', 'open', false),
		]
		assert.equal(NotionMarkdown.toMarkdown(blocks), '1. first\n2. second\n\n- [x] done\n- [ ] open')
	})

	it('indents fetched children under their list item', () => {
		const blocks: Array<NotionBlock> = [{
			type: 'bulleted_list_item',
			has_children: true,
			bulleted_list_item: {
				rich_text: [text('parent')],
				children: [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [text('child')] } }],
			},
		}]
		assert.equal(NotionMarkdown.toMarkdown(blocks), '- parent\n\t- child')
	})

	it('maps callouts onto the markdown callout syntax by color', () => {
		const blocks: Array<NotionBlock> = [{
			type: 'callout',
			callout: {
				rich_text: [text('Mind the gap')],
				color: 'red_background',
				children: [paragraph(text('really'))],
			},
			has_children: true,
		}]
		assert.equal(NotionMarkdown.toMarkdown(blocks), '> [!danger] Mind the gap\n>\n> really')
	})

	it('renders a table with its header row', () => {
		const row = (...cells: Array<string>): NotionBlock => ({ type: 'table_row', table_row: { cells: cells.map(cell => [text(cell)]) } })
		const blocks: Array<NotionBlock> = [{
			type: 'table',
			has_children: true,
			table: { table_width: 2, has_column_header: true, children: [row('Name', 'Due'), row('Report', 'Friday')] },
		}]
		assert.equal(NotionMarkdown.toMarkdown(blocks), '| Name | Due |\n| --- | --- |\n| Report | Friday |')
	})

	it('skips blocks markdown cannot express — and whole branches hiding one', () => {
		const blocks: Array<NotionBlock> = [
			paragraph(text('visible')),
			{ type: 'image', id: 'b-img' } as NotionBlock,
			{ type: 'child_page', id: 'b-page' } as NotionBlock,
			{
				// A bullet with an embed inside: replacing it would delete the embed, so ALL of it is opaque.
				type: 'bulleted_list_item',
				has_children: true,
				bulleted_list_item: { rich_text: [text('hides an embed')], children: [{ type: 'embed' } as NotionBlock] },
			},
			{
				// A quote whose children were never fetched (past the read depth) — can't be vouched for.
				type: 'quote',
				has_children: true,
				quote: { rich_text: [text('unfetched depths')] },
			},
		]
		assert.equal(NotionMarkdown.toMarkdown(blocks), 'visible')
	})
})

describe('NotionMarkdown.toBlocks', () => {
	it('parses inline markup into annotated runs', () => {
		const [block] = NotionMarkdown.toBlocks('**bold** and [a *link*](https://x.y)')
		assert.equal(block!.type, 'paragraph')
		const runs = block!.paragraph!.rich_text!
		assert.deepEqual(runs[0], { type: 'text', text: { content: 'bold' }, annotations: { bold: true } })
		assert.deepEqual(runs[1], { type: 'text', text: { content: ' and ' } })
		assert.deepEqual(runs[2], { type: 'text', text: { content: 'a ', link: { url: 'https://x.y' } } })
		assert.deepEqual(runs[3], { type: 'text', text: { content: 'link', link: { url: 'https://x.y' } }, annotations: { italic: true } })
	})

	it('clamps deep headings to Notion\'s three levels', () => {
		assert.deepEqual(NotionMarkdown.toBlocks('#### Deep').map(block => block.type), ['heading_3'])
	})

	it('parses task lists with their checked state', () => {
		const blocks = NotionMarkdown.toBlocks('- [x] done\n- [ ] open')
		assert.deepEqual(blocks.map(block => [block.type, block.to_do?.checked]), [['to_do', true], ['to_do', false]])
	})

	it('nests markdown list children into the payload, clamped at Notion\'s two levels', () => {
		const blocks = NotionMarkdown.toBlocks('- a\n\t- b\n\t\t- c\n\t\t\t- d')
		const a = blocks[0]!
		const b = a.bulleted_list_item!.children![0]!
		const c = b.bulleted_list_item!.children![0]!
		assert.equal(c.bulleted_list_item!.rich_text![0]!.text!.content, 'c')
		// `d` cannot nest a third level down in one write — it flattens to c's sibling, content intact.
		assert.equal(c.bulleted_list_item!.children, undefined)
		assert.equal(b.bulleted_list_item!.children![1]!.bulleted_list_item!.rich_text![0]!.text!.content, 'd')
	})

	it('maps markdown callouts to Notion callout blocks', () => {
		const [block] = NotionMarkdown.toBlocks('> [!warning] Heads up\n>\n> the details')
		assert.equal(block!.type, 'callout')
		assert.equal(block!.callout!.color, 'yellow_background')
		assert.equal(block!.callout!.rich_text![0]!.text!.content, 'Heads up')
		assert.equal(block!.callout!.children![0]!.paragraph!.rich_text![0]!.text!.content, 'the details')
	})

	it('falls back to plain text for a code language Notion does not know, and maps aliases', () => {
		assert.equal(NotionMarkdown.toBlocks('```ts\nx\n```')[0]!.code!.language, 'typescript')
		assert.equal(NotionMarkdown.toBlocks('```brainfuck\nx\n```')[0]!.code!.language, 'plain text')
	})

	it('splits text past Notion\'s per-run cap into multiple runs', () => {
		const [block] = NotionMarkdown.toBlocks('a'.repeat(4500))
		assert.deepEqual(block!.paragraph!.rich_text!.map(run => run.text!.content.length), [2000, 2000, 500])
	})

	it('degrades an inline image to a link on its alt text (Notion has no inline image)', () => {
		const [block] = NotionMarkdown.toBlocks('see ![the chart](https://example.com/chart.png)')
		assert.deepEqual(block!.paragraph!.rich_text![1], { type: 'text', text: { content: 'the chart', link: { url: 'https://example.com/chart.png' } } })
	})

	it('parses tables into table blocks with row children', () => {
		const [block] = NotionMarkdown.toBlocks('| a | b |\n| --- | --- |\n| 1 | 2 |')
		assert.equal(block!.type, 'table')
		assert.equal(block!.table!.table_width, 2)
		assert.deepEqual(block!.table!.children!.map(row => row.table_row!.cells!.map(cell => cell[0]?.text?.content)), [['a', 'b'], ['1', '2']])
	})
})

describe('NotionMarkdown round-trips', () => {
	it('keeps every supported construct stable across write → read', () => {
		roundTrips('# Plan')
		roundTrips('Call **them** *now* or ~~never~~ via [the portal](https://example.com/portal)')
		roundTrips('- one\n- two\n\t- nested')
		roundTrips('1. first\n2. second')
		roundTrips('- [x] done\n- [ ] open')
		roundTrips('> measure twice')
		roundTrips('> [!tip] Shortcut\n>\n> use the side door')
		roundTrips('```typescript\nconst x = 1\n```')
		roundTrips('---')
		roundTrips('| a | b |\n| --- | --- |\n| 1 | 2 |')
		roundTrips('para one\n\npara two')
		roundTrips('literal \\*stars\\* and \\[brackets\\]')
	})
})
