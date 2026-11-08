import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'

/**
 * What a page shows beside the entries, the settings, the calendars and the signed-in account: each host it is given
 * re-renders when any of them changes, so no store reaches for a component to update it.
 */
export class PageState extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()

	/** The settings, the calendars or the account changed. */
	static changed() {
		PageState.hosts.forEach(host => host.requestUpdate())
	}

	override hostConnected() {
		PageState.hosts.add(this.host)
	}

	override hostDisconnected() {
		PageState.hosts.delete(this.host)
	}
}
