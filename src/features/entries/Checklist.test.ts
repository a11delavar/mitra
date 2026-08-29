import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Checklist } from './Checklist.js'

describe('Checklist', () => {
	const of = (...lines: Array<string>) => Checklist.of(lines.join('\n'))

	it('reads the boxes a description holds, in the order they are written', () => {
		const checklist = of('Before the trip:', '', '- [x] Laundry', '- [ ] Wardrobe', '* [X] Cables')
		assert.deepEqual(checklist.items.map(item => item.text), ['Laundry', 'Wardrobe', 'Cables'])
		assert.deepEqual([checklist.done, checklist.total, checklist.progress], [2, 3, 2 / 3])
	})

	it('counts a numbered and an indented list too, and a box inside a quote', () => {
		const checklist = of('1. [ ] First', '2) [x] Second', '  - [ ] Nested', '> - [x] Quoted')
		assert.deepEqual([checklist.done, checklist.total], [2, 4])
	})

	it('is empty for a description with nothing to tick', () => {
		assert.equal(of('Just prose, and a [link](https://example.com).').isEmpty, true)
		assert.equal(Checklist.of(undefined).progress, undefined)
	})

	it('is not fooled by a bare bracket pair, nor by a box with no content behind it', () => {
		assert.equal(of('- [ ]', '- [x]  ', '- [] Wrong', '- [y] Wrong', 'Not a list [ ] item').isEmpty, true)
	})

	it('leaves the syntax shown inside a fenced block alone — that is an example, not a step', () => {
		const checklist = of('- [ ] Real', '', '```markdown', '- [ ] Example', '- [x] Example', '```', '', '- [x] Also real')
		assert.deepEqual(checklist.items.map(item => item.text), ['Real', 'Also real'])
	})

	it('flips one box and returns the whole description, everything else untouched', () => {
		const source = ['# Trip', '', '- [ ] Laundry', '- [ ] Wardrobe'].join('\n')
		const ticked = Checklist.of(source).toggle(1)
		assert.equal(ticked, ['# Trip', '', '- [ ] Laundry', '- [x] Wardrobe'].join('\n'))
		assert.equal(Checklist.of(ticked).toggle(1), source)
	})

	it('keeps the item\'s own indentation and marker when it flips', () => {
		assert.equal(Checklist.of('   1. [x] Deep').toggle(0), '   1. [ ] Deep')
	})

	it('takes a state instead of flipping, and leaves an index nothing answers to alone', () => {
		const source = '- [ ] Laundry'
		assert.equal(Checklist.of(source).toggle(0, false), source)
		assert.equal(Checklist.of(source).toggle(7), source)
	})
})
