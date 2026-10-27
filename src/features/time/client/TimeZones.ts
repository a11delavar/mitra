import { AddTimeZone, RemoveTimeZone, RenameTimeZone, MakeHomeTimeZone, SettleHomeTimeZone } from '#operations'
import { session } from '#infrastructure/http/PageSession.js'
import { TimeZone } from '../TimeZone.js'
import { UserTimeZones } from '../UserTimeZones.js'

/** The user's time zones as this device sees them: the zone it runs in anchors the grid, home and the others stand beside it. */
export class TimeZones {
	/** The zone the device runs in; UTC where its system names one Intl refuses (`Etc/Unknown` on some Linux hosts). */
	static get here() {
		return TimeZone.parse(TimeZone.deviceId) ?? TimeZone.of('UTC')
	}

	static get list() {
		return session.user?.timeZones ?? UserTimeZones.none
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
		return session.keepUser(AddTimeZone.call({ id: zone }))
	}

	static remove(zone: TimeZone) {
		return session.keepUser(RemoveTimeZone.call({ id: zone }))
	}

	static rename(zone: TimeZone, label: string | undefined) {
		return session.keepUser(RenameTimeZone.call({ id: zone, label: label ?? null }))
	}

	static makeHome(zone: TimeZone) {
		return session.keepUser(MakeHomeTimeZone.call({ id: zone }))
	}

	/** Gives the account its home on its first start anywhere. */
	static async settle() {
		if (!TimeZones.list.home) {
			await session.keepUser(SettleHomeTimeZone.call({ id: TimeZones.here }))
		}
	}
}
