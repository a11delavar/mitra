import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'

@operation()
@label('List devices')
@description('Lists the devices that receive the user\'s reminders, the one seen last first.')
@http({ method: 'GET', path: '/push/subscriptions' })
export class ListDevices extends Operation<object, Array<NotificationSubscription>> {
	run({ em, user }: OperationContext): Promise<Array<NotificationSubscription>> {
		return em.find(NotificationSubscription, { userId: user.id }, { orderBy: { lastSeenAt: 'desc' } })
	}
}
