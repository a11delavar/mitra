import { type Converter } from '@a11d/converter'

/**
 * Converter masking sensitive fields on server responses while preserving them on requests.
 */
export function withheld<T extends Record<string, any>>(...secrets: Array<keyof T & string>): Converter<T, T> {
	return {
		deconstruct: value => mitra.runtime !== 'server' ? value : {
			...value,
			...Object.fromEntries(secrets.map(secret => [secret, ''])),
		},
	}
}
