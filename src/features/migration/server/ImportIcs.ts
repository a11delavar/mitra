import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type MigrationOutcome } from '../MigrationPlan.js'
import { IcsImport } from './IcsImport.js'

@operation()
@label('Import a calendar file')
@description('Imports a calendar file\'s entries into a calendar.')
@http({ method: 'POST', path: '/sources/:id/ics' })
export class ImportIcs extends Operation<{ readonly id: string, readonly ics: unknown }, MigrationOutcome> {
	static override fromRequest(request: Request) {
		return new ImportIcs({ id: request.params.id as string, ics: request.body })
	}

	async run({ em, user }: OperationContext): Promise<MigrationOutcome> {
		const { id, ics } = this.parameters
		const outcome = await (await IcsImport.of(em, user, id, ics)).run()
		syncEmitter.emit('updated', user.id)
		this.logger.info(`Imported calendar file into source ${id}: ${JSON.stringify(outcome)}`)
		return outcome
	}
}
