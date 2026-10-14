import { type ValidationError } from './ValidationError.js'

/** Something that tells what makes it invalid in `context`: every error, none when it stands. It yields them, never throws. */
export interface Validatable<Context = void> {
	validate(context: Context): Iterable<ValidationError>
}
