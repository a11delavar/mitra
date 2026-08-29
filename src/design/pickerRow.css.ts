import { unsafeCSS } from '@a11d/lit'
import { activated } from './activated.css.js'
import { checkmark } from './checkmark.css.js'

/**
 * Shared styling for list option rows across select pickers, menus, and time-zone selector.
 */
export const pickerRow = unsafeCSS(`
	box-sizing: border-box;
	position: relative;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	block-size: calc(1lh + 0.75rem);
	flex-shrink: 0;
	@media (pointer: coarse) {
		block-size: calc(1lh + 1.125rem);
	}
	padding-block: 0;
	padding-inline: 2rem 0.5rem;
	border: none;
	border-radius: 6px;
	font-size: 0.8125rem;
	color: color-mix(in srgb, var(--color-text) 80%, transparent);
	cursor: pointer;
	outline: none;
	transition: background 0.15s ease, color 0.15s ease;

	&:not(:last-child) {
		margin-block-end: 0.125rem;
	}

	&:is(:hover, :focus-visible) {
		${activated}
		color: var(--color-text);
	}
`)

/** Selected option row styling with accent background tint and checkmark. */
export const pickerRowChosen = unsafeCSS(`
	background: color-mix(in srgb, var(--color-accent) 12%, transparent);
	font-weight: 600;
	color: var(--color-text);

	&::before {
		${checkmark}
		background-color: var(--color-accent);
	}
`)
