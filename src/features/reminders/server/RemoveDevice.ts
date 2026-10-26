import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The device\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Remove a device')
@description('Stops sending reminders to a device, by its id; one already gone is not refused.')
@http({ method: 'DELETE', path: '/push/subscriptions/:id' })
export class RemoveDevice extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const [subscription] = await user.filterDevices(em, { id: this.parameters.id })
		if (subscription) {
			em.remove(subscription)
			await em.flush()
		}
	}
}
