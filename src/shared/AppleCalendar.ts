import { model } from './model.js'
import { entity } from './orm.js'
import { CalDAV } from './CalDAV.js'

/**
 * Apple Calendar (iCloud) integration.
 * Apple uses standard CalDAV, but requires an App-Specific Password instead of the main Apple ID password.
 * The server URL is fixed to caldav.icloud.com, so we subclass CalDAV to hide the URI field in the UI
 * and tailor the terminology.
 */
@model('AppleCalendar')
@entity({ discriminatorValue: 'apple' })
export class AppleCalendar extends CalDAV {
	static readonly serverUrl = 'https://caldav.icloud.com/'

	override uri = AppleCalendar.serverUrl

	override toString() {
		return `Apple Calendar integration for "${this.credentials.username}"`
	}

	override merge(incoming: this) {
		super.merge(incoming)
		this.uri = AppleCalendar.serverUrl
	}
}
