import { unsafeCSS } from '@a11d/lit'

/** SVG checkmark mask styles for selected option rows. */
export const checkmark = unsafeCSS`
	content: "";
	position: absolute;
	inset-inline-start: 0.625rem;
	top: 50%;
	translate: 0 -50%;
	inline-size: 0.875rem;
	block-size: 0.875rem;
	background-color: currentColor;
	-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
	-webkit-mask-size: contain;
	-webkit-mask-position: center;
	-webkit-mask-repeat: no-repeat;
	mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
	mask-size: contain;
	mask-position: center;
	mask-repeat: no-repeat;
`
