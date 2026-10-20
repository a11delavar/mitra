import { description, label } from '@a11d/metadata'
import { http, operation } from '#infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones, TimeZoneParameters } from './ChangeTimeZones.js'

@operation(TimeZoneParameters)
@label('Remove a time zone')
@description('Removes a zone the account kept beside home; home itself stays.')
@http({ method: 'DELETE', path: '/user/time-zones/:id' })
export class RemoveTimeZone extends ChangeTimeZones {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		return zones.remove(zone)
	}
}
