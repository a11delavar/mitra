import { TimeZone } from './TimeZone.js'

/** Makes this runtime hold local dates in `zone`, as a browser there does, or none, as the server does, until the returned function puts it back. */
export const holdLocalIn = (zone: TimeZone | undefined) => {
	const previous = Object.getOwnPropertyDescriptor(TimeZone, 'local')!
	Object.defineProperty(TimeZone, 'local', { get: () => zone, configurable: true })
	return () => Object.defineProperty(TimeZone, 'local', previous)
}
