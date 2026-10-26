import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { trimmed } from './push.js'

class Parameters {
	@validation(z.string())
	@description('The device\'s id.')
	readonly id!: string

	@validation(z.string().nullish())
	@description('A name of the user\'s own; none names it by its platform and browser.')
	readonly name?: string
}

@operation(Parameters)
@label('Name a device')
@description('Gives a device that receives reminders a name of the user\'s own, or its browser and platform again without one.')
@http({ method: 'PUT', path: '/push/subscriptions/:id/name' })
export class RenameDevice extends Operation<Parameters, NotificationSubscription> {
	async run({ em, user }: OperationContext) {
		const subscription = await user.getDevice(em, this.parameters.id)
		subscription.rename(trimmed(this.parameters.name, 60))
		await em.flush()
		return subscription
	}
}
