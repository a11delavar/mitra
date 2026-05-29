import { css } from '@a11d/lit'

export const inputStyles = css`
	input {
		appearance: none;
		box-sizing: border-box;
		field-sizing: content;
		height: 2rem;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		background: color-mix(in srgb, var(--color-text) 5%, transparent);
		color: var(--color-text);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: 6px;
		padding: 0.375rem 0.75rem;
		min-width: 0;
		max-width: 100%;
		outline: none;
		transition: all 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
		}

		&:focus-visible {
			border-color: var(--color-accent);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 20%, transparent);
		}

		/* Subtle: looks like plain text (inheriting its surroundings) until you interact with it. */
		&.subtle {
			height: auto;
			background: transparent;
			border-color: transparent;
			border-radius: var(--border-radius);
			margin: -2px -4px;
			padding: 2px 4px;

			&:hover {
				background: color-mix(in srgb, var(--color-text) 6%, transparent);
			}

			&:focus-visible {
				background: color-mix(in srgb, var(--color-text) 10%, transparent);
				border-color: transparent;
				box-shadow: none;
			}
		}
	}
`
