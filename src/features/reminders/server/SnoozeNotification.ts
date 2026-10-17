import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { ReminderNotification } from '../ReminderNotification.js'
import { sendTo } from './push.js'

@operation()
@label('Snooze a notification')
@description('Sends a reminder again after the snooze, from the facts its notification carried.')
@http({ method: 'POST', path: '/push/snooze', status: 202 })
export class SnoozeNotification extends Operation<{ readonly facts: unknown }, void> {
	/** The body is the notification's facts, read as they were sent: dates in them are the notification's to parse. */
	static override fromRequest(request: Request) {
		return new SnoozeNotification({ facts: request.body })
	}

	run({ user }: OperationContext): Promise<void> {
		const notification = ReminderNotification.parse(this.parameters.facts)
		if (!notification) {
			throw new ValidationError('Missing notification facts')
		}
		this.logger.info(`Snoozing "${notification.facts.heading}" for ${ReminderNotification.snoozeMinutes} minutes`)
		const userId = user.id
		setTimeout(
			() => sendTo(userId, notification).catch(error => this.logger.warn('Snoozed re-send failed:', error instanceof Error ? error.message : error)),
			ReminderNotification.snoozeMinutes * 60_000,
		)
		return Promise.resolve()
	}
}
