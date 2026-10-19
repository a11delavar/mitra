import { description } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../../identity/User.js'
import { TimeZone } from '../TimeZone.js'
import { UserTimeZones } from '../UserTimeZones.js'

export class TimeZoneParameters {
	@validation(z.custom<TimeZone>(value => value instanceof TimeZone))
	@description('The zone\'s IANA id (Europe/Berlin).')
	@converter(TimeZone.converter)
	readonly id!: TimeZone
}

/**
 * One step applied to the zones the account stores rather than a whole list, so a device's change never overwrites
 * another's that came first. The signed-in user outlives the request, so it takes the stored zones over too.
 */
export abstract class ChangeTimeZones<Parameters extends TimeZoneParameters = TimeZoneParameters> extends Operation<Parameters, User> {
	protected abstract change(zones: UserTimeZones, zone: TimeZone): UserTimeZones

	async run({ em, user }: OperationContext) {
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.timeZones = this.change(stored.timeZones ?? UserTimeZones.none, this.parameters.id)
		await em.flush()
		user.timeZones = stored.timeZones
		return stored
	}
}
