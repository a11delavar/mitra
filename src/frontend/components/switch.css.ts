import { css } from '@a11d/lit'
import { outlineStyles } from './outlineStyles.js'

export const switchStyles = css`
	.switch {
		all: unset;
		box-sizing: border-box;
		inline-size: 1.75rem;
		block-size: 1rem;
		flex-shrink: 0;
		justify-self: start;
		position: relative;
		border-radius: 1rem;
		background: color-mix(in srgb, currentColor 20%, transparent);
		cursor: pointer;
		transition: background 0.15s ease;

		&::before {
			content: "";
			position: absolute;
			inset-block-start: 2px;
			inset-inline-start: 2px;
			inline-size: calc(1rem - 4px);
			block-size: calc(1rem - 4px);
			border-radius: 50%;
			background: currentColor;
			transition: translate 0.15s ease;
		}

		&[aria-checked="true"] {
			background: var(--color-accent);

			&::before {
				translate: 0.75rem 0;
				background: var(--color-accent-text);
			}
		}

		${outlineStyles};
	}
`
