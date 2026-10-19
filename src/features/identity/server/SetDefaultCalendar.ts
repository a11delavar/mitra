import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../User.js'

class Parameters {
	@validation(z.string().nullable())
	@description('The calendar\'s id, or null for none.')
	readonly sourceId!: string | null
}

@operation(Parameters)
@label('Set the default calendar')
@description('Sets the calendar new entries go to, or clears it with null.')
@http({ method: 'PUT', path: '/user/default-source' })
export class SetDefaultCalendar extends Operation<Parameters, User> {
	async run({ em, user }: OperationContext) {
		const { sourceId } = this.parameters
		if (sourceId !== null) {
			await user.source(em, sourceId)
		}
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.defaultSourceId = sourceId ?? undefined
		await em.flush()
		user.defaultSourceId = stored.defaultSourceId
		return stored as User
	}
}
