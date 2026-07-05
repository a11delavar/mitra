import { css } from '@a11d/lit'
import { outlineStyles } from './outlineStyles.js'

export const selectStyles = css`
	::picker(select) {
		appearance: base-select;
		background: color-mix(in srgb, color-mix(in srgb, var(--color-background) 80%, var(--color-surface)) 95%, transparent);
		backdrop-filter: blur(10px);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: 8px;
		padding: 0.375rem;
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.2),
			0 16px 48px rgba(0, 0, 0, 0.2);
		color: var(--color-text);
		min-width: 150px;
	}

	select {
		&::picker-icon {
			content: "";
			display: block;
			width: 1.125rem;
			height: 1.125rem;
			background-color: color-mix(in srgb, var(--color-text) 60%, transparent);
			-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
			-webkit-mask-size: contain;
			-webkit-mask-position: center;
			-webkit-mask-repeat: no-repeat;
			mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
			mask-size: contain;
			mask-position: center;
			mask-repeat: no-repeat;
			transition: rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
		}

		${outlineStyles};

		&:is(:open, :popover-open)::picker-icon {
			rotate: 180deg;
		}

		/* Subtle: looks like plain text (inheriting its surroundings) until you interact with it — the
		   picker chevron only appears while hovered, open, or focused. The select.css.ts counterpart of
		   input.css.ts's \`input.subtle\`. */
		&.subtle {
			appearance: base-select;
			display: flex;
			align-items: center;
			background: transparent;
			border: none;
			font: inherit;
			color: var(--color-text);
			margin: -2px -4px;
			padding: 2px 4px;
			border-radius: var(--border-radius);
			cursor: pointer;

			&::picker-icon {
				margin-inline-start: auto;
				opacity: 0;
				transition: opacity 0.15s ease, rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
			}

			&:is(:hover, :open, :focus-visible) {
				background: color-mix(in srgb, var(--color-text) 6%, transparent);

				&::picker-icon {
					opacity: 1;
				}
			}
		}

		& > button {
			display: contents;
			& > selectedcontent {
				kbd {
					display: none;
				}
			}
		}

		& > option {
			appearance: base-select;
			position: relative;
			outline: none; /* Kills the white focus ring */
			border: none;
			padding-block: 0.2rem;
			padding-inline: 2rem 0.5rem; /* Adjusted for the absolute checkmark */
			border-radius: 6px;
			cursor: pointer;
			font-family: inherit;
			font-size: 0.8125rem;
			font-weight: 500;
			color: color-mix(in srgb, var(--color-text) 80%, transparent);
			transition: all 0.15s ease;
			display: flex;
			align-items: center;
			justify-content: space-between;

			&:not(:last-child) {
				margin-block-end: 0.125rem;
			}

			&:hover, &:focus-visible {
				background: color-mix(in srgb, var(--color-text) 8%, transparent);
				color: var(--color-text);
			}

			&:checked {
				font-weight: 600;
				color: var(--color-text);
				&::before {
					content: "";
					position: absolute;
					inset-inline-start: 0.625rem;
					top: 50%;
					transform: translateY(-50%);
					width: 0.875rem;
					height: 0.875rem;
					background-color: var(--color-text);
					-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
					-webkit-mask-size: contain;
					-webkit-mask-position: center;
					-webkit-mask-repeat: no-repeat;
					mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
					mask-size: contain;
					mask-position: center;
					mask-repeat: no-repeat;
				}
			}

			&::checkmark {
				display: none;
			}
		}
	}
`
