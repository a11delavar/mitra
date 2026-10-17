import { description, label } from '@a11d/metadata'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'

/** For the service worker, which knows a rotated subscription by its endpoint alone. */
@operation()
@label('Unregister a device')
@description('Stops sending reminders to a push endpoint, by the endpoint itself.')
@http({ method: 'DELETE', path: '/push/subscription' })
export class UnregisterDevice extends Operation<{ readonly endpoint?: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const { endpoint } = this.parameters
		if (!endpoint) {
			throw new ValidationError('Missing endpoint', ['endpoint'])
		}
		const subscription = await em.findOne(NotificationSubscription, { endpoint, userId: user.id })
		if (subscription) {
			em.remove(subscription)
			await em.flush()
		}
	}
}
