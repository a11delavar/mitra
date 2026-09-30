import { unsafeCSS } from '@a11d/lit'
import { ring } from './focusRing.css.js'

/**
 * A raw `<button>` that reads as something other than a button (a row, a card, a label): the platform's chrome
 * gone and the app's focus ring in its place; the context draws the rest. A button that looks like one is `mitra-button`.
 */
export const pressable = unsafeCSS(`
	all: unset;
	box-sizing: border-box;
	cursor: pointer;

	&:focus-visible {
		${ring};
	}

	&:disabled {
		cursor: default;
	}

	&[hidden] {
		display: none;
	}
`)
