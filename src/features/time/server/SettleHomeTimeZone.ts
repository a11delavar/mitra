import { description, label } from '@a11d/metadata'
import { http, operation } from '../../../infrastructure/operations/Operation.js'
import { type TimeZone } from '../TimeZone.js'
import { type UserTimeZones } from '../UserTimeZones.js'
import { ChangeTimeZones } from './ChangeTimeZones.js'

@operation()
@label('Settle the home time zone')
@description('Makes the zone a device runs in the home zone, unless the account already has one.')
@http({ method: 'POST', path: '/user/time-zones/settle' })
export class SettleHomeTimeZone extends ChangeTimeZones {
	protected change(zones: UserTimeZones, zone: TimeZone) {
		return zones.settle(zone)
	}
}
