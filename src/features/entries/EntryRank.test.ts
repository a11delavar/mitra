import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryRank } from './EntryRank.js'

const rank = (key: string) => EntryRank.parse(key)
const between = (previous?: string, next?: string) => EntryRank.between(previous ? rank(previous) : undefined, next ? rank(next) : undefined).key

describe('EntryRank', () => {
	it('starts an empty order at a0', () => {
		assert.equal(EntryRank.first.key, 'a0')
		assert.equal(between(), 'a0')
	})

	it('comes after by counting the integer part instead of growing a fraction', () => {
		assert.equal(rank('a0').after().key, 'a1')
		assert.equal(rank('az').after().key, 'b00')
		assert.equal(rank('a0V').after().key, 'a1')
		assert.equal(between('b00'), 'b01')
	})

	it('comes before by counting down into the negative range', () => {
		assert.equal(rank('a0').before().key, 'Zz')
		assert.equal(rank('Zz').before().key, 'Zy')
		assert.equal(rank('Z0').before().key, 'Yzz')
		assert.equal(between(undefined, 'a0'), 'Zz')
	})

	it('falls between two ranks with a minimal fraction', () => {
		assert.equal(between('a0', 'a1'), 'a0V')
		assert.equal(between('a0', 'a0V'), 'a0G')
		assert.equal(between('a0V', 'a1'), 'a0l')
	})

	it('prefers a plain integer between ranks of different integer parts', () => {
		assert.equal(between('a0', 'a2'), 'a1')
		assert.equal(between('a0', 'a1V'), 'a1')
	})

	it('never ends a fraction in the smallest digit, so every rank has one key', () => {
		let next = rank('a1')
		for (let i = 0; i < 100; i++) {
			next = EntryRank.between(rank('a0'), next)
			assert.notEqual(next.key.at(-1), '0')
		}
	})

	it('refuses neighbors that are not in order, which is how a collision shows', () => {
		assert.throws(() => between('a1', 'a1'), RangeError)
		assert.throws(() => between('a2', 'a1'), RangeError)
	})

	it('parses only well-formed keys', () => {
		assert.throws(() => rank(''), RangeError)
		assert.throws(() => rank('1x'), RangeError)
		assert.throws(() => rank('a10'), RangeError)
		assert.throws(() => rank('A' + '0'.repeat(26)), RangeError)
		assert.equal(rank('a0V').key, 'a0V')
	})

	it('stays strictly ordered through thousands of arbitrary placements', () => {
		const ranks = [EntryRank.first]
		let seed = 42
		const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
		for (let i = 0; i < 2000; i++) {
			const at = Math.floor(random() * (ranks.length + 1))
			ranks.splice(at, 0, EntryRank.between(ranks[at - 1], ranks[at]))
		}
		for (let i = 1; i < ranks.length; i++) {
			assert.ok(ranks[i - 1]!.isBefore(ranks[i]!), `'${ranks[i - 1]}' before '${ranks[i]}'`)
		}
		assert.ok(Math.max(...ranks.map(each => each.key.length)) < 20)
	})

	it('compares by its key, with unranked entries last', () => {
		assert.ok(rank('a0').compare(rank('a1')) < 0)
		assert.ok(rank('a1').compare(rank('a0')) > 0)
		assert.equal(rank('a0').compare(rank('a0')), 0)
		assert.ok(EntryRank.compare(rank('b00'), null) < 0)
		assert.ok(EntryRank.compare(null, rank('a0')) > 0)
		assert.equal(EntryRank.compare(null, undefined), 0)
	})

	it('lets two neighbors decide a rank only when both have one and they are in order', () => {
		assert.equal(EntryRank.tryBetween(rank('a0'), rank('a1'))?.key, 'a0V')
		assert.equal(EntryRank.tryBetween(undefined, rank('a0'))?.key, 'Zz')
		assert.equal(EntryRank.tryBetween(rank('a0'), null), undefined)
		assert.equal(EntryRank.tryBetween(null, undefined), undefined)
		assert.equal(EntryRank.tryBetween(rank('a1'), rank('a1')), undefined)
	})

	it('counts out consecutive ranks for a list ranked afresh', () => {
		assert.deepEqual(EntryRank.sequence(3).map(each => each.key), ['a0', 'a1', 'a2'])
		assert.deepEqual(EntryRank.sequence(0), [])
	})

	it('travels as its key and comes back as a rank', () => {
		assert.equal(EntryRank.converter.deconstruct!(rank('a0V'), {}), 'a0V')
		assert.equal(EntryRank.converter.construct!('a0V', {})?.key, 'a0V')
		assert.equal(EntryRank.converter.construct!(null, {}), null)
	})

	it('is stored as its key', () => {
		const mapper = new EntryRank.Mapper()
		assert.equal(mapper.convertToDatabaseValue(rank('a0V')), 'a0V')
		assert.equal(mapper.convertToJSValue('a0V')?.key, 'a0V')
		assert.equal(mapper.convertToJSValue(null), null)
	})
})
