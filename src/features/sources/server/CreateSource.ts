import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { EntryType, EntryTypes } from '#features/entries'
import { tool } from '#features/agents/server/tool.js'
import { validation, NotAllowed } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Color } from '../Color.js'
import { Source } from '../Source.js'

class Parameters {
	@validation(z.string())
	@description('The id of the integration the calendar is created in, as get_context lists them.')
	readonly id!: string

	@validation(z.string().trim().min(1, 'A name is required'))
	@description('The calendar\'s name.')
	readonly name!: string

	@validation(z.custom<Color>(value => value instanceof Color).optional())
	@description('A color in hex (#3366cc) or by its CSS name; none picks one its siblings do not use.')
	@converter(Color.converter)
	readonly color?: Color

	@validation(z.array(z.custom<EntryType>(value => value instanceof EntryType)).optional())
	@description('What the calendar holds: event, task, or both.')
	@converter(EntryTypes.converter)
	readonly entryTypes?: EntryTypes
}

@operation(Parameters)
@label('Create a calendar')
@description('Creates a calendar in an integration that can make one, with a name, and optionally a color and the entry types it holds.')
@http({ method: 'POST', path: '/integrations/:id/sources', status: 201 })
@tool({ name: 'create_calendar' })
@updates('sources')
export class CreateSource extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const integration = await user.getIntegration(em, this.parameters.id)
		if (!integration.capabilities.sources.create) {
			throw new NotAllowed('This integration cannot create calendars from mitra')
		}

		// Only pass entryTypes when given: undefined would overwrite Source's default.
		const { name, entryTypes } = this.parameters

		const source = new Source({
			name,
			enabled: true,
			hidden: false,
			color: this.parameters.color ?? Color.unusedAmong(integration.sources.map(sibling => sibling.color)),
			...entryTypes ? { entryTypes } : {},
		})
		await integration.createSource(em, source)
		await em.flush()

		this.logger.info(`Created source "${source.name}" (${source.id}) in integration ${integration.id}`)
		return source
	}
}
