/** What makes a value invalid, and which of its fields that concerns. Many at once travel as one `AggregateError`. */
export class ValidationError extends Error {
	/** What a request failing on it answers with; a subclass may answer otherwise. */
	static readonly status: number = 400

	readonly fields: ReadonlyArray<string>

	constructor(message: string, fields: ReadonlyArray<string> = []) {
		super(message)
		this.name = new.target.name
		this.fields = fields
	}

	get status() {
		return (this.constructor as typeof ValidationError).status
	}

	toJSON() {
		return { message: this.message, fields: this.fields }
	}
}
