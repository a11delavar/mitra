import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type MigrationOutcome } from '../MigrationPlan.js'
import { SourceMigration, type MigrationOptions } from './SourceMigration.js'

@operation()
@label('Move entries between calendars')
@description('Moves or copies a calendar\'s entries into another, keeping their relations.')
@http({ method: 'POST', path: '/sources/:id/migrate' })
export class MigrateSource extends Operation<{ readonly id: string, readonly options: MigrationOptions }, MigrationOutcome> {
	static override fromRequest(request: Request) {
		return new MigrateSource({ id: request.params.id as string, options: request.body ?? {} })
	}

	async run({ em, user }: OperationContext): Promise<MigrationOutcome> {
		const { id, options } = this.parameters
		const outcome = await (await SourceMigration.of(em, user, id, options)).run()
		syncEmitter.emit('updated', user.id)
		this.logger.info(`Migrated entries from source ${id} to ${String(options.targetSourceId)}: ${JSON.stringify(outcome)}`)
		return outcome
	}
}
