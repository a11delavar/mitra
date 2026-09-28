import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { TableWindow } from './TableWindow.js'

describe('TableWindow', () => {
	const today = new DateTime('2026-08-19T10:30:00')

	const day = (value: DateTime) => [value.year, value.month, value.day, value.hour, value.minute].join('-')
	const bounds = (window: TableWindow) => {
		const { start, end } = window.bounds(today)!
		return [day(start), day(end)]
	}

	it('counts whole days from today, today included', () => {
		assert.deepEqual(bounds(TableWindow.of('today')), ['2026-8-19-0-0', '2026-8-19-23-59'])
		assert.deepEqual(bounds(TableWindow.of('next7')), ['2026-8-19-0-0', '2026-8-25-23-59'])
		assert.deepEqual(bounds(TableWindow.of('next30')), ['2026-8-19-0-0', '2026-9-17-23-59'])
		assert.deepEqual(bounds(TableWindow.of('past30')), ['2026-7-21-0-0', '2026-8-19-23-59'])
	})

	it('reaches twelve months ahead, to the day before the same date next year', () => {
		assert.deepEqual(bounds(TableWindow.of('next12')), ['2026-8-19-0-0', '2027-8-18-23-59'])
	})

	it('has no bounds when it lists everything', () => {
		assert.equal(TableWindow.of('all').bounds(today), undefined)
		assert.ok(TableWindow.of('all').unbounded)
		assert.ok(!TableWindow.of('next30').unbounded)
	})

	it('lists the next 30 days unless told otherwise', () => {
		assert.equal(TableWindow.default, TableWindow.of('next30'))
	})

	it('spans a custom range over whole days, in either order', () => {
		const range = TableWindow.between(new DateTime('2026-03-31T15:00:00'), new DateTime('2026-03-01T08:00:00'))
		assert.deepEqual(bounds(range), ['2026-3-1-0-0', '2026-3-31-23-59'])
	})

	it('keeps a custom range through its stored key', () => {
		const range = TableWindow.between(new DateTime('2026-03-01T00:00:00'), new DateTime('2026-03-31T00:00:00'))
		assert.equal(range.key, 'custom:2026-03-01:2026-03-31')
		assert.ok(TableWindow.parse(range.key)!.equals(range))
		assert.equal(TableWindow.parse('next7'), TableWindow.of('next7'))
	})

	it('knows no other keys, so a stale one falls back to the default', () => {
		assert.equal(TableWindow.parse('month'), undefined)
		assert.equal(TableWindow.parse('custom:soon:later'), undefined)
		assert.equal(TableWindow.parse(null), undefined)
	})
})
