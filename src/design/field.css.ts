import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'

/**
 * Unified editor field styles, anchor scoping, state indicators, and placeholder styling.
 */
export const fieldStyles = css`
	.field {
		box-sizing: border-box;
		appearance: none;
		font: inherit;
		color: inherit;
		text-align: start;
		${controlHeight};
		min-height: var(--control-height);
		--field-padding-inline: 0.5rem;
		line-height: 1.4;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding-inline: calc(var(--field-padding-inline) - 1px);
		transition: border-color 0.15s ease, background-color 0.15s ease;

		anchor-name: --field;
		anchor-scope: --field;

		align-items: stretch;
		> mitra-icon {
			align-self: start;
			margin-block-start: calc((var(--control-height) - 2px) / 2 - 0.5em);
		}

		&:where(:hover) {
			border-color: color-mix(in srgb, var(--color-text) 15%, transparent);
		}

		&:where(
			:is(input, textarea, :has(:is(input:not([type=checkbox], [type=radio]), textarea))):focus-within,
			:open, :has(:is(select, input):open, :popover-open),
			:focus-visible, :has(:focus-visible)
		) {
			${activated};
			border-color: transparent;
		}

		[popover],
		select::picker(select) {
			position-anchor: var(--field-anchor, --field);
		}

		/* Preserves checkbox/radio boxes inside fields (e.g. description task lists). */
		:is(input:not([type=checkbox], [type=radio]), textarea, select):not(dialog *) {
			height: auto;
			background: transparent;
			border: none;
			border-radius: 0;
			padding: 0;
			font: inherit;
			color: inherit;
			box-shadow: none;
			outline: none;

			&:is(:hover, :active, :focus, :focus-visible) {
				background: transparent;
				box-shadow: none;
				outline: none;
			}

			&:is(textarea) {
				padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
			}
		}

		:is(input[type=date], input[type=time]) {
			&::-webkit-datetime-edit-year-field:focus,
			&::-webkit-datetime-edit-month-field:focus,
			&::-webkit-datetime-edit-day-field:focus,
			&::-webkit-datetime-edit-hour-field:focus,
			&::-webkit-datetime-edit-minute-field:focus,
			&::-webkit-datetime-edit-ampm-field:focus {
				background: color-mix(in srgb, var(--color-accent) 40%, transparent);
				color: inherit;
			}
		}

		select:not(dialog *) {
			display: flex;
			align-items: center;
			justify-content: start;
			cursor: pointer;

			&::picker-icon {
				margin-inline-start: auto;
				opacity: 0;
				transition: opacity 0.15s ease, rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
			}
		}

		&:is(:hover, :focus-within, :has(select:open)) select::picker-icon {
			opacity: 1;
		}

		${focusRing};

		&:has([popover]:popover-open) {
			border-color: transparent;
			box-shadow: none;
		}
	}

	.field {
		::placeholder,
		.placeholder,
		&:is([data-placeholder], :has([data-placeholder])) :is(selectedcontent, .text),
		[data-placeholder] {
			color: var(--color-text-muted);
			opacity: 1;
			font-weight: 400;
		}
	}
`
