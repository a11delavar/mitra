import { unsafeCSS } from '@a11d/lit'

/**
 * THE surface an interactive thing wears while it is engaged — a field holding the caret or an open
 * picker, a hovered button, a hovered menu row, an icon button under the pointer. Fields, buttons, icon
 * buttons and menu items all mix this in rather than each writing their own colour-mix, so "make it a
 * bit more subtle" is a one-line change here and nowhere else.
 *
 * It is deliberately only a background: what the states LOOK like is the surface's business (a field
 * drops its hover border when it lights up, a button keeps its own), but the fill itself is shared.
 */
export const activated = unsafeCSS`
	background: color-mix(in srgb, var(--color-text) 5%, transparent);
`
