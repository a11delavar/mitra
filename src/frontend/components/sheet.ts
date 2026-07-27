import { css } from '@a11d/lit'

/**
 * Bottom-sheet mode for popovers — opt in with the `data-sheet` attribute plus `--sheet` appended
 * as the LAST entry of the popover's `position-try-fallbacks`. The contract: the popover renders
 * exactly ONE child (the sheet body) and stays a transparent frame itself — every piece of visible
 * chrome (surface, border, radius, shadow) belongs to that child, in every mode.
 *
 * There is no mobile breakpoint. The sheet is an anchor-positioning fallback pinned to the whole
 * viewport, so it can never overflow — the browser resorts to it exactly when every anchored
 * placement before it failed, which is what "mobile" amounts to for a fixed-width popover on a
 * phone (and covers a squeezed desktop window for free). Descendants restyle through
 * `@container anchored(fallback: --sheet)`, so the entire mode switch lives in CSS.
 *
 * Dragging needs no script either: in sheet mode the popover becomes a full-viewport scroll track
 * (one viewport of spacer above the body), so the drag IS native scrolling — compositor-driven,
 * with the platform's own fling physics — and closed/open are scroll-snap stops (release snaps to
 * the nearer one; a fling follows its direction). The body's own content scrolling chains into the
 * track at its top edge, which is precisely the native sheet hand-off. `initializeSheetGestures`
 * adds only the two intents scrolling cannot express: really closing the popover once it has
 * settled on the "closed" stop, and closing it when the dim is tapped.
 */
