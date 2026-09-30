import { unsafeCSS } from '@a11d/lit'

/** What cannot be used right now: one dimming and one cursor for every control. */
export const disabled = unsafeCSS`
	opacity: 0.5;
	cursor: not-allowed;
`
