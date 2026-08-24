import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'

/**
 * The unified editor-field convention: ONE interactive box per field, its leading glyph INSIDE it.
 * At rest a field is invisible; hovering surfaces a border around the whole box (glyph included);
 * activating it fills it with a background; keyboard focus adds the app's accent ring (focusRing.css.ts
 * — the same ring the buttons and icon buttons wear). Every field stands one shared control height tall
 * (`controlHeight.css.ts`, which is also what a standalone button or input measures, and which grows on
 * touch), so rows never shift as they switch between plain text, inputs, and rendered content.
 *
 * The box carries the look; the controls INSIDE a field stay bare — input.css.ts/button.css.ts only
 * chrome standalone controls. A nested <dialog> is its own surface, so its controls keep the
 * standalone chrome (hence the `dialog *` carve-outs).
 *
 * A field may BE its control (the title input) or CONTAIN it (everything else), so each state below
 * is written for both shapes. That is what makes the title behave like every other field.
 *
 * A field is also the ANCHOR for whatever it opens. Every field carries the same `--field` name and
 * confines it to its own subtree with `anchor-scope`, so each popover inside resolves to ITS field
 * without a single per-instance token — the reason the field components hold no anchor counters. It
 * matters visually: a menu anchored to the control instead of the field starts a whole icon gutter
 * (~44px) further in, and the flipped placement then opens ON TOP of the field's own glyph.
 */
export const fieldStyles = css`
	.field {
		box-sizing: border-box;
		/* A field may BE a control — the title input, or the button standing in for an unset end date — so
		   the convention itself sheds the UA's own chrome for those. Declared here rather than left to an
		   all:unset in the component, because that weighs the same as the .field class and, coming later,
		   used to strip the field's own radius and padding right back off. */
		appearance: none;
		font: inherit;
		color: inherit;
		text-align: start;
		${controlHeight};
		min-height: var(--control-height);
		--field-padding-inline: 0.5rem;
		line-height: 1.4; /* one line metric for every face of a field — text, inputs, rendered markdown */
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		/* A token, so fields that sit SIDE BY SIDE in one row (the date and time pairs) can tighten it
		   and still keep their text on the popover's content line. */
		padding-inline: calc(var(--field-padding-inline) - 1px);
		transition: border-color 0.15s ease, background-color 0.15s ease;

		anchor-name: --field;
		anchor-scope: --field; /* confined to this field, so one name serves every field */

		/* Content stretches to the box so the WHOLE box is the interaction target; the leading glyph
		   pins to the first line's center instead, where it stays when the field grows. */
		align-items: stretch;
		> mitra-icon {
			align-self: start;
			margin-block-start: calc((var(--control-height) - 2px) / 2 - 0.5em);
		}

		/* Every state selector below is wrapped in :where() so they all weigh exactly ONE class and their
		   ORDER decides, hover then activated. Their natural specificities differ wildly (the activated
		   list has to name the controls it looks for), and that difference used to leak: for a TEXT field
		   the activated arm outweighed the focus ring and swallowed its border, so a focused text field
		   showed a plain fill while a focused select showed fill AND ring. Same state, two looks. */
		&:where(:hover) {
			border-color: color-mix(in srgb, var(--color-text) 15%, transparent);
		}

		/* Activated: the fill is the whole signal — the hover border stands down (declared after
		   :hover on purpose, so a hovered-while-active field stays borderless).

		   What counts as activated depends on what the field HOLDS, deliberately. A field you can type
		   into is active while focus sits inside it — there is a caret to explain the fill. A field that
		   merely OPENS something is active only while that thing is open, or when focus arrived from the
		   keyboard: a tap must not leave the row lit behind it, which is exactly what a plain
		   focus-within did on a touch screen — a select keeps focus after its picker closes, so the
		   highlight stayed sitting there. */
		&:where(
			:is(input, textarea, :has(:is(input:not([type=checkbox], [type=radio]), textarea))):focus-within,
			:open, :has(:is(select, input):open, :popover-open),
			:focus-visible, :has(:focus-visible)
		) {
			${activated};
			border-color: transparent;
		}

		/* Whatever the field opens hangs off the FIELD box (see the note above) — menus, suggestion
		   lists, the zone picker, and a select's own picker alike. A field that stands MANY rows tall
		   is the exception the rule can't cover (its box is nowhere near the control that opened the
		   popover), so it may name another anchor through --field-anchor rather than fight this
		   declaration on specificity. */
		[popover],
		select::picker(select) {
			position-anchor: var(--field-anchor, --field);
		}

		:is(input, textarea, select):not(dialog *) {
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

			/* A growing textarea centers its FIRST line at the field height (and keeps the whole
			   box typeable-into), so single-line and multi-line fields share one rhythm. */
			&:is(textarea) {
				padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
			}
		}

		/* A date/time input's highlighted segment is NOT text selection — it lives in the UA's own shadow
		   tree, so the editor's tinted ::selection never reached it and Chrome painted the system blue
		   there while the title beside it highlighted in the entry's colour. These pseudo-elements are the
		   only handle on it; the tint follows the ambient accent, which the editor re-points at the entry. */
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
			cursor: pointer; /* the standalone button chrome that used to supply this stands down here */

			/* The picker chevron belongs to the FIELD's interaction, not the select's: it surfaces
			   while the box is hovered or active, right-aligned like every other trailing affordance. */
			&::picker-icon {
				margin-inline-start: auto;
				opacity: 0;
				transition: opacity 0.15s ease, rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
			}
		}

		&:is(:hover, :focus-within, :has(select:open)) select::picker-icon {
			opacity: 1;
		}

		/* Declared last so the ring wins over the activated state's transparent border. */
		${focusRing};

		/* A popover the field owns is its OWN surface: focus moving into the zone picker's search box is
		   not focus in the field, so it must not make the field read as focused. The field still shows
		   the activated fill (it does hold something open) — it just doesn't claim the ring. */
		&:has([popover]:popover-open) {
			border-color: transparent;
			box-shadow: none;
		}
	}

	/* ONE placeholder voice, whatever renders it: a native input's own placeholder, the stand-in text a
	   non-input field shows when it holds no value (Reminders, an empty Description), and a control
	   whose current value means "nothing chosen" — a select reading "Does not repeat", a zone row
	   showing the viewer's own zone because the entry named none. They must be indistinguishable: the
	   whole point is that a row with no value reads the same everywhere. */
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
