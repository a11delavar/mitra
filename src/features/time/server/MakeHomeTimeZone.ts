import { description, label } from '@a11d/metadata'
import { http, operation } from '#infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones, TimeZoneParameters } from './ChangeTimeZones.js'

@operation(TimeZoneParameters)
@label('Make a time zone home')
@description('Makes a zone the home zone, keeping the former home among the others.')
@http({ method: 'PUT', path: '/user/time-zones/home' })
export class MakeHomeTimeZone extends ChangeTimeZones {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		return zones.makeHome(zone)
	}
}
