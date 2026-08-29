import { model } from '../../infrastructure/model/model.js'
import { CalDAV } from '../caldav/CalDAV.js'
import { integration } from '../Integration.js'

/** Apple Calendar (iCloud) integration using fixed caldav.icloud.com server URL. */
@model('AppleCalendar')
@integration('apple')
export class AppleCalendar extends CalDAV {
	static override readonly label: string = 'Apple Calendar'
	static override readonly logo: string = 'apple'
	static override readonly description: string = 'The calendars of your iCloud account'

	static readonly serverUrl = 'https://caldav.icloud.com/'

	override uri = AppleCalendar.serverUrl

	override toString() {
		return `Apple Calendar integration for "${this.credentials.username}"`
	}

	override get canConnect() {
		return !!this.credentials.username
	}

	override merge(incoming: this) {
		super.merge(incoming)
		this.uri = AppleCalendar.serverUrl
	}
}
