import { unsafeCSS } from '@a11d/lit'

/**
 * The height every interactive control shares — an editor field, a button, a select, a standalone input.
 * Mixed into each of those rules so the property is declared ON the control itself: nothing has to sit
 * in the app's `:root`, and there is still exactly ONE place the number changes. Read it back as
 * `var(--control-height)` inside whichever rule mixed it in (fields also do arithmetic with it).
 *
 * Touch is the axis, not viewport size: a finger needs a bigger target than a mouse does, while a narrow
 * desktop window still has a precise pointer. NB the media feature is `pointer` — `cursor` is not one, so
 * a `@media (cursor: coarse)` block parses fine and then silently never matches.
 */
export const controlHeight = unsafeCSS`
	--control-height: 2rem;
	@media (pointer: coarse) {
		--control-height: 2.25rem;
	}
`
