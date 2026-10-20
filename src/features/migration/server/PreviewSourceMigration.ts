import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type MigrationPlan } from '../MigrationPlan.js'
import { MigrationOptions, SourceMigration } from './SourceMigration.js'

class Parameters extends MigrationOptions {
	@validation(z.string())
	@description('The calendar\'s id the entries come from.')
	readonly id!: string
}

@operation(Parameters)
@label('Preview a move between calendars')
@description('Answers what moving or copying a calendar\'s entries into another would carry, lose, or be refused.')
@http({ method: 'POST', path: '/sources/:id/migrate/preview' })
export class PreviewSourceMigration extends Operation<Parameters, MigrationPlan> {
	async run({ em, user }: OperationContext) {
		return (await SourceMigration.of(em, user, this.parameters.id, this.parameters)).plan()
	}
}
