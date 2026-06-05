import { unsafeCSS } from '@a11d/lit'

export function colorContrast(color: string) {
	return unsafeCSS(`color(
		from ${color} srgb
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
		calc(1 - min(1, max(0, (r * 299 + g * 587 + b * 114) / 1000 * 255 - 128)))
	)`)
}
