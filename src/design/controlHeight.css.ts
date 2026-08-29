import { unsafeCSS } from '@a11d/lit'

/** Shared control height variable scaled for coarse pointers. */
export const controlHeight = unsafeCSS`
	--control-height: 2rem;
	@media (pointer: coarse) {
		--control-height: 2.25rem;
	}
`
