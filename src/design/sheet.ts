import { Controller, css, unsafeCSS, type ReactiveControllerHost } from '@a11d/lit'
import { MediaQueryController } from '@3mo/media-query-observer'
import { SwipeabilityController } from '@3mo/swipeability'

/** Width below which an anchored popover is presented at the block-end edge as a sheet instead. */
const sheetQuery = '(width < 40rem)'

const duration = 250

/**
 * Bottom-sheet presentation of an anchored popover: below the breakpoint it covers the viewport and
 * its single child rests against the block-end edge. No "touch-action" is declared on purpose -
 * claiming the axis would leave the content unable to scroll.
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
		/* Named by the host as a custom property rather than as "position-anchor" itself, so that the
		   sheet below can decline the anchor - an inline style could not be overridden. */
		position-anchor: var(--mitra-sheet-anchor, none);
		overflow: clip;
		background: none;
		border-start-start-radius: var(--sheet-frame-radius, 0);
		border-start-end-radius: var(--sheet-frame-radius, 0);
		box-shadow: var(--sheet-frame-shadow, none);
	}

	@media ${unsafeCSS(sheetQuery)} {
		[popover][data-sheet] {
			/* Off the anchor entirely: while it is placed in the anchor's area, "inset" fills that
			   area rather than the viewport - a half-width panel with a gap beneath it. */
			position-anchor: none;
			position-area: none;
			position-visibility: always;
			position-try-fallbacks: none;

			position: fixed;
			inset: 0;
			margin: 0;
			inline-size: auto;
			block-size: auto;
			max-inline-size: none;
			max-block-size: none;
			justify-content: flex-end;
			border-start-start-radius: 0;
			border-start-end-radius: 0;
			box-shadow: none;

			&::after {
				content: '';
				position: fixed;
				inset: 0;
				z-index: -1;
				pointer-events: none;
				background: rgb(0 0 0 / 0.32);
				opacity: var(--mitra-sheet-progress, 1);
				transition: opacity ${duration}ms cubic-bezier(0.2, 0, 0, 1);

				@starting-style {
					opacity: 0;
				}
			}

			> * {
				flex: none;
				box-sizing: border-box;
				inline-size: 100%;
				max-inline-size: 30rem;
				max-block-size: calc(100dvb - 2.5rem);
				margin: 0;
				margin-inline: auto;
				border: none;
				border-block-start: var(--border);
				border-radius: 0;
				border-start-start-radius: 1.25rem;
				border-start-end-radius: 1.25rem;
				box-shadow: 0 -12px 48px rgb(0 0 0 / 0.3);
				padding-block-end: env(safe-area-inset-bottom);
				translate: 0 var(--mitra-sheet-offset, 0px);
				transition: translate ${duration}ms cubic-bezier(0.2, 0, 0, 1);

				/* Comes in from beneath the edge. Declared last, as a starting style must be. */
				@starting-style {
					translate: 0 100%;
				}
			}

			/* Grab handle bar on sheet top edge. */
			> *::before {
				content: '';
				inline-size: 2.25rem;
				block-size: 0.25rem;
				border-radius: 0.125rem;
				margin-block: 0.375rem 0;
				margin-inline: auto;
				background: color-mix(in srgb, var(--color-text) 25%, transparent);
			}

			&[data-swiping] {
				> *, &::after {
					transition: none;
				}
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		[popover][data-sheet] {
			> *, &::after {
				transition: none;
			}
		}
	}
`

type SheetHost = ReactiveControllerHost & HTMLElement

/** Presents its host popover as a sheet below {@link sheetQuery} and lets it be swiped away. */
export class SheetController extends Controller {
	readonly media: MediaQueryController
	readonly swipeability: SwipeabilityController

	constructor(protected override readonly host: SheetHost) {
		super(host)
		const controller = this
		this.media = new MediaQueryController(host, sheetQuery)
		this.swipeability = new SwipeabilityController(host, {
			axis: 'block',
			direction: 'end',
			get surface() { return controller.sheet },
			get detents() { return [0, controller.travel] },
			// It only ever rests open: dismissing hides the popover outright.
			detent: 0,
			get disabled() { return !controller.presented },
			handleSwipeStart: () => host.toggleAttribute('data-swiping', true),
			handleSwipe: offset => controller.place(offset),
			handleSwipeEnd: detent => {
				host.toggleAttribute('data-swiping', false)
				if (detent > 0) {
					void controller.close()
				} else {
					controller.place(0)
				}
			},
		})
	}

	get presented() {
		return this.media.matches && this.host.matches(':popover-open')
	}

	private get sheet() {
		return this.host.querySelector<HTMLElement>(':scope > *') ?? undefined
	}

	private get travel() {
		return this.sheet?.offsetHeight ?? 0
	}

	override hostConnected() {
		if (!this.media.matches) {
			return
		}
		// The tap which opens the sheet must not also land on whatever the sheet brings under the
		// finger: a touch is followed by a compatibility click once the sheet is already there.
		this.host.style.pointerEvents = 'none'
		setTimeout(() => this.host.style.removeProperty('pointer-events'), duration + 100)
	}

	override hostDisconnected() {
		this.swipeability.abandon()
	}

	/** Slides the sheet away before hiding the popover. False when it is not presented as a sheet. */
	async close() {
		if (!this.presented) {
			return false
		}
		this.place(this.travel)
		await new Promise(resolve => setTimeout(resolve, duration))
		if (this.host.matches(':popover-open')) {
			this.host.hidePopover()
		}
		return true
	}

	private place(offset: number) {
		const travel = this.travel
		this.host.style.setProperty('--mitra-sheet-offset', `${offset}px`)
		this.host.style.setProperty('--mitra-sheet-progress', `${travel ? 1 - offset / travel : 1}`)
	}
}
