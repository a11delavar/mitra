import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../../identity/User.js'
import { TimeZone } from '../TimeZone.js'
import { UserTimeZones } from '../UserTimeZones.js'

/**
 * One step applied to the zones the account stores rather than a whole list, so a device's change never overwrites
 * another's that came first. The signed-in user outlives the request, so it takes the stored zones over too.
 */
export abstract class ChangeTimeZones extends Operation<{ readonly id?: unknown, readonly label?: unknown }, User> {
	protected abstract change(zones: UserTimeZones, zone: TimeZone): UserTimeZones

	async run({ em, user }: OperationContext): Promise<User> {
		const zone = TimeZone.parse(this.parameters.id)
		if (!zone) {
			throw new ValidationError('Unknown time zone', ['id'])
		}
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.timeZones = this.change(stored.timeZones ?? UserTimeZones.none, zone)
		await em.flush()
		user.timeZones = stored.timeZones
		return stored
	}
}
