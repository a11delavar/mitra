import { Controller, type ReactiveControllerHost } from '@a11d/lit'

/** Renders its host again every second while it is connected, for what it says relative to now ("2 minutes ago"). */
export class ClockController extends Controller {
	private timer?: ReturnType<typeof setInterval>

	constructor(protected override readonly host: ReactiveControllerHost) {
		super(host)
	}

	override hostConnected() {
		this.timer = setInterval(() => this.host.requestUpdate(), 1000)
	}

	override hostDisconnected() {
		clearInterval(this.timer)
	}
}
