import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { NotAllowed, validation } from '#infrastructure/validation'
import { State } from '#infrastructure/database/State.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { InstanceSettings } from '../InstanceSettings.js'

class Parameters {
	@validation(z.record(z.string(), z.unknown()))
	@description('The settings for everyone on the instance, by key.')
	readonly settings!: Readonly<Record<string, unknown>>
}

@operation(Parameters)
@label('Save the instance\'s settings')
@description('Stores what holds for everyone on the instance, keeping only what deviates from the defaults. Only an administrator may.')
@http({ method: 'PUT', path: '/instance/settings' })
export class SaveInstanceSettings extends Operation<Parameters, InstanceSettings> {
	async run({ em, user }: OperationContext) {
		if (!user.administers) {
			throw new NotAllowed('Only an administrator sets what holds for everyone')
		}
		const settings = InstanceSettings.sanitize(this.parameters.settings) ?? {}
		await State.write(em, InstanceSettings.key, settings)
		return settings
	}
}
