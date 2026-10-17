import { NotFoundError } from '@mikro-orm/sqlite'
import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { trimmed } from './push.js'

@operation()
@label('Name a device')
@description('Gives a device that receives reminders a name of the user\'s own, or its browser and platform again without one.')
@http({ method: 'PUT', path: '/push/subscriptions/:id/name' })
export class RenameDevice extends Operation<{ readonly id: string, readonly name?: unknown }, NotificationSubscription> {
	async run({ em, user }: OperationContext): Promise<NotificationSubscription> {
		const subscription = await em.findOne(NotificationSubscription, { id: this.parameters.id, userId: user.id })
		if (!subscription) {
			throw new NotFoundError('No such device')
		}
		subscription.rename(trimmed(this.parameters.name, 60))
		await em.flush()
		return subscription
	}
}
