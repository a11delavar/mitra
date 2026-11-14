import { unsafeCSS } from '@a11d/lit'

/**
 * The smallest length that is a whole number of screen pixels and also exact where layout stores lengths, in 64ths of a CSS
 * pixel: 1px at 100%, 2px at 150%, 4px at 125%.
 */
function evenStepAt(ratio: number) {
	for (let pixels = 1; pixels <= 64; pixels++) {
		const length = pixels / ratio
		if (Math.abs(length * 64 - Math.round(length * 64)) < 1e-6) {
			return length
		}
	}
	return 1
}

/** Publishes both on the page, again whenever zoom or another screen changes the ratio. */
function publish() {
	const ratio = globalThis.devicePixelRatio
	if (!ratio || !globalThis.document) {
		return
	}
	document.documentElement.style.setProperty('--mitra-device-pixel', `${1 / ratio}px`)
	document.documentElement.style.setProperty('--mitra-even-step', `${evenStepAt(ratio)}px`)
	// The query matching this ratio stops matching once it changes.
	matchMedia(`(resolution: ${ratio}dppx)`).addEventListener('change', publish, { once: true })
}
publish()

/** One screen pixel, in CSS pixels: a whole CSS pixel is a fraction of one at 125% or 150% scaling. */
export const devicePixel = unsafeCSS`var(--mitra-device-pixel, 1px)`

/**
 * The step marks that repeat should advance by, so each lands at the same place within a screen pixel and paints like the
 * last: a length a screen pixel wide is not exact in layout at 125% or 150%, so marks spaced by it drift and paint unevenly.
 */
export const evenStep = unsafeCSS`var(--mitra-even-step, 1px)`
