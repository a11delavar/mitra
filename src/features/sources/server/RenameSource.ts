import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

@operation()
@label('Rename a calendar')
@description('Gives a calendar a name of the user\'s own, which survives the provider\'s syncs until the provider renames it.')
@http({ method: 'PUT', path: '/sources/:id/name' })
export class RenameSource extends Operation<{ readonly id: string, readonly name?: unknown }, Source> {
	async run({ em, user }: OperationContext): Promise<Source> {
		const source = await user.source(em, this.parameters.id)

		const name = String(this.parameters.name ?? '').trim()
		if (!name) {
			throw new ValidationError('A name is required', ['name'])
		}

		source.name = name
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} renamed to "${source.name}"`)
		return source
	}
}
