import { Controller, css, eventListener, type Component } from '@a11d/lit'

/** What is scrolling the app, as far as anything downstream needs to care. */
type ScrollDevice = 'wheel' | 'trackpad' | 'touch' | 'pen'

/**
 * Which device is scrolling the app right now, published to the cascade so the views that snap can ask —
 * the only place the answer exists, since the pointer media features describe the hardware rather than
 * the hand.
 *
 * The line that matters is NOTCHED vs CONTINUOUS, not mouse vs touch. A trackpad, a finger and a pen all
 * stream deltas that a snap position merely rounds off once they stop; a wheel arrives in discrete jumps,
 * and a snap position sitting between two of them is a brake on every single notch. So a trackpad belongs
 * with the finger, even though the platform calls it a mouse and it scrolls through the very same `wheel`
 * event — which is why the notch has to be recognised from the delta itself. No media query can express
 * any of this: `pointer` describes the PRIMARY device and `any-pointer` every ATTACHED one, both static
 * descriptions of the hardware, and a wheel and a trackpad are the very same device to both of them.
 *
 * Attached to the application root: this is ambient state about the SESSION, not about any one view, and
 * the views that consume it never see the events (they read the custom property {@link styles} resolves).
 * Both listeners sit on the WINDOW — a gesture anywhere counts, including on a scroller this app does
 * not own — and both are CAPTURING and passive, like the focus-modality tracker: no handler that stops
 * propagation can hide a gesture from us, and this never costs one anything.
 */
export class ScrollDeviceController extends Controller {
	/**
	 * The stamp, as the cascade sees it. It travels as a custom property for the same reason the focus
	 * ring does (focusRing.css.ts): the views reading it live in shadow roots, where a `:root` ancestor
	 * selector can never match. They declare `scroll-snap-align: var(--scroll-snap-align)` on their
	 * snap TARGETS rather than switching `scroll-snap-type` on the scroller — a container whose targets
	 * have no alignment has no snap positions, which is precisely "do not snap", and it leaves every other
	 * scrolling property the view owns alone.
	 *
	 * Until the first gesture there is no attribute and that `none` fallback stands: nothing snaps until a
	 * device has identified itself. No `@media (pointer: coarse)` seed is needed for the touch case — a
	 * finger fires `pointerdown` the moment it lands, long before the pan it starts can settle anywhere.
	 * Registered once by Mitra.
	 */
	static readonly styles = css`
		:root {
			--scroll-snap-align: none;
			&[data-scroll-device] {
				/* Anything that scrolls continuously snaps... */
				--scroll-snap-align: start;

				/* ...and the notched wheel, the one case this whole controller exists for, does not. */
				&[data-scroll-device=wheel] {
					--scroll-snap-align: none;
				}
			}
		}
	`

	constructor(protected override readonly host: Component) {
		super(host)
	}

	@eventListener({ target: window, type: 'wheel', options: { capture: true, passive: true } })
	protected handleWheel(event: WheelEvent) {
		/** The platform's own wheel unit: one notch, whatever a notch is worth in pixels on this system. */
		const WHEEL_UNIT = 120
		/**
		 * Whether a wheel event came from a notched wheel rather than a trackpad's two-finger scroll — the two
		 * are indistinguishable by type and differ only in the shape of the delta. A notch is QUANTISED: engines
		 * that scroll by lines rather than pixels say so outright in `deltaMode`, and Chromium and WebKit both
		 * still report a notch through the legacy `wheelDelta` as a whole multiple of the wheel unit, while a
		 * trackpad's small, finely graded deltas land between multiples.
		 *
		 * It is a heuristic, and the honest failure mode is a fast trackpad fling whose delta happens to land on
		 * a multiple: one flick scrolls without snapping and the next gesture puts it back. Wrong in that
		 * direction is cheap — nothing breaks, snapping just misses a gesture.
		 */
		const isWheelNotch = (event: WheelEvent) => {
			const { wheelDeltaX = 0, wheelDeltaY = 0 } = event as WheelEvent & { wheelDeltaX?: number, wheelDeltaY?: number }
			const quantised = (delta: number) => delta !== 0 && Math.abs(delta) % WHEEL_UNIT === 0
			return event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || quantised(wheelDeltaY) || quantised(wheelDeltaX)
		}
		this.set(isWheelNotch(event) ? 'wheel' : 'trackpad')
	}

	@eventListener({ target: window, type: 'pointerdown', options: { capture: true, passive: true } })
	protected handlePointerDown(event: PointerEvent) {
		if (event.pointerType === 'touch' || event.pointerType === 'pen') {
			this.set(event.pointerType)
		} else if (event.button === 1) {
			// Middle-click autoscroll — the one mouse scroll that fires no wheel event at all, so the press
			// is the only tell. It is also the worst case for snapping: the page is being dragged
			// continuously and every frame gets pulled back.
			this.set('wheel')
		}
		// A left click says nothing either way: a trackpad reports its own click as a mouse too.
	}

	/** Guarded because a wheel fires per notch — an unchanged attribute must not cost a style
	 * invalidation on every one of them. */
	private set(device: ScrollDevice) {
		if (document.documentElement.dataset.scrollDevice !== device) {
			document.documentElement.dataset.scrollDevice = device
		}
	}
}
