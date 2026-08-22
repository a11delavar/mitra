import { css, unsafeCSS } from '@a11d/lit'

/**
 * Installed as an app, Mitra takes the title bar over (`window-controls-overlay` in the manifest) and
 * owes the user a place to grab the window back. `-webkit-app-region` is that place — and it is unlike
 * every other thing CSS does, so read this before touching the chrome.
 *
 * The region is a list of RECTANGLES handed to the window manager, built by walking the layout tree in
 * order: `drag` adds a box, `no-drag` subtracts one. Nothing else about the page reaches it. Not
 * z-index, not the top layer, not `pointer-events`, not whether an element is even visible — only
 * boxes, in tree order. Two consequences decide everything below:
 *
 *   · Over a drag box the pointer belongs to the WINDOW MANAGER, not the page. Not just clicks: the
 *     wheel too. A scroller left inside one does not scroll, and a control inside one cannot be
 *     pressed — it is not "swallowed events", it is that those pixels are no longer the app's.
 *   · A drag box covers pixels its author never named, including pixels belonging to components that
 *     did not exist when it was written.
 *
 * Which is exactly how this shipped broken. The chrome claimed its whole box and then listed the
 * exceptions — `button`, `mitra-icon-button`, `mitra-color-picker`, … — a blocklist that could only
 * ever name what was already there. `mitra-tabs` and the planning list arrived later and were never
 * added, so in the installed app the sidebar's tabs could not be clicked or swiped and everything in
 * the planning tab was dead. Nobody wrote that bug; the polarity did.
 *
 * So the polarity is inverted here. A handle claims its box and hands EVERY element inside it straight
 * back, unconditionally. What stays draggable is precisely the space no element occupies — padding,
 * gaps, the stretch beside a title — which is what "dead space" means and needs no list to describe.
 * Anything ever nested in the chrome is live by construction. Where a box that is genuinely inert
 * SHOULD carry the window (the brand mark, a heading), it says so by name — an allowlist of things
 * that are inert forever, not a blocklist of things that happen to be interactive today.
 *
 * Nest it inside the rule for the chrome, under the `window-controls-overlay` media query.
 */
export const windowDragHandle = unsafeCSS`
	-webkit-app-region: drag;

	/* Zero specificity, so any box that means to carry the window can name itself and win. */
	:where(& *) {
		-webkit-app-region: no-drag;
	}
`

/**
 * The other half, and the one no chrome can fix from its own side: the top layer paints OVER the drag
 * region without being part of it. An open popover has no idea what it landed on, and the region has
 * no idea it is there — so an entry's details opening near the top of the window used to have its
 * title field and source switcher fall inside the header's rectangle and go dead, while the rest of
 * the same popover worked.
 *
 * A top-layer surface is laid out last, so its `no-drag` subtracts from whatever was added before it:
 * one rule, applied while it is open, cuts the surface's own hole wherever it happens to land. Every
 * popover and dialog in the app renders into the light DOM and is reached from here; `mitra-dialog`
 * keeps its own copy because its `<dialog>` lives in a shadow root.
 */
export const windowDragStyles = css`
	@media (display-mode: window-controls-overlay) {
		:where(:popover-open, dialog:open) {
			-webkit-app-region: no-drag;
		}
	}
`
