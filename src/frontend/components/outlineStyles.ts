import { unsafeCSS } from '@a11d/lit'

export const outlineStyles = unsafeCSS`
	&:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 20%, transparent);
	}
`