import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { isDemo } from '../../infrastructure/environment.js'
import { NotAllowed } from '../../infrastructure/validation/NotAllowed.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'
import { type Source } from '../../features/sources/Source.js'
import { Integration, integrationClassFor } from '../Integration.js'

@operation()
@label('Discover calendars')
@description('Signs in to an account with the credentials given and lists the calendars it holds, without connecting it.')
@http({ method: 'POST', path: '/integrations/sources' })
export class DiscoverSources extends Operation<{ readonly integration: Integration }, Array<Source>> {
	static override fromRequest(request: Request) {
		return new DiscoverSources({ integration: request.body as Integration })
	}

	async run({ em, user }: OperationContext): Promise<Array<Source>> {
		// Keeps strangers' credentials off a demo box, and the box from fetching the URLs they type.
		if (isDemo) {
			throw new NotAllowed('Connecting accounts is turned off in the demo')
		}
		const incoming = this.parameters.integration
		const integration: Integration = await em.findOne(Integration, { id: incoming.id, userId: user.id })
			?? new (integrationClassFor(incoming.type))({ userId: user.id })
		integration.merge(incoming)
		return integration.getSources(em, { checkDuplicate: true })
	}
}