export const sheetStyles = css`
	/* The terminal position: pinned to every viewport edge, so it always fits and is chosen exactly
	   when every anchored placement earlier in the fallback list overflowed. A position-try rule
	   only accepts position properties — everything visual hangs off the anchored() query below.
	   Adopters must NOT combine this with 'position-try-order: most-block-size': that would sort
	   the viewport-tall sheet to the front and pick it everywhere. */
	@position-try --sheet {
		position-area: none;
		inset: 0;
		margin: 0;
		inline-size: auto;
		block-size: auto;
		max-inline-size: none;
		max-block-size: none;
	}

	[popover][data-sheet] {
		/* Lets descendants ask which fallback landed, via @container anchored(). */
		container-type: anchored;

		/* Track mechanics are self-properties — a container query cannot set them on the container
		   itself — so they are unconditional. Harmless in anchored mode: without the spacer the
		   single child cannot overflow the frame, so there is no scroll range and both the snapping
		   and the timeline below sit inert. */
		overflow-x: hidden;
		overflow-y: auto;
		scroll-snap-type: block mandatory;
		scrollbar-width: none;
		overscroll-behavior: contain;

		/* Makes the slide-up on open an animation: the track opens resting at its closed stop and the
		   gesture module assigns the open offset, which this turns into a scroll. So entry and drag
		   are the same motion through the same mechanism, and the dim — being driven by that same
		   scroll — fades in with it for free. User scrolling is unaffected by this property, and the
		   reduced-motion opt-out stays in CSS, as everywhere else in the app. */
		@media (prefers-reduced-motion: no-preference) {
			scroll-behavior: smooth;
		}

		/* The frame is see-through by contract (the framework's base [popover] surface would otherwise
		   back the body's glass with an opaque plate) — the dim below overrides this while scrolled. */
		background: none;

		/* Published for the dim below to attach to. Naming a timeline costs nothing where there is no
		   scroll range, so this needs no mode guard. */
		scroll-timeline-name: --mitra-sheet-track;
		scroll-timeline-axis: block;
	}

	@keyframes mitra-sheet-dim {
		from { opacity: 0 }
		to { opacity: 1 }
	}


	@container anchored(fallback: --sheet) {
		/* The dim, as its own viewport-fixed layer animating OPACITY. Two separate reasons it cannot
		   just be the track's own animated background-color, both found the hard way:
		     1. It would defeat the drag. background-color is not a compositable property, so driving
		        it on the scroll container forced a main-thread paint per frame and the scroll stopped
		        being compositor-driven — the sheet jumped straight to the nearest stop instead of
		        following the finger. Opacity on a separate layer restored 1:1 tracking. Whatever else
		        this file grows, never animate a non-composited property on the track itself.
		     2. It must not exist AT ALL outside sheet mode: an anchored popover's track has no scroll
		        range, so the timeline driving it is inactive — and Chromium then paints the last value
		        it computed (fill mode makes no difference), which left a widened window's popover
		        darkened behind its glass. A box the mode switch creates and destroys can hold nothing
		        over.
		   Fixed rather than inset-0-absolute so it covers the viewport instead of the scrolled track,
		   and inert so a tap on it still targets the track itself (see the dismiss listener). */
		[popover][data-sheet]::after {
			content: '';
			position: fixed;
			inset: 0;
			z-index: -1;
			pointer-events: none;
			background: rgb(0 0 0 / 0.32);

			animation: mitra-sheet-dim linear both;
			animation-timeline: --mitra-sheet-track;
		}

		/* One viewport of nothing above the body — the scrolled-past spacer whose start edge is the
		   "closed" snap stop. A fling-down settles here (the body then sits fully off-screen); the
		   dismiss listener below turns that resting place into a real close. */
		[popover][data-sheet]::before {
			content: '';
			display: block;
			flex: none;
			block-size: 100dvb;
			scroll-snap-align: start;
		}

		/* The sheet body — the popover's single child, resting bottom-aligned at the "open" stop.
		   Nothing here animates it into view, and nothing here can: the body IS a snap target of a
		   mandatory-snap track, so translating it moves its own snap area and the scroller re-snaps
		   to follow, cancelling the motion out exactly (verified — the transform computes to a real
		   matrix while the body's viewport position never changes by a pixel). Hence the slide-up is
		   a scroll of the track, not a transform of the body; see scroll-behavior above. */
		[popover][data-sheet] > * {
			flex: none;
			box-sizing: border-box;
			inline-size: 100%;
			/* Reaching this fallback on a WIDE viewport means the window is merely too short for any
			   anchored placement — a full-width sheet there reads as a page-wide banner, so past phone
			   width the body caps itself and centres, becoming a bottom card instead. On phones the cap
			   never engages and nothing changes. */
			max-inline-size: 30rem;
			max-block-size: calc(100dvb - 2.5rem);
			overflow-y: auto;
			scroll-snap-align: end;
			margin: 0;
			margin-inline: auto;
			border: none;
			border-block-start: var(--border);
			border-radius: 0;
			border-start-start-radius: 1.25rem;
			border-start-end-radius: 1.25rem;
			box-shadow: 0 -12px 48px rgb(0 0 0 / 0.3);
		}

		/* The grab handle. Claims the body's ::before — a sheet body must leave it free (adjust its
		   placement per-component where the body lays out as something exotic, e.g. a grid). */
		[popover][data-sheet] > *::before {
			content: '';
			inline-size: 2.25rem;
			block-size: 0.25rem;
			border-radius: 0.125rem;
			margin-block: 0.375rem 0.125rem;
			margin-inline: auto;
			background: color-mix(in srgb, var(--color-text) 25%, transparent);
		}
	}
`

/**
 * Slide a sheet out instead of hiding it on the spot, and report whether that happened — `false`
 * means this popover is not a sheet (or is already parked closed), so the caller should just hide.
 * The slide is the *same* scroll the drag and the entry use, run backwards: the body travels down
 * and the dim fades with it, then settling at the closed stop hides the popover for real through
 * the usual dismiss path.
 *
 * It has to work this way round — scroll first, hide second — because a popover cannot animate out
 * once it is hidden. `beforetoggle` is cancelable for opening but NOT for closing (verified), so a
 * close cannot be deferred; and the platform's own exit route (`transition-behavior: allow-discrete`
 * over `display`/`overlay`) is defeated here anyway, because the editor is removed from the DOM as
 * soon as its `open` flips, which cuts any transition off. Keeping the popover open for the length
 * of the slide sidesteps both. A grab mid-slide simply takes the sheet back, for free.
 */
export function closeSheet(popover: HTMLElement) {
	if (!popover.matches('[popover][data-sheet]:popover-open') || popover.scrollHeight - popover.clientHeight <= 2) {
		return false
	}
	popover.scrollTop = 0
	return true
}

