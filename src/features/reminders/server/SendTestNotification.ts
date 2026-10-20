import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { ReminderNotification } from '../ReminderNotification.js'
import { sendTo } from './push.js'

class Parameters {
	@validation(z.enum(['event', 'task']).optional())
	@description('Whether it rehearses an event\'s reminder or a task\'s; an event\'s without one.')
	readonly kind?: 'event' | 'task'
}

@operation(Parameters)
@label('Send a test notification')
@description('Sends every device of the user a rehearsal of a reminder for an event or a task.')
@http({ method: 'POST', path: '/push/test', status: 202 })
export class SendTestNotification extends Operation<Parameters, void> {
	async run({ user }: OperationContext) {
		await sendTo(user.id, ReminderNotification.rehearsal(this.parameters.kind ?? 'event', Date.now()))
	}
}
