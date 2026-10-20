import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation } from '#infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones, TimeZoneParameters } from './ChangeTimeZones.js'

class Parameters extends TimeZoneParameters {
	@validation(z.string().nullable())
	@description('A name of the account\'s own for the zone; none takes its place\'s name again.')
	readonly label!: string | null
}

@operation(Parameters)
@label('Name a time zone')
@description('Gives a kept zone a name of the account\'s own, or without one its place\'s name again.')
@http({ method: 'PUT', path: '/user/time-zones/:id/label' })
export class RenameTimeZone extends ChangeTimeZones<Parameters> {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		return zones.rename(zone, this.parameters.label ?? undefined)
	}
}
