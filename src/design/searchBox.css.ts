import { unsafeCSS } from '@a11d/lit'

/** A search input with its magnifier inside, over the input's leading padding. Declared on the element holding both. */
export const searchBox = unsafeCSS(`
	position: relative;
	display: flex;
	align-items: center;

	> mitra-icon {
		position: absolute;
		inset-inline-start: 0.625rem;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		pointer-events: none;
	}

	input[type=search] {
		inline-size: 100%;
		padding-inline-start: 2rem;

		&::-webkit-search-cancel-button {
			display: none;
		}
	}
`)
