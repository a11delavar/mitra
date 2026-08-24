import type { EntrySegmentComponent } from '../../entries/client/EventSegment.js'

/**
 * The calendar's view transitions — scoped, just-in-time, and navigation-only.
 *
 * Every rule here exists because the naive setup (permanent `view-transition-name` on every segment,
 * `document.startViewTransition` around every re-render) fails three ways at once:
 *
 * 1. **Scoped, not document-wide.** `element.startViewTransition` (Chromium 147+) stages the pseudo
 *    tree on the scope itself: the sidebar and header sit outside it, so morphing snapshots can never
 *    paint over them — under a document transition every named group is hoisted above the root
 *    snapshot the unnamed sidebar is flattened into — and the rest of the app stays live and
 *    clickable. Browsers without scoped support switch instantly; a document-level fallback would
 *    just resurrect both glitches.
 *
 * 2. **Named just-in-time, viewport-bounded.** Snapshot cost is per named element (an old texture, a
 *    live layer, and a width/height group animation that runs on the main thread each), and elements
 *    scrolled out of view are still captured "as if scrolled to" — ~50 names is a documented failure
 *    on low-end hardware, while the year strip alone renders months of segments. So segments are
 *    named only for the transition's lifetime, only while they intersect the scope, capped at the
 *    {@link maxNamedSegments} closest to center. At rest nothing is named, so nothing morphs and
 *    nothing pays.
 *
 *    The grid's frame is named too, for the opposite reason — see {@link chromeSelector}.
 *
 * 3. **Navigation-only.** Background refreshes (every save echoes an SSE tick) apply in place with no
 *    transition — the store adopts server values onto the same working instances, so they repaint
 *    same-frame; animating them morphed the grid on every edit and snapped any running view-switch
 *    morph to its end frame.
 */
export type CalendarTransitionType = 'view-switch' | 'source-toggle'

declare global {
	/** Element-scoped view transitions (Chromium 147+, css-view-transitions-2) haven't reached
	 * lib.dom yet — declared optional, matching the runtime feature detection below. */
	interface HTMLElement {
		startViewTransition?(callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions): ViewTransition
	}
}

/** Enough for every pair the eye can follow, comfortably below where capture cost shows on mobile. */
const maxNamedSegments = 40

/** The grid's frame: the sticky rails and header rows each view marks with `data-chrome` (the time
 * axis and its zone header, the all-day corner, the weekday rows, the year strip's month rail, and
 * the week's column titles).
 *
 * They must be named for the same reason the entries must — naming hoists an element OUT of its
 * stacking context into the flat pseudo tree, which paints above the scope's own snapshot. Leave the
 * frame unnamed and it stays flattened in that snapshot with every entry group sliding over it: the
 * sidebar's overlap, one level in. Named, the frame is captured in paint order — above the entries,
 * exactly where it sits live — and it morphs in place instead of ghosting through the crossfade.
 *
 * Deliberately the FRAME only, not every date numeral: a chip crossing a numeral reads as movement
 * within the grid, while a chip crossing the frame reads as broken. That keeps the set bounded by
 * construction (a handful per view), so it needs no cap — only the viewport filter, since the week
 * view buffers ~70 day columns to scroll through. */
const chromeSelector = '[data-chrome]'

const segmentSelector = 'mitra-entry-segment'

/** A rapid second trigger skips the running transition, but the loser's `finished` still settles
 * asynchronously — its cleanup must not wipe the names its successor just assigned. */
let generation = 0

export function transitionCalendar(scope: HTMLElement, type: CalendarTransitionType, update: () => Promise<void>) {
	const ownGeneration = ++generation
	if (!scope.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
		void update()
		return
	}
	nameChrome(scope)
	const oldNames = nameVisibleSegments(scope)
	const transition = scope.startViewTransition({
		types: [type],
		update: async () => {
			await update()
			// Only segments visible on BOTH sides keep a name: a pair morphs, showing continuity;
			// an unpaired name would fade out/in as its own floating snapshot — pure capture cost
			// with nothing to show for it. Everything unpaired rides the scope's own crossfade.
			clearNames(scope, segmentSelector)
			nameVisibleSegments(scope, oldNames)
			// Frame is NOT cleared first: whatever survived the update keeps the identity name it was
			// captured under, so it pairs and holds still. Only what the new view brought needs naming.
			nameChrome(scope)
		},
	})
	// Being skipped by a successor (or a hidden tab) is fine — the update itself always lands.
	transition.updateCallbackDone.catch(() => void 0)
	transition.ready.catch(() => void 0)
	transition.finished.catch(() => void 0).then(() => {
		if (ownGeneration === generation) {
			clearNames(scope)
		}
	})
}

/** `match-element` has the browser mint the name from element identity: unique by construction — a
 * duplicate name aborts the whole transition — and self-pairing, with no name scheme to maintain. */
function nameChrome(scope: HTMLElement) {
	const scopeRect = scope.getBoundingClientRect()
	for (const element of scope.querySelectorAll<HTMLElement>(chromeSelector)) {
		if (isVisibleIn(element.getBoundingClientRect(), scopeRect)) {
			element.style.viewTransitionName = 'match-element'
		}
	}
}

/** Name the segments intersecting the scope, nearest-to-center first — deterministically
 * (`entry-${segment.id}` is stable across views by construction), so the same entry-day pairs up
 * across a switch and morphs between its two layouts. With `pairs`, only those names are eligible. */
function nameVisibleSegments(scope: HTMLElement, pairs?: ReadonlySet<string>) {
	const scopeRect = scope.getBoundingClientRect()
	const candidates = new Array<{ element: EntrySegmentComponent, name: string, distance: number }>()
	for (const element of scope.querySelectorAll<EntrySegmentComponent>(segmentSelector)) {
		const id = element.segment?.id
		if (id === undefined) {
			continue
		}
		const name = `entry-${id}`
		if (pairs?.has(name) === false) {
			continue
		}
		const rect = element.getBoundingClientRect()
		if (!isVisibleIn(rect, scopeRect)) {
			continue
		}
		const dx = (rect.left + rect.right) - (scopeRect.left + scopeRect.right)
		const dy = (rect.top + rect.bottom) - (scopeRect.top + scopeRect.bottom)
		candidates.push({ element, name, distance: dx * dx + dy * dy })
	}
	candidates.sort((a, b) => a.distance - b.distance)
	const named = new Set<string>()
	for (const candidate of candidates.slice(0, maxNamedSegments)) {
		// One name on two elements aborts the WHOLE transition (InvalidStateError) — never emit twice.
		if (!named.has(candidate.name)) {
			candidate.element.style.viewTransitionName = candidate.name
			named.add(candidate.name)
		}
	}
	return named
}

function isVisibleIn(rect: DOMRect, scopeRect: DOMRect) {
	return rect.width > 0 && rect.height > 0
		&& rect.bottom > scopeRect.top && rect.top < scopeRect.bottom
		&& rect.right > scopeRect.left && rect.left < scopeRect.right
}

function clearNames(scope: HTMLElement, selector = `${segmentSelector}, ${chromeSelector}`) {
	for (const element of scope.querySelectorAll<HTMLElement>(selector)) {
		element.style.viewTransitionName = ''
	}
}
