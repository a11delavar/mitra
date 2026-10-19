import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type MigrationOutcome } from '../MigrationPlan.js'
import { MigrationOptions, SourceMigration } from './SourceMigration.js'

class Parameters extends MigrationOptions {
	@validation(z.string())
	@description('The calendar\'s id the entries come from.')
	readonly id!: string
}

@operation(Parameters)
@label('Move entries between calendars')
@description('Moves or copies a calendar\'s entries into another, keeping their relations.')
@http({ method: 'POST', path: '/sources/:id/migrate' })
export class MigrateSource extends Operation<Parameters, MigrationOutcome> {
	async run({ em, user }: OperationContext) {
		const { id, targetSourceId } = this.parameters
		const outcome = await (await SourceMigration.of(em, user, id, this.parameters)).run()
		syncEmitter.emit('updated', user.id)
		this.logger.info(`Migrated entries from source ${id} to ${targetSourceId}: ${JSON.stringify(outcome)}`)
		return outcome
	}
}
