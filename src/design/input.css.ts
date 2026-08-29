import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { controlHeight } from './controlHeight.css.js'

export const inputStyles = css`
	:is(input:not([type=checkbox], [type=radio], [type=range]), textarea) {
		appearance: none;
		box-sizing: border-box;
		font-family: inherit;
		color: var(--color-text);
		min-width: 0;
		max-width: 100%;
		outline: none;

		/* Standalone (dialog forms, search rows): the control is its own box. Inside a \`.field\` the
		   FIELD is the box and the control stays bare (see field.css.ts) — except in a nested
		   <dialog>, which is its own surface again. :where keeps the guard specificity-free so
		   per-site overrides keep winning like they always did. */
		&:where(:not(.field, .field *), dialog *) {
			${controlHeight};
			height: var(--control-height);
			font-size: 0.8125rem;
			font-weight: 500;
			background: color-mix(in srgb, var(--color-text) 5%, transparent);
			border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
			border-radius: 6px;
			padding: 0.375rem 0.75rem;
			transition: all 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);

			&:read-only {
				opacity: 0.55;
				cursor: not-allowed;
			}

			&:hover {
				background: color-mix(in srgb, var(--color-text) 8%, transparent);
			}

			${focusRing};

			&:is(textarea) {
				height: auto;
				min-height: var(--control-height);
			}
		}
	}

	textarea {
		field-sizing: content;
		resize: none;
		line-height: 1.4;
	}

	/* The radio counterpart of the checkbox below: same surfaces and accent, but a circle with a dot. */
	input[type=radio] {
		appearance: none;
		box-sizing: border-box;
		flex-shrink: 0;
		inline-size: 1.125rem;
		block-size: 1.125rem;
		margin: 0;
		padding: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-text) 6%, transparent);
		display: inline-grid;
		place-content: center;
		cursor: pointer;
		outline: none;
		transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

		&::before {
			content: "";
			inline-size: 0.5rem;
			block-size: 0.5rem;
			border-radius: 50%;
			transform: scale(0);
			transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.4);
			background-color: var(--color-accent-text);
		}

		&:checked {
			background: var(--color-accent);

			&::before {
				transform: scale(1);
			}
		}

		${focusRing};
	}

	input[type=checkbox] {
		display: inline-grid;
		appearance: none;
		box-sizing: border-box;
		flex-shrink: 0;
		inline-size: 1.125rem;
		block-size: 1.125rem;
		margin: 0;
		padding: 0;
		border-radius: var(--border-radius);
		background: color-mix(in srgb, var(--color-text) 6%, transparent);
		place-content: center;
		cursor: pointer;
		outline: none;
		transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

		&::before {
			content: "";
			inline-size: 0.8rem;
			block-size: 0.8rem;
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

		${focusRing};
	}
`
