import { description, label } from '@a11d/metadata'
import { http, operation } from '../../../infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones } from './ChangeTimeZones.js'

@operation()
@label('Name a time zone')
@description('Gives a kept zone a name of the account\'s own, or without one its place\'s name again.')
@http({ method: 'PUT', path: '/user/time-zones/:id/label' })
export class RenameTimeZone extends ChangeTimeZones {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		const { label } = this.parameters
		return zones.rename(zone, typeof label === 'string' ? label : undefined)
	}
}
