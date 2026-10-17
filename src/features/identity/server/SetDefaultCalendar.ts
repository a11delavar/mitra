import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../User.js'

@operation()
@label('Set the default calendar')
@description('Sets the calendar new entries go to, or clears it with null.')
@http({ method: 'PUT', path: '/user/default-source' })
export class SetDefaultCalendar extends Operation<{ readonly sourceId?: string | null }, User> {
	async run({ em, user }: OperationContext): Promise<User> {
		const sourceId = this.parameters.sourceId ?? null
		if (sourceId !== null) {
			await user.source(em, sourceId)
		}
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.defaultSourceId = sourceId ?? undefined
		await em.flush()
		user.defaultSourceId = stored.defaultSourceId
		return stored
	}
}
