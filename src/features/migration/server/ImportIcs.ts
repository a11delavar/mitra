import { description, label } from '@a11d/metadata'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type MigrationOutcome } from '../MigrationPlan.js'
import { IcsImport } from './IcsImport.js'

@operation()
@label('Import a calendar file')
@description('Imports a calendar file\'s entries into a calendar.')
@http({ method: 'POST', path: '/sources/:id/ics', body: 'ics', type: 'text/calendar' })
export class ImportIcs extends Operation<{ readonly id: string, readonly ics: string }, MigrationOutcome> {
	async run({ em, user }: OperationContext): Promise<MigrationOutcome> {
		const { id, ics } = this.parameters
		const outcome = await (await IcsImport.of(em, user, id, ics)).run()
		syncEmitter.emit('updated', user.id)
		this.logger.info(`Imported calendar file into source ${id}: ${JSON.stringify(outcome)}`)
		return outcome
	}
}
