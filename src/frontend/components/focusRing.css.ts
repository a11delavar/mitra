import { css, unsafeCSS } from '@a11d/lit'

/**
 * THE keyboard-focus indicator, for every interactive surface in the app: a ring in the ambient accent
 * colour (which the entry editor re-points at the entry's own colour, so a focused control inside it
 * picks up that entry's hue). Fields, buttons, icon buttons, selects, inputs, switches and menu items
 * all mix this in rather than each inventing their own — it is the one place the ring changes.
 *
 * Nest it inside a rule for the focusable surface; it brings its own `:focus-visible` selector. The
 * `:has()` arm covers a surface whose focus lands on a control INSIDE it — an editor field's box has to
 * show the ring for the input it wraps, since the control itself is deliberately bare (field.css.ts).
 * It never matches for a plain button, which has nothing focusable inside.
 *
 * The surface must have a border box to colour: everything that mixes this in declares
 * `border: 1px solid transparent` (or a real border) so the ring has somewhere to land.
 */
export const focusRing = unsafeCSS`
	&:is(:focus-visible, :has(:focus-visible)) {
		outline: none;
		border-color: var(--focus-ring-color, transparent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-ring-color, transparent) 45%, transparent);
	}
`

/**
 * The one thing about the ring that genuinely cannot be local: WHETHER it shows. The ring is a keyboard
 * affordance, and `:focus-visible` alone is not uniform enough to express that — the UA grants it to a
 * clicked text input but not to a clicked button, so a click used to ring a location field while leaving
 * an icon button plain. So the ring's colour is withheld until a key is pressed, which
 * `Mitra.trackFocusModality` reports by stamping the document element.
 *
 * It rides on a custom property rather than an `html[…] &` ancestor selector because custom properties
 * inherit THROUGH shadow boundaries: this ring is mixed into styles that also run inside the dialog's
 * shadow root, where a `:root` ancestor selector can never match. The absent (pointer) case needs no
 * declaration at all — the ring falls back to transparent above. Registered once by Mitra.
 */
export const focusRingStyles = css`
	:root[data-focus-modality="keyboard"] {
		--focus-ring-color: var(--color-accent);
	}
`
