import { unsafeCSS } from '@a11d/lit'
import { activated } from './activated.css.js'
import { checkmark } from './checkmark.css.js'

/**
 * A ROW IN A LIST OF OPTIONS — one definition serving every list the app offers: a native select's
 * `::picker(select)` options (grouped or not) and the time-zone picker's buttons. They are the same thing
 * to a reader, so they are the same thing here: identical height, gutter, hover surface and chosen state.
 * The two used to be styled separately and had drifted apart on all four.
 *
 * A row is deliberately NOT as tall as a control (`controlHeight.css.ts`): a list is read as a block, and
 * rows that stand as tall as a button push a picker past the screen. Its height falls out of padding plus
 * one line, and only the padding grows for a finger.
 *
 * Mix `pickerRow` into the row itself, and `pickerRowChosen` into whatever marks the current one —
 * `:checked` for an option, `[data-selected]` for a button. Both leave the row's own COLUMNS to the
 * caller: what a row is made of differs (a zone has an offset and a city, a source has a colour dot).
 */
// NB `unsafeCSS(…)` is CALLED, not used as a template tag: as a tag it receives the strings array and
// every interpolated value as separate arguments, keeps only the first, and would quietly drop the
// snippets mixed in below (joining the literal parts with commas). Called, JS interpolates first and it
// gets one finished string.
export const pickerRow = unsafeCSS(`
	box-sizing: border-box;
	position: relative; /* the chosen row's tick is absolutely placed in the gutter below */
	display: flex;
	align-items: center;
	gap: 0.5rem;
	/* The height is the ROW's, never whatever glyph an option happens to carry — a source's mark is a
	   PADDED box, taller than the text line, and while the height was content-driven it stretched that one
	   picker's rows past every other list's. One line plus its breathing room; a taller glyph simply
	   centres inside it. Only that breathing room grows for a finger. */
	block-size: calc(1lh + 0.75rem);
	/* A list that scrolls may lay its rows out as flex items (the time-zone picker does), and a flex item
	   SHRINKS past a specified height when the container overflows — which silently squashed every row
	   back to its bare text line. Padding was immune to that, an explicit height is not. */
	flex-shrink: 0;
	@media (pointer: coarse) {
		block-size: calc(1lh + 1.125rem);
	}
	/* The leading gutter belongs to the tick, always — so a row's label sits in the same place whether or
	   not it is the chosen one, and every list in the app has its ticks on one vertical line. */
	padding-block: 0;
	padding-inline: 2rem 0.5rem;
	border: none;
	border-radius: 6px;
	font-size: 0.8125rem;
	color: color-mix(in srgb, var(--color-text) 80%, transparent);
	cursor: pointer;
	outline: none; /* the UA's own two-tone ring — the row draws its own states instead */
	transition: background 0.15s ease, color 0.15s ease;

	&:not(:last-child) {
		margin-block-end: 0.125rem;
	}

	/* Pointer hover and the keyboard-active row share one surface, the app's usual activated fill. */
	&:is(:hover, :focus-visible) {
		${activated}
		color: var(--color-text);
	}
`)

/** The row that is currently chosen: tinted in the ambient accent, firmer, and ticked in its gutter. */
export const pickerRowChosen = unsafeCSS(`
	background: color-mix(in srgb, var(--color-accent) 12%, transparent);
	font-weight: 600;
	color: var(--color-text);

	/* The tick is ACCENT-coloured, in every list: it marks the app's own state, so it reads in the app's
	   own colour (the editor re-points that at the entry's) rather than as one more grey glyph. */
	&::before {
		${checkmark}
		background-color: var(--color-accent);
	}
`)
