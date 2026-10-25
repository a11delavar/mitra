import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type MigrationPlan } from '../MigrationPlan.js'
import { IcsImport } from './IcsImport.js'

@operation()
@label('Preview a calendar file\'s import')
@description('Answers what importing a calendar file into a calendar would carry, lose, or be refused.')
@http({ method: 'POST', path: '/sources/:id/ics/preview', body: 'ics', type: 'text/calendar' })
export class PreviewIcsImport extends Operation<{ readonly id: string, readonly ics: string }, MigrationPlan> {
	async run({ em, user }: OperationContext): Promise<MigrationPlan> {
		return (await IcsImport.of(em, user, this.parameters.id, this.parameters.ics)).plan()
	}
}
