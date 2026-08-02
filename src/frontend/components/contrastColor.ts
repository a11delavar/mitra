import { unsafeCSS } from '@a11d/lit'

export function contrastColor(color: string) {
	const supports = CSS.supports('color: contrast-color(red)')
	return supports ? unsafeCSS(`contrast-color(${color})`) : unsafeCSS(`color(
		from ${color} srgb
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
	)`)
}
