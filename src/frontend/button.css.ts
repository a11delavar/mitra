import { css } from '@a11d/lit'

export const buttonStyles = css`
	button {
		display: flex;
		gap: 0.375rem;
		font-family: inherit;
		font-weight: 500;
		background: color-mix(in srgb, white 5%, transparent);
		color: var(--color-text);
		border: 1px solid color-mix(in srgb, white 6%, transparent);
		border-radius: var(--border-radius);
		padding: 0.375rem 0.75rem;
		transition: all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
		line-height: 1.2;

		&:hover {
			background: color-mix(in srgb, white 9%, transparent);
			border-color: color-mix(in srgb, var(--color-text) 12%, transparent);
		}

		&:active {
			background: color-mix(in srgb, white 14%, transparent);
			transform: scale(0.97);
		}

		&:focus-visible {
			outline: none;
			border-color: var(--color-accent);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 20%, transparent);
		}

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
			border-radius: var(--border-radius);
			padding: 0.125rem 0.25rem;
			pointer-events: none;
		}
	}
`
