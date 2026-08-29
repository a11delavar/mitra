import { css, unsafeCSS } from '@a11d/lit'

/**
 * Unified focus ring styles across all interactive elements.
 */

/** Focus ring CSS declarations without the `:focus-visible` gate. */
export const ring = unsafeCSS(`
	outline: none;
	border-color: var(--focus-ring-color, transparent);
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-ring-color, transparent) 45%, transparent);
`)

export const focusRing = unsafeCSS(`
	&:is(:focus-visible, :has(:focus-visible)) {
		${ring}
	}
`)

/** Focus ring color active during keyboard navigation modality. */
export const focusRingStyles = css`
	:root[data-focus-modality="keyboard"] {
		--focus-ring-color: var(--color-accent);
	}
`
