import { unsafeCSS } from '@a11d/lit'
import { ring } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { optionRow, optionRowSelected } from './optionRow.css.js'

/** A picker's list of slots (times, lengths): one column of buttons in option rows, the selected one ticked. */
export const slots = unsafeCSS(`
	display: flex;
	flex-direction: column;
	gap: 1px;

	/* The selected slot's tick keeps its room on every row, so the slots stay in one column. */
	--mitra-option-inset: 1.75rem;

	button {
		all: unset;
		${optionRow}
		font-variant-numeric: tabular-nums;
		white-space: nowrap;

		&:hover {
			${activated}
		}

		&:focus-visible {
			${ring}
		}

		&[aria-selected=true] {
			${optionRowSelected}
		}
	}
`)
