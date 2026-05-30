import { css } from '@a11d/lit'

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
		position-try-fallbacks: top span-left;

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
			font-size: 0.8125rem;
			font-weight: 500;
			color: var(--color-text);
			cursor: pointer;

			mitra-icon {
				font-size: 15px;
			}

			&:hover {
				background: color-mix(in srgb, var(--color-text) 8%, transparent);
			}

			&.danger {
				color: #ff6b6b;
			}
		}
	}
`