/** The intents native scrolling cannot express, delegated once for every sheet in the app. */
export function initializeSheetGestures() {
	// Slide up on open. A sheet opens resting at its closed stop, so moving to the open one IS the
	// entry animation — `scroll-behavior: smooth` on the track makes this assignment glide, and the
	// dim, driven by that same scroll, fades in with it. Deliberately a scroll and not a transform
	// of the body: the body is a snap target, so a transform gets cancelled by re-snapping (see the
	// note on the body's rule). On an anchored popover the track has no scroll range, so this is a
	// no-op — which doubles as the "am I a sheet?" test and needs no mode check.
	document.addEventListener('toggle', (e: Event) => {
		const popover = e.target
		if (popover instanceof HTMLElement && popover.matches('[popover][data-sheet]') && (e as ToggleEvent).newState === 'open') {
			popover.scrollTop = popover.scrollHeight
		}
	}, { capture: true })

	// Swipe-to-dismiss: scrolling has SETTLED (the fling is over and snap has landed) with the body
	// pushed off the bottom, i.e. the user parked the sheet closed. Deliberately keyed on the rested
	// offset rather than on `scrollsnapchange`'s reported target: the spacer is a pseudo-element, so
	// it can only report its originating element, which makes "is this the closed stop?" an
	// inference — and any transient report while the popover is still laying out then reads as a
	// dismissal. `scrollend` states the same intent directly and cannot fire mid-gesture.
	//
	// The range guard is what makes offset 0 mean "closed" rather than "there is nowhere to scroll":
	// anything that collapses the track — the fallback flipping back to an anchored placement on a
	// widened window, a rotation, the virtual keyboard — lands the offset at 0 and would otherwise
	// dismiss an editor the user never swiped (verified: resizing to desktop closed it).
	document.addEventListener('scrollend', e => {
		const popover = e.target
		if (popover instanceof HTMLElement && popover.matches('[popover][data-sheet]:popover-open')
			&& popover.scrollHeight - popover.clientHeight > 2 && popover.scrollTop < 2) {
			popover.hidePopover()
		}
	}, { capture: true })

	// A tap on the dim: in sheet mode the track covers the viewport, so the platform's light dismiss
	// (which needs a click OUTSIDE the popover) can never see it — a click whose target is the track
	// itself, never a child, is that same intent.
	//
	// It must be the PRESS that started on the track, not merely the click that landed there, and
	// that is not a nicety: the tap which opens an entry is still in flight when the sheet appears,
	// and its trailing click is delivered to the by-then-full-viewport track while the body is still
	// scrolling up — so keying on the click alone dismissed every sheet the instant it opened (it
	// looked like a shadow flashing). The opening press landed on the entry, so requiring the press
	// excludes it by construction. This is the same click-versus-light-dismiss race that
	// EntryDetailsComponent's rAF deferral documents, arriving from the other side.
	//
	// Touch panning cancels the click, so dragging the sheet from the dim area still scrolls rather
	// than dismissing. The scroll-range test keeps this inert unless sheet mode is really active —
	// without the spacer (a browser lacking anchored container queries) there is no dim to tap, and
	// a click anywhere on a stray full-viewport frame must not close anything.
	let pressedTrack: HTMLElement | undefined
	document.addEventListener('pointerdown', e => {
		pressedTrack = e.target instanceof HTMLElement && e.target.matches('[popover][data-sheet]:popover-open') ? e.target : undefined
	}, { capture: true })

	document.addEventListener('click', e => {
		const popover = pressedTrack
		pressedTrack = undefined
		if (popover && e.target === popover && popover.matches('[popover][data-sheet]:popover-open')
			&& popover.scrollHeight - popover.clientHeight > 2) {
			closeSheet(popover)
		}
	}, { capture: true })

	// Escape closes a sheet by sliding it out too. It takes intercepting the KEY, because the close
	// half of `beforetoggle` is not cancelable — so the popover's built-in close request has to be
	// prevented before it happens, and `closeSheet` finishes the job.
	document.addEventListener('keydown', e => {
		if (e.key !== 'Escape' || e.defaultPrevented) {
			return
		}
		const sheet = [...document.querySelectorAll<HTMLElement>('[popover][data-sheet]:popover-open')].at(-1)
		if (sheet && closeSheet(sheet)) {
			e.preventDefault()
		}
	}, { capture: true })
}
