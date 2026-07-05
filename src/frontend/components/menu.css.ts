import { css } from '@a11d/lit'
import { outlineStyles } from './outlineStyles.js'

/** Popover dropdown menu, anchored via CSS anchor positioning (the anchor link is set per-instance). */
export const menuStyles = css`
	menu[popover] {
		margin: 0;
		margin-block-start: 0.25rem;
		padding: 0.25rem;
		min-width: 150px;
		list-style: none;
		background: color-mix(in srgb, var(--color-surface) 95%, transparent);
		backdrop-filter: blur(10px);
		border: var(--border);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		position-area: bottom span-left;
		position-try-fallbacks: flip-block;

		&:popover-open {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		button {
			all: unset;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.4rem 0.625rem;
			border-radius: var(--border-radius);
			border: 1px solid transparent;
			font-size: 0.8125rem;
			font-weight: 500;
			color: var(--color-text);
			cursor: pointer;
			transition: background 0.15s ease, box-shadow 0.15s ease;

			mitra-icon {
				font-size: 15px;
			}

			&:hover,
			&:focus-visible {
				background: color-mix(in srgb, var(--color-text) 8%, transparent);
			}

			${outlineStyles};

			&.danger {
				color: #ff6b6b;
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;

				&:hover {
					background: transparent;
				}
			}
		}
	}
`
