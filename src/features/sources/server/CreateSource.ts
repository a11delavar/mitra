import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { NotAllowed } from '../../../infrastructure/validation/NotAllowed.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryTypes } from '../../entries/EntryType.js'
import { Color } from '../Color.js'
import { Source } from '../Source.js'

@operation()
@label('Create a calendar')
@description('Creates a calendar in an integration that can make one, with a name, and optionally a color and the entry types it holds.')
@http({ method: 'POST', path: '/integrations/:id/sources', status: 201 })
export class CreateSource extends Operation<{ readonly id: string, readonly name?: unknown, readonly color?: unknown, readonly entryTypes?: unknown }, Source> {
	async run({ em, user }: OperationContext): Promise<Source> {
		const integration = await user.integration(em, this.parameters.id)
		if (!integration.capabilities.sources.create) {
			throw new NotAllowed('This integration cannot create calendars from mitra')
		}

		const name = String(this.parameters.name ?? '').trim()
		if (!name) {
			throw new ValidationError('A name is required', ['name'])
		}

		// Only pass entryTypes when given: undefined would overwrite Source's default.
		let entryTypes: EntryTypes | undefined
		try {
			entryTypes = this.parameters.entryTypes === undefined ? undefined : EntryTypes.parse(this.parameters.entryTypes as Parameters<typeof EntryTypes.parse>[0])
		} catch (error) {
			throw new ValidationError(error instanceof Error ? error.message : String(error), ['entryTypes'])
		}

		const siblings = await em.find(Source, { integrationId: integration.id })
		const source = new Source({
			name,
			enabled: true,
			hidden: false,
			color: this.parameters.color ? String(this.parameters.color) : Color.unusedAmong(siblings.map(sibling => sibling.color)),
			...entryTypes ? { entryTypes } : {},
		})
		await integration.createSource(em, source)
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.info(`Created source "${source.name}" (${source.id}) in integration ${integration.id}`)
		return source
	}
}
