import { Api } from '@a11d/api'

/** A browser's push subscription as it registers, whose keys the server keeps without checking them. */
export const registerDevice = (endpoint: string, init: object = {}) =>
	Api.post<{ id: string, endpoint: string, name?: string }>('/push/subscription', { endpoint, keys: { p256dh: 'p256dh', auth: 'auth' }, ...init })

export const listDevices = () => Api.get<Array<{ id: string, endpoint: string, name?: string }>>('/push/subscriptions')
