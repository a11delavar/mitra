import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type MigrationPlan } from '../MigrationPlan.js'
import { SourceMigration, type MigrationOptions } from './SourceMigration.js'

@operation()
@label('Preview a move between calendars')
@description('Answers what moving or copying a calendar\'s entries into another would carry, lose, or be refused.')
@http({ method: 'POST', path: '/sources/:id/migrate/preview' })
export class PreviewSourceMigration extends Operation<{ readonly id: string, readonly options: MigrationOptions }, MigrationPlan> {
	static override fromRequest(request: Request) {
		return new PreviewSourceMigration({ id: request.params.id as string, options: request.body ?? {} })
	}

	async run({ em, user }: OperationContext): Promise<MigrationPlan> {
		return (await SourceMigration.of(em, user, this.parameters.id, this.parameters.options)).plan()
	}
}
