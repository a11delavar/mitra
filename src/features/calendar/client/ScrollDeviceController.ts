import { Controller, css, eventListener, type Component } from '@a11d/lit'

type ScrollDevice = 'wheel' | 'trackpad' | 'touch' | 'pen'

/**
 * Tracks active scrolling device (notched wheel vs continuous trackpad/touch) for dynamic scroll snapping.
 */
export class ScrollDeviceController extends Controller {
	static readonly styles = css`
		:root {
			--scroll-snap-align: none;
			&[data-scroll-device] {
				--scroll-snap-align: start;

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
		const WHEEL_UNIT = 120
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
			this.set('wheel')
		}
	}

	private set(device: ScrollDevice) {
		if (document.documentElement.dataset.scrollDevice !== device) {
			document.documentElement.dataset.scrollDevice = device
		}
	}
}
