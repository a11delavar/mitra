import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import type { Integration } from '#integrations'
import { validation } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The integration\'s id.')
	readonly id!: string

	@validation(z.string().trim())
	@description('The integration\'s name. Blank gives it back the account\'s.')
	readonly name!: string
}

@operation(Parameters)
@label('Rename an integration')
@description('Gives an integration a name of the user\'s own, shown in place of the account it signs in as.')
@http({ method: 'PUT', path: '/integrations/:id/name' })
export class RenameIntegration extends Operation<Parameters, Integration> {
	async run({ em, user }: OperationContext) {
		const integration = await user.getIntegration(em, this.parameters.id)

		integration.name = this.parameters.name || undefined
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Integration ${integration.id} renamed to "${integration.title}"`)
		return integration
	}
}
