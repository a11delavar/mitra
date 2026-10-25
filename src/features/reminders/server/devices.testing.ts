import { type ParametersOf } from '#infrastructure/operations/Operation.js'
import { RegisterDevice } from './RegisterDevice.js'

/** A browser's push subscription as it registers, whose keys the server keeps without checking them. */
export const registerDevice = (endpoint: string, init: Partial<ParametersOf<RegisterDevice>> = {}) =>
	RegisterDevice.call({ endpoint, keys: { p256dh: 'p256dh', auth: 'auth' }, ...init })
