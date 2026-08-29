import { css } from '@a11d/lit'

/**
 * Bottom-sheet styling and gesture controller for popovers.
 */
export const sheetStyles = css`
	/* Pinned viewport-covering fallback when anchor placement overflows. */
	@position-try --sheet {
		position-anchor: none;
		position-area: none;
		inset: 0;
		margin: 0;
		inline-size: auto;
		block-size: auto;
		max-inline-size: none;
		max-block-size: none;
	}

	[popover][data-sheet] {
		container-type: anchored;
		overflow-x: hidden;
		overflow-y: auto;
		scroll-snap-type: block mandatory;
		scrollbar-width: none;
		overscroll-behavior: none;

		border-start-start-radius: var(--sheet-frame-radius, 0);
		border-start-end-radius: var(--sheet-frame-radius, 0);
		box-shadow: var(--sheet-frame-shadow, none);

		@media (prefers-reduced-motion: no-preference) {
			scroll-behavior: smooth;
		}

		background: none;
		scroll-timeline-name: --mitra-sheet-track;
		scroll-timeline-axis: block;
	}

	@keyframes mitra-sheet-dim {
		from { opacity: 0 }
		to { opacity: 1 }
	}

	@container anchored(fallback: --sheet) {
		/* Viewport-fixed dimmer animating opacity driven by sheet scroll timeline. */
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

		/* 100dvb spacer serving as the closed snap position above sheet content. */
		[popover][data-sheet]::before {
			content: '';
			display: block;
			flex: none;
			block-size: 100dvb;
			scroll-snap-align: start;
		}

		/* Sheet content panel resting at open snap position. */
		[popover][data-sheet] > * {
			flex: none;
			box-sizing: border-box;
			inline-size: 100%;
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

		/* Grab handle bar on sheet top edge. */
		[popover][data-sheet] > *::before {
			content: '';
			inline-size: 2.25rem;
			block-size: 0.25rem;
			border-radius: 0.125rem;
			margin-block: 0.375rem 0;
			margin-inline: auto;
			background: color-mix(in srgb, var(--color-text) 25%, transparent);
		}
	}
`

/**
 * Slide a sheet down to closed snap offset before hiding. Returns false if not an open sheet.
 */
export function closeSheet(popover: HTMLElement) {
	if (!popover.matches('[popover][data-sheet]:popover-open') || popover.scrollHeight - popover.clientHeight <= 2) {
		return false
	}
	popover.scrollTop = 0
	return true
}

/** Initialize delegated sheet lifecycle and gesture event listeners. */
export function initializeSheetGestures() {
	// Scroll to open snap position on open.
	document.addEventListener('toggle', (e: Event) => {
		const popover = e.target
		if (popover instanceof HTMLElement && popover.matches('[popover][data-sheet]') && (e as ToggleEvent).newState === 'open') {
			popover.scrollTop = popover.scrollHeight
		}
	}, { capture: true })

	// Dismiss popover when scrolling settles at top closed spacer position.
	document.addEventListener('scrollend', e => {
		const popover = e.target
		if (popover instanceof HTMLElement && popover.matches('[popover][data-sheet]:popover-open')
			&& popover.scrollHeight - popover.clientHeight > 2 && popover.scrollTop < 2) {
			popover.hidePopover()
		}
	}, { capture: true })

	// Tap on track/dim backdrop dismisses sheet.
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

	// Escape key slides sheet down.
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
