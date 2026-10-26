import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

/** For the service worker, which knows a rotated subscription by its endpoint alone. */
class Parameters {
	@validation(z.string().min(1, 'Missing endpoint'))
	@description('The push subscription\'s endpoint.')
	readonly endpoint!: string
}

@operation(Parameters)
@label('Unregister a device')
@description('Stops sending reminders to a push endpoint, by the endpoint itself.')
@http({ method: 'DELETE', path: '/push/subscription' })
export class UnregisterDevice extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { endpoint } = this.parameters
		const [subscription] = await user.filterDevices(em, { endpoint })
		if (subscription) {
			em.remove(subscription)
			await em.flush()
		}
	}
}
