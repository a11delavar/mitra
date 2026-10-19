import { type Converter } from '@a11d/converter'

/**
 * Converter masking sensitive fields on server responses while preserving them on requests; naming none masks the value itself.
 */
export function withheld<T>(...secrets: Array<keyof T & string>): Converter<T, T> {
	return {
		deconstruct: value => mitra.runtime !== 'server' ? value : !secrets.length ? '' as T : {
			...value,
			...Object.fromEntries(secrets.map(secret => [secret, ''])),
		},
	}
}
