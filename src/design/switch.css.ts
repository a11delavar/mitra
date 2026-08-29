import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'

export const switchStyles = css`
	.switch {
		all: unset;
		box-sizing: border-box;

		&[hidden] {
			display: none;
		}

		--switch-block-size: 1rem;
		inline-size: calc(var(--switch-block-size) * 1.75);
		block-size: var(--switch-block-size);
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
			inline-size: calc(var(--switch-block-size) - 4px);
			block-size: calc(var(--switch-block-size) - 4px);
			border-radius: 50%;
			background: currentColor;
			transition: translate 0.15s ease;
		}

		&[aria-checked="true"] {
			background: var(--color-accent);

			&::before {
				translate: calc(var(--switch-block-size) * 0.75) 0;
				background: var(--color-accent-text);
			}
		}

		${focusRing};
	}
`
