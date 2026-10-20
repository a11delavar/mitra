import { addTimeZone, getUser, makeHomeTimeZone, removeTimeZone, renameTimeZone, settleTimeZone } from '#infrastructure/http/Api.js'
import { TimeZone } from '../TimeZone.js'
import { UserTimeZones } from '../UserTimeZones.js'

/** The user's time zones as this device sees them: the zone it runs in anchors the grid, home and the others stand beside it. */
export class TimeZones {
	/** The zone the device runs in; UTC where its system names one Intl refuses (`Etc/Unknown` on some Linux hosts). */
	static get here() {
		return TimeZone.parse(TimeZone.deviceId) ?? TimeZone.of('UTC')
	}

	static get list() {
		return getUser()?.timeZones ?? UserTimeZones.none
	}

	/** The account's home, or this device's zone until the account has one. */
	static get home() {
		return TimeZones.list.home?.zone ?? TimeZones.here
	}

	/** The columns beside the device's own. */
	static get besides() {
		return TimeZones.list.besides(TimeZones.here)
	}

	static add(zone: TimeZone) {
		return addTimeZone(zone.id)
	}

	static remove(zone: TimeZone) {
		return removeTimeZone(zone.id)
	}

	static rename(zone: TimeZone, label: string | undefined) {
		return renameTimeZone(zone.id, label)
	}

	static makeHome(zone: TimeZone) {
		return makeHomeTimeZone(zone.id)
	}

	/** Gives the account its home on its first start anywhere. */
	static async settle() {
		if (!TimeZones.list.home) {
			await settleTimeZone(TimeZones.here.id)
		}
	}
}
