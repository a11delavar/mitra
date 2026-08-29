import { css } from '@a11d/lit'

/** Keyboard shortcut chips and gesture hints styling. */
export const kbdStyles = css`
	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: inherit;
		font-size: 0.6rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--color-text) 45%, transparent);
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: 4px;
		padding: 0.125rem 0.25rem;
		pointer-events: none;
	}

	.word {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	@media (pointer: coarse) {
		:is(kbd, .word) {
			display: none;
		}
	}
`
