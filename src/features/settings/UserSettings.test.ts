import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UserSettings } from './UserSettings.js'
import { User } from '../identity/User.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

describe('UserSettings', () => {
	describe('sanitize', () => {
		it('keeps the settings it knows, with the values it offers', () => {
			assert.deepEqual(UserSettings.sanitize({
				defaultView: 'timeline',
				defaultDurationMinutes: 30,
				snapMinutes: 5,
				defaultReminderMinutes: 60,
				hideDoneTasks: true,
			}), { defaultView: 'timeline', defaultDurationMinutes: 30, snapMinutes: 5, defaultReminderMinutes: 60, hideDoneTasks: true })
		})

		it('drops a key it does not know, keeping the rest of the write', () => {
			assert.deepEqual(UserSettings.sanitize({ snapMinutes: 30, invented: 'nonsense' }), { snapMinutes: 30 })
		})

		it('drops a view no calendar has', () => {
			assert.equal(UserSettings.sanitize({ defaultView: 'gantt' }), undefined)
		})

		it('drops a span that is not a whole, sane number of minutes', () => {
			assert.equal(UserSettings.sanitize({ snapMinutes: 0 }), undefined)
			assert.equal(UserSettings.sanitize({ snapMinutes: 61 }), undefined)
			assert.equal(UserSettings.sanitize({ snapMinutes: 7.5 }), undefined)
			assert.equal(UserSettings.sanitize({ defaultDurationMinutes: -30 }), undefined)
			assert.equal(UserSettings.sanitize({ defaultReminderMinutes: -1 }), undefined)
		})

		it('keeps a sane span a future picker might offer', () => {
			assert.deepEqual(UserSettings.sanitize({ snapMinutes: 20 }), { snapMinutes: 20 })
			assert.deepEqual(UserSettings.sanitize({ defaultReminderMinutes: 0 }), { defaultReminderMinutes: 0 })
		})

		it('drops a value of the wrong type outright', () => {
			assert.equal(UserSettings.sanitize({ snapMinutes: '15' }), undefined)
			assert.equal(UserSettings.sanitize({ defaultView: 7 }), undefined)
			assert.equal(UserSettings.sanitize({ hideDoneTasks: 'yes' }), undefined)
		})

		it('keeps a lens turned back off, so the choice reads as made rather than never taken', () => {
			assert.deepEqual(UserSettings.sanitize({ hideDoneTasks: false }), { hideDoneTasks: false })
		})

		it('keeps an explicit null reminder, and tells it from an absent one', () => {
			assert.deepEqual(UserSettings.sanitize({ defaultReminderMinutes: null }), { defaultReminderMinutes: null })
			assert.equal(UserSettings.sanitize({}), undefined)
		})

		it('reports NOTHING chosen as nothing, so the column stays null', () => {
			assert.equal(UserSettings.sanitize({}), undefined)
			assert.equal(UserSettings.sanitize(undefined), undefined)
			assert.equal(UserSettings.sanitize('not an object'), undefined)
		})
	})

	describe('User.applySettings', () => {
		it('replaces the bag wholesale, so dropping a setting back to the default is sayable', () => {
			const user = new User({ username: 'u' })
			user.applySettings({ snapMinutes: 30, defaultView: 'month' })
			assert.deepEqual(user.settings, { defaultView: 'month', snapMinutes: 30 })
			user.applySettings({ defaultView: 'month' })
			assert.deepEqual(user.settings, { defaultView: 'month' })
			user.applySettings({})
			assert.equal(user.settings, undefined)
		})
	})

	describe('on the wire', () => {
		const round = (settings: UserSettings | undefined) => revive<User>(wireOf(new User({ username: 'u', settings }))).settings

		it('carries an explicit null reminder', () => {
			assert.deepEqual(round({ defaultReminderMinutes: null }), { defaultReminderMinutes: null })
		})

		it('keeps an absent bag absent', () => {
			assert.equal(round(undefined), undefined)
		})

		it('carries the chosen values', () => {
			assert.deepEqual(round({ defaultView: 'year', snapMinutes: 10 }), { defaultView: 'year', snapMinutes: 10 })
		})
	})
})
