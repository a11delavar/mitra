import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZoneDirectory } from './TimeZoneDirectory.js'

const groupOf = (name: string, region?: string, preferred: ReadonlyArray<string> = []) =>
	TimeZoneDirectory.of('en-US').find('', () => true, region, preferred).find(group => group.name === name)

describe('TimeZoneDirectory', () => {
	it('groups the zones that share a name and both clocks of the year', () => {
		const ids = groupOf('Central European Time')!.zones.map(zone => zone.id)
		assert.ok(ids.includes('Europe/Berlin') && ids.includes('Europe/Paris'))
		assert.ok(!ids.includes('Africa/Algiers'), 'Algiers keeps the same name but no summer time')
	})

	it('stands a group for the city its time is named after, in the reader\'s country first', () => {
		assert.equal(groupOf('Eastern Time', 'US')!.main.id, 'America/New_York')
		assert.equal(groupOf('Eastern Time', 'CA')!.main.id, 'America/Toronto')
		assert.equal(groupOf('Eastern Time', 'DE')!.main.id, 'America/New_York')
		assert.equal(groupOf('Mountain Time', 'US')!.main.id, 'America/Denver')
		assert.equal(groupOf('Central European Time', 'DE')!.main.id, 'Europe/Berlin')
	})

	it('names a time after the city that uses it today, not one that once had its own', () => {
		assert.equal(groupOf('Moscow Standard Time', 'DE')!.main.id, 'Europe/Moscow')
	})

	it('stands a group for a zone the caller prefers, such as the device\'s', () => {
		assert.equal(groupOf('Eastern Time', 'US', ['America/Detroit'])!.main.id, 'America/Detroit')
	})

	it('finds a group by its name whole, and by a city alone otherwise', () => {
		assert.ok(TimeZoneDirectory.of('en-US').find('eastern', () => true, 'US', []).some(group => group.others.some(zone => zone.id === 'America/Detroit')))
		const tokyo = TimeZoneDirectory.of('en-US').find('tokyo', () => true, 'US', [])
		assert.deepEqual(tokyo.map(group => group.main.id), ['Asia/Tokyo'])
	})

	it('builds one directory per locale', () => {
		assert.equal(TimeZoneDirectory.of('en-US'), TimeZoneDirectory.of('en-US'))
		assert.notEqual(TimeZoneDirectory.of('en-US'), TimeZoneDirectory.of('de-DE'))
	})
})
