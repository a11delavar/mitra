import { description, label } from '@a11d/metadata'
import { http, operation } from '../../../infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones, TimeZoneParameters } from './ChangeTimeZones.js'

@operation(TimeZoneParameters)
@label('Add a time zone')
@description('Adds a zone the account keeps beside home.')
@http({ method: 'POST', path: '/user/time-zones' })
export class AddTimeZone extends ChangeTimeZones {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		return zones.add(zone)
	}
}
