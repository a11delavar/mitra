import type { EntrySegmentComponent } from '../../entries/client/EventSegment.js'

/**
 * Scoped view transition orchestration for calendar navigation and source visibility changes.
 */
export type CalendarTransitionType = 'view-switch' | 'source-toggle'

declare global {
	interface HTMLElement {
		startViewTransition?(callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions): ViewTransition
	}
}

const maxNamedSegments = 40
const chromeSelector = '[data-chrome]'
const segmentSelector = 'mitra-entry-segment'

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
			clearNames(scope, segmentSelector)
			nameVisibleSegments(scope, oldNames)
			nameChrome(scope)
		},
	})
	transition.updateCallbackDone.catch(() => void 0)
	transition.ready.catch(() => void 0)
	transition.finished.catch(() => void 0).then(() => {
		if (ownGeneration === generation) {
			clearNames(scope)
		}
	})
}

function nameChrome(scope: HTMLElement) {
	const scopeRect = scope.getBoundingClientRect()
	for (const element of scope.querySelectorAll<HTMLElement>(chromeSelector)) {
		if (isVisibleIn(element.getBoundingClientRect(), scopeRect)) {
			element.style.viewTransitionName = 'match-element'
		}
	}
}

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
