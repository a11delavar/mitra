import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'
import { pickerRow, pickerRowChosen } from './pickerRow.css.js'

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
		position-try-fallbacks: flip-block;

		/* KNOWN GAP — a menu opened from inside a bottom SHEET lands above its button instead of below,
		   with the whole sheet body free underneath. Debugged; the cause is two layers deep:
		     1. A sheet is a scroll TRACK whose one-viewport spacer sits above its body (see
		        components/sheet.ts), so every anchor inside it has a LAYOUT position a viewport-plus below
		        its visual one — measured on the participants menu: anchor layout top 1080, track scrollTop
		        641, visual top 440, in a 760px viewport. position-area makes the anchor's LAYOUT box the
		        popover's containing block, so "bottom" is a region entirely below the viewport; the box
		        overflows it and flip-block picks "top" (the computed position-area reads "span-left top").
		        The anchor's scroll adjustment is applied afterwards, carrying the menu far above the button.
		        Dropping the fallback does not help — a degenerate region end-aligns the box (measured 274
		        for a 198px menu). Writing the placement with anchor() INSETS does fix it (measured 476
		        against an anchor bottom of 472): insets are plain lengths on a viewport-sized containing
		        block, never a region that can degenerate.
		     2. That placement cannot be applied from inside @container anchored(fallback: --sheet): the
		        query's answer depends on the very placement those properties would change, so Chromium
		        ignores position-affecting declarations there. Verified — a custom property set in that
		        block lands while position-area / inset / position-try-fallbacks in the same block do not.
		   So the fix wants the sheet mode as plain STATE (an attribute stamped by the code that already
		   drives the track) for this rule to key off. Left as one documented gap rather than worked around
		   per component: every menu and every select picker inside a sheet shares it. */

		&:popover-open {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		/* A row may be a LINK where the action is a navigation the platform owns (a mailto), so it
		   keeps the anchor's own affordances instead of a click handler faking them. */
		:is(button, a) {
			all: unset;
			${controlHeight};
			/* A row is a target like any other control, so it stands the shared height (min-, so a wrapped
			   label still grows) — and gets taller on touch along with everything else. */
			box-sizing: border-box;
			min-height: var(--control-height);
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.4rem 0.625rem;
			border-radius: var(--border-radius);
			border: 1px solid transparent;
			font-size: 0.8125rem;
			font-weight: 500;
			color: var(--color-text);
			cursor: pointer;
			transition: background 0.15s ease, box-shadow 0.15s ease;

			mitra-icon {
				font-size: 15px;
			}

			/* A shortcut hint (the chip itself comes from kbd.css.ts, which also hides it on a touch
			   screen) sits at the trailing edge. */
			kbd {
				margin-inline-start: auto;
				&:has(+ .word) {
					margin-inline-end: -0.25rem;
				}
			}

			&:hover,
			&:focus-visible {
				${activated};
			}

			${focusRing};

			&.danger {
				color: #ff6b6b;
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;

				&:hover {
					background: transparent;
				}
			}
		}
	}

	/* A menu whose rows are OPTIONS, not actions: one of them is the current state and the rest are what
	   you can switch it to. Same container — it is still a menu — but the rows become the app's shared
	   option row (pickerRow.css.ts), the very row a select's picker and the time-zone picker give theirs,
	   so a list of options that happens to live in a menu does not read as a different kind of list than
	   one that lives in a picker.

	   No flag says so: a menu holding a row that declares itself aria-current IS a list of options — that
	   attribute is the same fact pickerRowChosen keys on, so the markup already carries it and there is
	   nothing extra for a caller to remember. Reset with all: unset first, because the action-row rules
	   above are on these same buttons and their control height would leave the rows standing taller than
	   every other list in the app. */
	menu[popover]:has([aria-current]) :is(button, a) {
		all: unset;
		/* A menu is a FLOATING surface: it must read the same wherever it is anchored. But it renders in
		   the light DOM of whatever opened it — a task status menu opens inside an entry chip's heading,
		   which is bold and tightly led — and all: unset resolves every inherited property to exactly
		   that. So the row states its own text metrics. The line-height is not only cosmetic: the shared
		   row's height is one lh plus its breathing room, so inheriting the chip's 1.1 quietly made these
		   rows shorter than the same row in a picker. */
		/* 500 is what BOTH neighbours resolve to: the action rows above declare it, and a select's option
		   inherits it from the field it drops out of. */
		font-weight: 500;
		line-height: normal;
		${pickerRow}

		&[aria-current='true'] {
			${pickerRowChosen}
		}
	}
`
