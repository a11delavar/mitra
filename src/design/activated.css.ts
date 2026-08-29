import { unsafeCSS } from '@a11d/lit'

/** Shared background surface for active and hovered interactive elements. */
export const activated = unsafeCSS`
	background: color-mix(in srgb, var(--color-text) 5%, transparent);
`
