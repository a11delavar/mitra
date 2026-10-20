import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import './document.testing.js'
import { TimeZone } from './TimeZone.js'

describe('TimeZone.deviceId', () => {
	const DateTimeFormat = Intl.DateTimeFormat
	const getTimezoneOffset = Date.prototype.getTimezoneOffset
	let asked = 0
	const countAsking = () => {
		asked = 0
		Intl.DateTimeFormat = ((...parameters: ConstructorParameters<typeof Intl.DateTimeFormat>) => (asked++, new DateTimeFormat(...parameters))) as never
	}
	afterEach(() => {
		Intl.DateTimeFormat = DateTimeFormat
		Date.prototype.getTimezoneOffset = getTimezoneOffset
	})

	it('is the zone Intl names for this device', () => {
		assert.equal(TimeZone.deviceId, new DateTimeFormat().resolvedOptions().timeZone)
	})

	// Intl answers in 50 µs, and views ask thousands of times a frame.
	it('asks Intl once, however often and across however many tasks it is read', async () => {
		TimeZone.deviceId
		countAsking()
		for (let i = 0; i < 1000; i++) {
			TimeZone.deviceId
		}
		await new Promise(resolve => setTimeout(resolve))
		TimeZone.deviceId
		assert.equal(asked, 0)
	})

	it('asks again once the device\'s offset changes, as a trip with the page open does', () => {
		TimeZone.deviceId
		countAsking()
		const offset = new Date().getTimezoneOffset()
		Date.prototype.getTimezoneOffset = () => offset + 60
		TimeZone.deviceId
		TimeZone.deviceId
		assert.equal(asked, 1)
	})

	it('asks again once the page shows again, as a trip is taken up there', () => {
		TimeZone.deviceId
		countAsking()
		;(globalThis.document as unknown as EventTarget).dispatchEvent(new Event('visibilitychange'))
		TimeZone.deviceId
		TimeZone.deviceId
		assert.equal(asked, 1)
	})
})
