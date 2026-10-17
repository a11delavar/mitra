import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'

@operation()
@label('Remove a device')
@description('Stops sending reminders to a device, by its id; one already gone is not refused.')
@http({ method: 'DELETE', path: '/push/subscriptions/:id' })
export class RemoveDevice extends Operation<{ readonly id: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const subscription = await em.findOne(NotificationSubscription, { id: this.parameters.id, userId: user.id })
		if (subscription) {
			em.remove(subscription)
			await em.flush()
		}
	}
}
