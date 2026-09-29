// Text-only `css`/`unsafeCSS` for Node: lit's own tags need a DOM, and only `cssText` is ever read.

class CSSResult {
	constructor(cssText) {
		this.cssText = cssText
	}

	toString() {
		return this.cssText
	}
}

function textOf(value) {
	return value instanceof CSSResult ? value.cssText : String(value)
}

function join(strings, values) {
	return strings.reduce((text, string, index) => text + textOf(values[index - 1]) + string)
}

export function css(strings, ...values) {
	return new CSSResult(join(strings, values))
}

export function unsafeCSS(value, ...values) {
	// src/design calls it both as a function and as a tag.
	return new CSSResult(Array.isArray(value) && 'raw' in value ? join(value, values) : textOf(value))
}
