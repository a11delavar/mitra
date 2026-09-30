import { unsafeCSS } from '@a11d/lit'
import { checkmark } from './checkmark.css.js'
import { controlHeight } from './controlHeight.css.js'
import { selected } from './selected.css.js'

/** A row to choose in a list (an option, a menu item, a time slot): the one shape. Hover is `activated`, applied by
 * the row itself: a shadow host reaches its own states only through `:host(...)`, which nesting cannot write. */
export const optionRow = unsafeCSS(`
	${controlHeight}
	position: relative;
	box-sizing: border-box;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	min-block-size: var(--control-height);
	padding-block: 0.25rem;
	padding-inline: var(--mitra-option-inset, 0.625rem) 0.625rem;
	border: 1px solid transparent;
	border-radius: var(--border-radius);
	font-size: 0.8125rem;
	cursor: pointer;
	user-select: none;
	transition: background 0.15s ease;
`)

/** The selected row of a set: `selected`, and ticked in its words' colour in the inset it keeps for that (`--mitra-option-inset`). */
export const optionRowSelected = unsafeCSS(`
	${selected}

	&::before {
		${checkmark}
	}
`)
