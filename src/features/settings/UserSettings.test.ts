import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { User } from '#features/identity'
import { Stylesheet } from '#features/customization/Stylesheet.js'
import { revive, wireOf } from '#infrastructure/model/wire.testing.js'
import { UserSettings } from './UserSettings.js'

describe('UserSettings', () => {
	describe('sanitize', () => {
		it('keeps the settings it knows, with the values it offers', () => {
			assert.deepEqual(UserSettings.sanitize({
				defaultView: 'timeline',
				defaultDurationMinutes: 30,
				snapMinutes: 5,
				defaultReminderMinutes: 60,
				hideDoneTasks: true,
				hideAvailability: true,
			}), { defaultView: 'timeline', defaultDurationMinutes: 30, snapMinutes: 5, defaultReminderMinutes: 60, hideDoneTasks: true, hideAvailability: true })
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
			assert.equal(UserSettings.sanitize({ hideAvailability: 1 }), undefined)
		})

		it('keeps a lens turned back off, so the choice reads as made rather than never taken', () => {
			assert.deepEqual(UserSettings.sanitize({ hideDoneTasks: false }), { hideDoneTasks: false })
			assert.deepEqual(UserSettings.sanitize({ hideCancelled: true }), { hideCancelled: true })
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

	describe('custom CSS', () => {
		it('keeps the stylesheet as written', () => {
			const css = 'mitra-day[today] {\n\toutline: 2px solid var(--color-accent);\n}\n'
			assert.deepEqual(UserSettings.sanitize({ customCss: css }), { customCss: css })
		})

		it('drops a stylesheet that holds nothing, so the column stays null', () => {
			assert.equal(UserSettings.sanitize({ customCss: '' }), undefined)
			assert.equal(UserSettings.sanitize({ customCss: ' \n\t' }), undefined)
		})

		it('drops one past its size, rather than cutting a rule in half', () => {
			assert.equal(UserSettings.sanitize({ customCss: `/* ${'x'.repeat(Stylesheet.limit)} */` }), undefined)
			assert.ok(UserSettings.sanitize({ customCss: 'x'.repeat(Stylesheet.limit) }))
		})

		it('strips every @import, which the page could not honour and would fetch from anywhere', () => {
			assert.deepEqual(UserSettings.sanitize({
				customCss: '@import url("https://example.com/theme.css");\n@IMPORT \'a;b.css\' screen;\n:root { --color-accent: teal; }',
			}), { customCss: '\n\n:root { --color-accent: teal; }' })
			assert.equal(UserSettings.sanitize({ customCss: '@import "theme.css";' }), undefined)
		})

		it('keeps it turned off, and only off: on is the default', () => {
			assert.deepEqual(UserSettings.sanitize({ customCssEnabled: false }), { customCssEnabled: false })
			assert.equal(UserSettings.sanitize({ customCssEnabled: true }), undefined)
			assert.equal(UserSettings.sanitize({ customCssEnabled: 'no' }), undefined)
		})

		it('drops a stylesheet that is not text', () => {
			assert.equal(UserSettings.sanitize({ customCss: 42 }), undefined)
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
