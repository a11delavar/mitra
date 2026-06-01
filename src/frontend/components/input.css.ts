import { css } from '@a11d/lit'
import { outlineStyles } from './outlineStyles.js'

export const inputStyles = css`
	:is(input:not([type=checkbox]), textarea) {
		appearance: none;
		box-sizing: border-box;
		font-weight: 400;
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

		&:read-only {
			opacity: 0.55;
			cursor: not-allowed;
		}

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
		}

		${outlineStyles};

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

	textarea {
		height: auto;
		field-sizing: content;
		resize: none;
		line-height: 1.4;
	}

	input[type=checkbox] {
		display: inline-grid;
		appearance: none;
		box-sizing: border-box;
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		padding: 0;
		border-radius: var(--border-radius);
		background: color-mix(in srgb, var(--color-text) 6%, transparent);
		display: grid;
		place-content: center;
		cursor: pointer;
		outline: none;
		transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

		&::before {
			content: "";
			width: 0.8rem;
			height: 0.8rem;
			transform: scale(0);
			transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.4);
			background-color: var(--color-accent-text);
			-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E") center / contain no-repeat;
			mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E") center / contain no-repeat;
		}

		&:checked {
			background: var(--color-accent);
			border-color: var(--color-accent);

			&::before {
				transform: scale(1.1);
				margin-bottom: -1px;
			}
		}

		${outlineStyles};
	}
`
