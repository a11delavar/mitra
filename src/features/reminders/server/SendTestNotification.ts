import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { ReminderNotification } from '../ReminderNotification.js'
import { sendTo } from './push.js'

@operation()
@label('Send a test notification')
@description('Sends every device of the user a rehearsal of a reminder for an event or a task.')
@http({ method: 'POST', path: '/push/test', status: 202 })
export class SendTestNotification extends Operation<{ readonly kind?: unknown }, void> {
	async run({ user }: OperationContext): Promise<void> {
		await sendTo(user.id, ReminderNotification.rehearsal(this.parameters.kind === 'task' ? 'task' : 'event', Date.now()))
	}
}
