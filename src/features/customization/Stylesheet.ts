/** A stylesheet written over Mitra's, an account's or the instance's: kept as written, without `@import`. */
export class Stylesheet {
	/** The longest one kept, in characters: the whole settings bag holding it is rewritten on every save. */
	static readonly limit = 64 * 1024

	/** An `@import` and its target, quoted parts whole, so a semicolon inside a string does not end it. */
	private static readonly importRule = /@import\s(?:[^;"']|"[^"]*"|'[^']*')*;?/gi

	/** The stylesheet `value` holds without its imports, or nothing where it holds none, is no text, or is past its size rather than cut in half. */
	static sanitize(value: unknown) {
		if (typeof value !== 'string' || value.length > Stylesheet.limit) {
			return undefined
		}
		const css = value.replace(Stylesheet.importRule, '')
		return css.trim() ? css : undefined
	}
}
