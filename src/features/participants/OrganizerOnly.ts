import { ValidationError } from '../../infrastructure/validation/ValidationError.js'

/** Changing the list is the organizer's prerogative: iTIP (RFC 5546) limits everyone else to replying with their own status. */
export class OrganizerOnly extends ValidationError {
	static override readonly status = 403
}
