import { unsafeCSS } from '@a11d/lit'

/** A line between groups of rows, in a menu or a select's list; a tree's grid gives it the whole row. */
export const separator = unsafeCSS(`
	flex-shrink: 0;
	grid-column: 1 / -1;
	inline-size: 100%;
	margin: 0.25rem 0;
	border: none;
	border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
`)
