import { unsafeCSS } from '@a11d/lit'

/** Readable ink on `color`. Detection stays in CSS (`@supports`), so it evaluates outside a browser too. */
export function contrastColorOf(property: string, color: string) {
	return unsafeCSS(`
		${property}: color(
			from ${color} srgb
			calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
			calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
			calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
		);

		@supports (color: contrast-color(red)) {
			${property}: contrast-color(${color});
		}
	`)
}
