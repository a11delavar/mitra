import { unsafeCSS } from '@a11d/lit'

/**
 * Whatever is selected among its kind (an option, a menu's radio row, a time slot, a weekday, a day in a month): the
 * accent's tint, and its words between the accent and the text colour, so they read on any accent.
 */
export const selectedColor = unsafeCSS('color-mix(in srgb, var(--color-accent) 70%, var(--color-text))')

export const selected = unsafeCSS(`
	background: color-mix(in srgb, var(--color-accent) 14%, transparent);
	color: ${selectedColor};
	font-weight: 600;
`)
