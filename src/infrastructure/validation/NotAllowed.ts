import { ValidationError } from './ValidationError.js'

/** A request the user may not make here, as opposed to a malformed one: a calendar that refuses it, or an instance that does. */
export class NotAllowed extends ValidationError {
	static override readonly status = 403
}
